export type CampaignMetric = {
  current: number | null;
  target: number;
  label: string;
};

export type NavigationItem = {
  label: string;
  href: `#${string}` | `/${string}`;
};

export type CampaignImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  objectPosition?: string;
};

export type PromiseReelImage = CampaignImage & {
  id: string;
  aspect: "portrait" | "landscape" | "square";
};

export type CampaignLink = {
  label: string;
  href: `#${string}` | `/${string}`;
};

export type HeroContent = {
  title: string;
  tagline: string;
  primaryCta: CampaignLink;
  secondaryCta: CampaignLink;
  ribbonLabel: string;
};
