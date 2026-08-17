import { emailShell, escapeHtml, type TransactionalEmail } from "@/lib/email/templates/shared";

export const REJECTION_REASON_LABELS = {
  tree_or_rakhi_not_visible: "The tree or Rakhi is not clearly visible in the photograph.",
  image_quality: "The photograph is not clear enough for campaign recognition.",
  privacy_or_safety: "The photograph cannot be used because of a privacy or safety concern.",
  duplicate_submission: "This appears to duplicate a submission we have already received.",
  campaign_mismatch: "The photograph does not match the Vriksha Bandhan participation guidelines.",
  other: "The submission could not be approved under the campaign guidelines.",
} as const;

export type RejectionReasonCode = keyof typeof REJECTION_REASON_LABELS;

export function rejectionEmail(displayName: string, reasonCode: RejectionReasonCode, participantNote?: string | null): TransactionalEmail {
  const name = displayName.trim();
  const reason = REJECTION_REASON_LABELS[reasonCode];
  const note = participantNote?.trim();
  const guidanceHtml = note ? `<p style="font-size:17px;line-height:1.6"><strong>Guidance from the Mirchi team:</strong><br>${escapeHtml(note)}</p>` : "";
  const guidanceText = note ? `\n\nGuidance from the Mirchi team:\n${note}` : "";
  return {
    subject: "Update on your Vriksha Bandhan submission",
    templateVersion: "rejection-v3",
    html: emailShell("An update on your submission", `<h1 style="margin:0 0 18px;font-size:28px;line-height:1.2">Thank you, ${escapeHtml(name)}.</h1><p style="font-size:17px;line-height:1.6">After review, we were unable to approve this submission.</p><p style="padding:16px;background:#f6f4ed;border-left:4px solid #dc2929;font-size:16px;line-height:1.6">${escapeHtml(reason)}</p>${guidanceHtml}<p style="font-size:17px;line-height:1.6">We appreciate the time and care you put into participating.</p>`),
    text: `Thank you, ${name}.\n\nAfter review, we were unable to approve this submission.\n\n${reason}${guidanceText}\n\nWe appreciate the time and care you put into participating.\n\n983 Trees. One Frequency. Infinite Gratitude.`,
  };
}
