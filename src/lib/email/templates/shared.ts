export type TransactionalEmail = {
  subject: string;
  html: string;
  text: string;
  templateVersion: string;
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function emailShell(title: string, content: string): string {
  const preheader = escapeHtml(title);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${preheader}</title></head><body style="margin:0;padding:0;background:#f3f0e8;color:#193d32;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%"><div aria-hidden="true" style="display:none!important;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f0e8"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #ded8c9"><tr><td style="height:8px;background:#d92d2f;font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="padding:28px 32px 22px;border-bottom:1px solid #ece7dc"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="color:#d92d2f;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase">Mirchi</td><td align="right" style="color:#193d32;font-size:14px;line-height:20px;font-weight:700">Vriksha Bandhan</td></tr></table></td></tr><tr><td style="padding:36px 32px 32px">${content}</td></tr><tr><td style="padding:24px 32px;background:#193d32;color:#ffffff"><p style="margin:0 0 8px;font-size:13px;line-height:20px;font-weight:700;letter-spacing:.4px">983 Trees. One Frequency. Infinite Gratitude.</p><p style="margin:0;color:#d8e2dc;font-size:12px;line-height:18px">You’re receiving this message because you participated in Vriksha Bandhan.</p></td></tr></table></td></tr></table></body></html>`;
}
