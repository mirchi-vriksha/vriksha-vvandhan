import type { Metadata } from "next";

import { LegalPage } from "@/components/shared/legal-page";
import { legalContent } from "@/content/legal";

export const metadata: Metadata = {
  title: "Privacy | Vriksha Bandhan",
  robots: { index: false, follow: true },
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <LegalPage content={legalContent.privacy} />;
}
