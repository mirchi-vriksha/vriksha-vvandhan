import Link from "next/link";
import { ArrowRight, Sprout } from "lucide-react";

import type { CampaignLink } from "@/types/campaign";

type HeroActionsProps = {
  primary: CampaignLink;
};

export function HeroActions({ primary }: HeroActionsProps) {
  return (
    <div className="campaign-hero__actions">
      <Link
        className="campaign-hero__action campaign-hero__action--primary"
        href={primary.href}
      >
        <Sprout aria-hidden="true" size={20} strokeWidth={1.8} />
        <span>{primary.label}</span>
        <span className="campaign-hero__action-arrow" aria-hidden="true">
          <ArrowRight size={20} strokeWidth={1.8} />
        </span>
      </Link>
    </div>
  );
}
