import { emailShell, escapeHtml, type TransactionalEmail } from "@/lib/email/templates/shared";

export function submissionReceivedEmail(displayName: string): TransactionalEmail {
  const name = displayName.trim();
  const safeName = escapeHtml(name);
  return {
    subject: "We received your Vriksha Bandhan submission 🌱",
    templateVersion: "submission-received-v2",
    html: emailShell("Your submission has been received", `<h1 style="margin:0 0 18px;font-size:28px;line-height:1.2">Thank you, ${safeName}.</h1><p style="font-size:17px;line-height:1.6">We have received your Vriksha Bandhan photograph. The Mirchi team will review it before anything appears publicly.</p><p style="font-size:17px;line-height:1.6">If it is approved, it may join the Movement Wall, receive a Vriksha Guardian number, and your personalized certificate will be emailed to you.</p>`),
    text: `Thank you, ${name}.\n\nWe have received your Vriksha Bandhan photograph. The Mirchi team will review it before anything appears publicly.\n\nIf it is approved, it may join the Wall of Gratitude, receive a Vriksha Guardian number, and your personalized certificate will be emailed to you.\n\n983 Trees. One Frequency. Infinite Gratitude.`,
  };
}
