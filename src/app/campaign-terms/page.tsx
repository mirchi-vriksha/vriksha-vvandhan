import type { Metadata } from "next";

import { LegalPage } from "@/components/shared/legal-page";
import { legalContent } from "@/content/legal";

export const metadata: Metadata = {
  title: "Campaign Terms | Vriksha Bandhan",
  robots: { index: false, follow: false },
  alternates: { canonical: "/campaign-terms" },
};

export default function CampaignTermsPage() {
  return <LegalPage content={legalContent.terms} />;
}
