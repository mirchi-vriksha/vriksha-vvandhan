import { NextResponse } from "next/server";
import { z } from "zod";

import { getPublicMovementEntries } from "@/lib/public-campaign/data";

const querySchema = z.object({
  beforePublishedAt: z.iso.datetime({ offset: true }),
  beforeGuardianNumber: z.coerce.number().int().positive(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    beforePublishedAt: url.searchParams.get("beforePublishedAt"),
    beforeGuardianNumber: url.searchParams.get("beforeGuardianNumber"),
  });
  if (!parsed.success) return NextResponse.json({ entries: [] }, { status: 400 });
  try {
    const entries = await getPublicMovementEntries({
      limit: 24,
      beforePublishedAt: parsed.data.beforePublishedAt,
      beforeGuardianNumber: parsed.data.beforeGuardianNumber,
      cached: false,
    });
    return NextResponse.json({ entries }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ entries: [] }, { status: 503 });
  }
}
