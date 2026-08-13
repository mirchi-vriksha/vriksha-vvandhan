import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/env/server";
import type { Database } from "@/lib/supabase/database.types";

let serviceClient: SupabaseClient<Database> | undefined;

const SUPABASE_REQUEST_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  return fetch(input, { ...init, signal });
}

/**
 * Trusted server client. The secret key bypasses RLS, so this module must never
 * be imported by a Client Component or used for caller-authorized operations
 * without a separate DAL permission check.
 */
export function getServiceSupabaseClient(): SupabaseClient<Database> {
  if (serviceClient) {
    return serviceClient;
  }

  const environment = getServerEnvironment();
  serviceClient = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: fetchWithTimeout },
    },
  );

  return serviceClient;
}
