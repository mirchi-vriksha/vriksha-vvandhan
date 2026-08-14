import { emailShell, escapeHtml, type TransactionalEmail } from "@/lib/email/templates/shared";

export function rejectionEmail(displayName: string, participantComment: string): TransactionalEmail {
  const name = displayName.trim();
  const comment = participantComment.trim();
  return {
    subject: "Update on your Vriksha Bandhan submission",
    templateVersion: "rejection-v2",
    html: emailShell("An update on your submission", `<h1 style="margin:0 0 18px;font-size:28px;line-height:1.2">Thank you, ${escapeHtml(name)}.</h1><p style="font-size:17px;line-height:1.6">After review, we were unable to approve this submission.</p><p style="padding:16px;background:#f6f4ed;border-left:4px solid #dc2929;font-size:16px;line-height:1.6">${escapeHtml(comment)}</p><p style="font-size:17px;line-height:1.6">We appreciate the time and care you put into participating.</p>`),
    text: `Thank you, ${name}.\n\nAfter review, we were unable to approve this submission.\n\n${comment}\n\nWe appreciate the time and care you put into participating.\n\n983 Trees. One Frequency. Infinite Gratitude.`,
  };
}
