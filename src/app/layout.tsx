import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";

import { absoluteUrl, organizationName, siteName, siteUrl } from "@/lib/seo";

import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-editorial",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const campaignTitle = "Mirchi Vriksha Bandhan | Tie a Rakhi to a Tree";
const campaignDescription =
  "Join Mirchi’s Vriksha Bandhan movement in Mumbai. Tie a Rakhi to a tree, share your moment and become a Vriksha Guardian this Raksha Bandhan.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: campaignTitle,
    template: `%s | ${siteName}`,
  },
  description: campaignDescription,
  applicationName: siteName,
  authors: [{ name: organizationName }],
  creator: organizationName,
  publisher: organizationName,
  category: "Environment",
  formatDetection: { email: false, address: false, telephone: false },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    type: "website",
    locale: "en_IN",
    title: campaignTitle,
    description: campaignDescription,
    url: absoluteUrl("/"),
    siteName,
  },
  twitter: {
    card: "summary_large_image",
    title: campaignTitle,
    description: campaignDescription,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#173A2B",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IN"
      className={`${fraunces.variable} ${manrope.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>{children}</body>
    </html>
  );
}
