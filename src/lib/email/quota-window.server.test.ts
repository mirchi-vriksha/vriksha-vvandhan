import { describe, expect, it } from "vitest";

import { emailQuotaWindow } from "@/lib/email/quota-window.server";

describe("email quota window", () => {
  it("uses the configured local calendar day and rolls over at its next midnight", () => {
    expect(emailQuotaWindow(new Date("2026-08-18T18:40:00.000Z"), "Asia/Kolkata")).toEqual({
      quotaDate: "2026-08-19",
      nextWindow: "2026-08-19T18:30:00.000Z",
    });
  });

  it("handles a daylight-saving timezone boundary", () => {
    expect(emailQuotaWindow(new Date("2026-03-08T06:30:00.000Z"), "America/New_York")).toEqual({
      quotaDate: "2026-03-08",
      nextWindow: "2026-03-09T04:00:00.000Z",
    });
  });
});
