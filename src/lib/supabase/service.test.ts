import { afterEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn(() => ({ marker: "service-client" }));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("service Supabase client", () => {
  it("is lazy and disables browser session behaviour", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    const { getServiceSupabaseClient } = await import("@/lib/supabase/service");

    expect(createClient).not.toHaveBeenCalled();
    getServiceSupabaseClient();
    expect(createClient).toHaveBeenCalledWith(
      "http://127.0.0.1:54321",
      "sb_secret_test",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: expect.any(Function),
        },
      },
    );
  });
});
