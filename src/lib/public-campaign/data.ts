import { z } from "zod";

import { getPublicEnvironment, hasPublicSupabaseEnvironment } from "@/lib/env/public";

export const CAMPAIGN_PUBLIC_TAG = "campaign-public";

const summaryRowSchema = z.object({
  current_count: z.coerce.number().int().nonnegative(),
  target_count: z.coerce.number().int().positive(),
  metric_label: z.string().min(1).max(80),
  submissions_open: z.boolean(),
});

const movementRowSchema = z.object({
  guardian_number: z.coerce.number().int().positive(),
  display_name: z.string().min(1).max(100),
  published_at: z.iso.datetime({ offset: true }),
  card_path: z.string().min(1),
  card_width: z.coerce.number().int().positive(),
  card_height: z.coerce.number().int().positive(),
  full_path: z.string().min(1),
  full_width: z.coerce.number().int().positive(),
  full_height: z.coerce.number().int().positive(),
  alt_text: z.string().min(1).max(500),
  focal_x: z.coerce.number().min(0).max(1),
  focal_y: z.coerce.number().min(0).max(1),
});

export type PublicCampaignSummary = z.infer<typeof summaryRowSchema>;
export type PublicMovementEntry = z.infer<typeof movementRowSchema> & {
  card_url: string;
  full_url: string;
};

function rpcHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function publicImageUrl(baseUrl: string, path: string): string {
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/public/published-images/${safePath}`;
}

export async function getPublicCampaignSummary(): Promise<PublicCampaignSummary | null> {
  if (!hasPublicSupabaseEnvironment()) return null;
  try {
    const environment = getPublicEnvironment();
    const response = await fetch(`${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_public_campaign_summary`, {
      method: "POST",
      headers: rpcHeaders(environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      body: "{}",
      next: { revalidate: 30, tags: [CAMPAIGN_PUBLIC_TAG] },
    });
    if (!response.ok) return null;
    return summaryRowSchema.parse(z.array(z.unknown()).parse(await response.json())[0]);
  } catch {
    return null;
  }
}

export async function getPublicMovementEntries(options: {
  limit?: number;
  beforePublishedAt?: string | null;
  beforeGuardianNumber?: number | null;
  cached?: boolean;
} = {}): Promise<PublicMovementEntry[]> {
  if (!hasPublicSupabaseEnvironment()) return [];
  const environment = getPublicEnvironment();
  const response = await fetch(`${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/list_public_movement_entries`, {
    method: "POST",
    headers: rpcHeaders(environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    body: JSON.stringify({
      p_limit: options.limit ?? 24,
      p_before_published_at: options.beforePublishedAt ?? null,
      p_before_guardian_number: options.beforeGuardianNumber ?? null,
    }),
    ...(options.cached === false
      ? { cache: "no-store" as const }
      : { next: { revalidate: 30, tags: [CAMPAIGN_PUBLIC_TAG] } }),
  });
  if (!response.ok) throw new Error("public_movement_unavailable");
  const rows = z.array(movementRowSchema).parse(await response.json());
  return rows.map((row) => ({
    ...row,
    card_url: publicImageUrl(environment.NEXT_PUBLIC_SUPABASE_URL, row.card_path),
    full_url: publicImageUrl(environment.NEXT_PUBLIC_SUPABASE_URL, row.full_path),
  }));
}
