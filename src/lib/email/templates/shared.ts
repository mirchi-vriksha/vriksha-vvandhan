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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#f6f4ed;color:#173d31;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(title)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4ed"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e4dfd2;border-radius:18px"><tr><td style="padding:28px"><p style="margin:0 0 24px;color:#dc2929;font-size:14px;font-weight:700;letter-spacing:.08em">MIRCHI × VRIKSHA BANDHAN</p>${content}<p style="margin:28px 0 0;color:#66736d;font-size:13px">983 Trees. One Frequency. Infinite Gratitude.</p></td></tr></table></td></tr></table></body></html>`;
}
