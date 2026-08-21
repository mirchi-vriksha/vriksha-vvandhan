export const siteUrl = "https://mirchivrikshabandhan.online";
export const siteName = "Mirchi Vriksha Bandhan";
export const organizationName = "Mirchi";

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${siteUrl}/`).toString();
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
