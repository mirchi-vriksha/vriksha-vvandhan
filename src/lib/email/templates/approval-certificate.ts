import { formatGuardianNumber } from "@/lib/certificates/certificate-format";
import { emailShell, escapeHtml, type TransactionalEmail } from "@/lib/email/templates/shared";

export function approvalCertificateEmail(displayName: string, guardianNumber: number): TransactionalEmail {
  const name = displayName.trim();
  const number = formatGuardianNumber(guardianNumber);
  return {
    subject: "You’re a Vriksha Guardian 🌱 — Your certificate is here",
    templateVersion: "approval-certificate-v3",
    html: emailShell("Your Vriksha Guardian certificate is here", `<h1 style="margin:0 0 18px;font-size:28px;line-height:1.2">Congratulations, ${escapeHtml(name)}.</h1><p style="font-size:17px;line-height:1.6">Your approved photograph is now part of Vriksha Bandhan. You are <strong>Vriksha Guardian No. ${number}</strong>.</p><p style="font-size:17px;line-height:1.6">Your personalized certificate is attached. Your gesture celebrates their presence, and your gratitude keeps the bond growing.</p>`),
    text: `Congratulations, ${name}.\n\nYour approved photograph is now part of Vriksha Bandhan. You are Vriksha Guardian No. ${number}.\n\nYour personalized certificate is attached. Your gesture celebrates their presence, and your gratitude keeps the bond growing.\n\n983 Trees. One Frequency. Infinite Gratitude.`,
  };
}
