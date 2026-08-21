import { describe, expect, it } from "vitest";

import { approvalCertificateEmail } from "@/lib/email/templates/approval-certificate";
import { rejectionEmail } from "@/lib/email/templates/rejection";

describe("transactional email templates", () => {
  it("renders a premium, inbox-safe approval message with certificate instructions", () => {
    const email = approvalCertificateEmail("<Ravi & Asha>", 27);
    expect(email.subject).toBe("Mirchi Vriksha Bandhan Certificate");
    expect(email.subject).not.toMatch(/[🌱🎉!]/u);
    expect(email.templateVersion).toBe("approval-certificate-v4");
    expect(email.text).toContain("Vriksha Guardian No. 27");
    expect(email.text).toContain("attached to this email as a PDF");
    expect(email.html).toContain("Submission approved");
    expect(email.html).toContain("Your certificate is attached");
    expect(email.html).toContain("@MirchiMumbai");
    expect(email.text).toContain("@MirchiMumbai");
    expect(email.html).toContain("&lt;Ravi &amp; Asha&gt;");
    expect(email.html).not.toContain("<img");
    expect(email.html).not.toMatch(/https?:\/\//);
    expect(`${email.html}${email.text}`).toContain("Vriksha Bandhan");
    expect(`${email.html}${email.text}`).not.toMatch(/Vvandhan/i);
  });

  it("uses one general rejection message without exposing internal review details", () => {
    const email = rejectionEmail("<Asha & Ravi>");
    expect(email.templateVersion).toBe("rejection-v4");
    expect(email.html).toContain("&lt;Asha &amp; Ravi&gt;");
    expect(email.html).not.toContain("rejection_pending_admin");
    expect(email.text).toContain("We could not approve your photograph this time");
    expect(email.text).toContain("Please submit a new, well-lit photograph");
    expect(email.subject).toContain("Vriksha Bandhan");
    expect(email.html).not.toContain("<img");
    expect(email.html).not.toMatch(/https?:\/\//);
    expect(`${email.html}${email.text}`).not.toMatch(/Vvandhan/i);
  });

  it("does not accept or render reviewer reasons or participant notes", () => {
    const email = rejectionEmail("Asha");
    expect(`${email.html}${email.text}`).not.toContain("image_quality");
    expect(`${email.html}${email.text}`).not.toContain("A note from the Mirchi team");
  });
});
