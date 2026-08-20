import { emailShell, escapeHtml, type TransactionalEmail } from "@/lib/email/templates/shared";

export function submissionReceivedEmail(displayName: string): TransactionalEmail {
  const name = displayName.trim();
  const safeName = escapeHtml(name);
  return {
    subject: "We received your Vriksha Bandhan submission 🌱",
    templateVersion: "submission-received-v3",
    html: emailShell("Your submission has been received", `<h1 style="margin:0 0 18px;font-size:28px;line-height:1.2">Thank you, ${safeName}.</h1><p style="font-size:17px;line-height:1.6">We have received your Vriksha Bandhan photograph. The Mirchi team will review it before it is approved.</p><p style="font-size:17px;line-height:1.6">If approved, you will receive a Vriksha Guardian number and your personalized certificate by email.</p>`),
    text: `Thank you, ${name}.\n\nWe have received your Vriksha Bandhan photograph. The Mirchi team will review it before it is approved.\n\nIf approved, you will receive a Vriksha Guardian number and your personalized certificate by email.\n\n983 Trees. One Frequency. Infinite Gratitude.`,
  };
}
