const SUPABASE_ORIGIN = "https://jslfqoxxmilfolrwvfaa.supabase.co";
const WORKER_ORIGIN = "https://withered-dew-e3c0.nocodegenius12.workers.dev";

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
    const request = new Request(targetUrl, input.clone());
    return init ? new Request(request, init) : request;
  }

  return new Request(targetUrl, init);
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