import { supabase } from "@/integrations/supabase/client";

const BROKER_EMAIL = "amudarling@gmail.com";
const BROKER_ACCESS_TIMEOUT_MS = 10000;

type BrokerUser = {
  id: string;
  email?: string | null;
} | null | undefined;

const createRoleTimeoutResult = () => ({
  data: null,
  error: new Error("Broker access check timed out"),
});

export const isBrokerEmail = (email?: string | null) =>
  email?.trim().toLowerCase() === BROKER_EMAIL;

export const hasBrokerAccess = async (user: BrokerUser) => {
  if (!user?.id) return false;
  if (isBrokerEmail(user.email)) return true;

  const fallbackResult = createRoleTimeoutResult();

  try {
    const { data, error } = await Promise.race([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle(),
      new Promise<typeof fallbackResult>((resolve) => {
        window.setTimeout(() => resolve(fallbackResult), BROKER_ACCESS_TIMEOUT_MS);
      }),
    ]);

    if (error) {
      console.error("Broker access check failed:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Broker access check crashed:", error);
    return false;
  }
};