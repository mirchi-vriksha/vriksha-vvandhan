import { describe, expect, it } from "vitest";

import { approvalCertificateEmail } from "@/lib/email/templates/approval-certificate";
import { rejectionEmail } from "@/lib/email/templates/rejection";
import { submissionReceivedEmail } from "@/lib/email/templates/submission-received";

describe("transactional email templates", () => {
  it("describes receipt without implying approval", () => {
    const email = submissionReceivedEmail("Asha");
    expect(email.subject).toContain("received");
    expect(email.text).toContain("before it is approved");
    expect(email.text).not.toContain("has been approved");
    expect(email.html).toContain("review");
    expect(`${email.html}${email.text}`).not.toContain("Movement Wall");
    expect(`${email.html}${email.text}`).not.toContain("Wall of Gratitude");
    expect(email.subject).toContain("Vriksha Bandhan");
    expect(`${email.html}${email.text}`).not.toMatch(/Vvandhan/i);
  });

  it("includes the unpadded Guardian number and certificate wording", () => {
    const email = approvalCertificateEmail("Ravi", 27);
    expect(email.text).toContain("Vriksha Guardian No. 27");
    expect(email.text).toContain("attached");
    expect(`${email.html}${email.text}`).toContain("Vriksha Bandhan");
    expect(`${email.html}${email.text}`).not.toMatch(/Vvandhan/i);
  });

  it("keeps rejection participant-facing and escapes HTML", () => {
    const email = rejectionEmail("<Asha & Ravi>", "image_quality", "Please retry with a photo <without> private details.");
    expect(email.html).toContain("&lt;Asha &amp; Ravi&gt;");
    expect(email.html).toContain("&lt;without&gt;");
    expect(email.html).not.toContain("rejection_pending_admin");
    expect(email.text).toContain("Please retry");
    expect(email.subject).toContain("Vriksha Bandhan");
    expect(`${email.html}${email.text}`).not.toMatch(/Vvandhan/i);
  });
});
