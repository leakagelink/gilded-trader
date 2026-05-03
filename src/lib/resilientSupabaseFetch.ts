const SUPABASE_ORIGIN = "https://jslfqoxxmilfolrwvfaa.supabase.co";
const WORKER_ORIGIN = "https://withered-dew-e3c0.nocodegenius12.workers.dev";
const DIRECT_RETRY_DELAY_MS = 2500;

type PatchedWindow = Window & {
  __coinGoldFxResilientFetchInstalled?: boolean;
  __coinGoldFxNativeFetchFrame?: HTMLIFrameElement;
};

const getUrlString = (input: RequestInfo | URL) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return "";
};

const replaceOrigin = (rawUrl: string, from: string, to: string) => {
  try {
    const url = new URL(rawUrl);
    if (url.origin !== from) return null;
    return rawUrl.replace(from, to);
  } catch {
    return null;
  }
};

const getNativeFetch = () => {
  const patchedWindow = window as PatchedWindow;

  if (!patchedWindow.__coinGoldFxNativeFetchFrame) {
    const frame = document.createElement("iframe");
    frame.style.display = "none";
    frame.setAttribute("aria-hidden", "true");
    document.documentElement.appendChild(frame);
    patchedWindow.__coinGoldFxNativeFetchFrame = frame;
  }

  return (
    patchedWindow.__coinGoldFxNativeFetchFrame.contentWindow?.fetch.bind(
      patchedWindow.__coinGoldFxNativeFetchFrame.contentWindow,
    ) || window.fetch.bind(window)
  );
};

const createRequest = (input: RequestInfo | URL, init: RequestInit | undefined, targetUrl: string) => {
  if (input instanceof Request) {
    const clonedInput = input.clone();
    const requestInit: RequestInit = {
      method: clonedInput.method,
      headers: clonedInput.headers,
      body: clonedInput.method === "GET" || clonedInput.method === "HEAD" ? undefined : clonedInput.body,
      mode: clonedInput.mode,
      credentials: clonedInput.credentials,
      cache: clonedInput.cache,
      redirect: clonedInput.redirect,
      referrer: clonedInput.referrer,
      referrerPolicy: clonedInput.referrerPolicy,
      integrity: clonedInput.integrity,
      keepalive: clonedInput.keepalive,
      signal: clonedInput.signal,
      ...init,
    };

    return new Request(targetUrl, requestInit);
  }

  return new Request(targetUrl, init);
};

const isReadRequest = (input: RequestInfo | URL, init?: RequestInit) => {
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  return method === "GET" || method === "HEAD";
};

const shouldRetryDirect = async (response: Response) => {
  if (![502, 503, 504].includes(response.status)) return false;

  try {
    const body = await response.clone().text();
    return body.includes("upstream connect error") || body.includes("connection timeout") || body.length === 0;
  } catch {
    return true;
  }
};

export const installResilientSupabaseFetch = () => {
  if (typeof window === "undefined") return;

  const patchedWindow = window as PatchedWindow;
  if (patchedWindow.__coinGoldFxResilientFetchInstalled) return;
  patchedWindow.__coinGoldFxResilientFetchInstalled = true;

  const previousFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = getUrlString(input);
    const directUrl =
      replaceOrigin(rawUrl, SUPABASE_ORIGIN, SUPABASE_ORIGIN) ||
      replaceOrigin(rawUrl, WORKER_ORIGIN, SUPABASE_ORIGIN);
    const workerUrl =
      replaceOrigin(rawUrl, SUPABASE_ORIGIN, WORKER_ORIGIN) ||
      replaceOrigin(rawUrl, WORKER_ORIGIN, WORKER_ORIGIN);

    if (!directUrl || !workerUrl) {
      return previousFetch(input, init);
    }

    const nativeFetch = getNativeFetch();

    if (isReadRequest(input, init)) {
      const directRequest = createRequest(input, init, directUrl);
      const workerRequest = createRequest(input, init, workerUrl);
      let directTimer: ReturnType<typeof window.setTimeout> | undefined;

      try {
        return await new Promise<Response>((resolve, reject) => {
          let settled = false;
          let failures = 0;
          const fail = (error: unknown) => {
            failures += 1;
            if (failures >= 2 && !settled) {
              settled = true;
              reject(error);
            }
          };
          const succeed = (response: Response) => {
            if (!settled) {
              settled = true;
              if (directTimer) window.clearTimeout(directTimer);
              resolve(response);
            }
          };

          nativeFetch(workerRequest)
            .then(async (response) => {
              if (await shouldRetryDirect(response)) return fail(new Error("Backend proxy timeout"));
              succeed(response);
            })
            .catch(fail);

          directTimer = window.setTimeout(() => {
            nativeFetch(directRequest).then(succeed).catch(fail);
          }, DIRECT_RETRY_DELAY_MS);
        });
      } catch (error) {
        console.warn("Backend proxy request failed; retrying direct connection.", error);
        return nativeFetch(createRequest(input, init, directUrl));
      }
    }

    try {
      const workerResponse = await nativeFetch(createRequest(input, init, workerUrl));
      if (!(await shouldRetryDirect(workerResponse))) return workerResponse;
      console.warn("Backend proxy timed out; retrying direct connection.");
    } catch (error) {
      console.warn("Backend proxy request failed; retrying direct connection.", error);
    }

    return nativeFetch(createRequest(input, init, directUrl));
  };
};