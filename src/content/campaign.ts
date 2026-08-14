import type {
  CampaignImage,
  HeroContent,
  CampaignMetric,
  NavigationItem,
  PromiseReelImage,
} from "@/types/campaign";

export const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Join", href: "/join" },
  { label: "Movement Wall", href: "/movement" },
] as const satisfies readonly NavigationItem[];

export const promiseMetric: CampaignMetric = {
  current: null,
  target: 983,
  label: "trees celebrated",
};

export const heroContent = {
  title: "Vriksha Bandhan",
  tagline: "It’s time to celebrate the ones who’ve always been there for us.",
  primaryCta: { label: "Tie a Rakhi to a Tree", href: "/join" },
  secondaryCta: { label: "How It Works", href: "/join#how-to-participate" },
  ribbonLabel: "Mumbai’s growing wall of gratitude",
} as const satisfies HeroContent;

export const heroImage: CampaignImage = {
  src: "/campaign/hero-tree-rakhi.webp",
  width: 688,
  height: 720,
  alt: "A ceremonial Rakhi tied around the trunk of a sunlit tree",
  objectPosition: "50% 52%",
};

export const heroPromiseImages = [
  {
    id: "promise-child-and-tree",
    src: "/campaign/child-hand-bark.webp",
    width: 560,
    height: 720,
    alt: "A child's hand resting gently on the bark of a tree",
    aspect: "portrait",
  },
  {
    id: "promise-school",
    src: "/campaign/on-ground-school.webp",
    width: 445,
    height: 430,
    alt: "Schoolchildren gathered around a tree decorated with Rakhis",
    aspect: "square",
  },
  {
    id: "promise-community",
    src: "/campaign/on-ground-community.webp",
    width: 480,
    height: 430,
    alt: "Community elders gathered beside a tree wrapped with Rakhis",
    aspect: "square",
  },
  {
    id: "promise-youth",
    src: "/campaign/on-ground-youth.webp",
    width: 451,
    height: 720,
    alt: "Young people making a Rakhi promise beside a city tree",
    aspect: "portrait",
  },
  {
    id: "promise-banyan",
    src: "/campaign/story-banyan.webp",
    width: 726,
    height: 720,
    alt: "A mature banyan tree sheltering a quiet neighbourhood street",
    aspect: "square",
  },
  {
    id: "promise-shared-ritual",
    src: "/campaign/movement-rakhi-wide.webp",
    width: 1376,
    height: 390,
    alt: "A community tying a ceremonial Rakhi around a tree",
    aspect: "landscape",
  },
  {
    id: "promise-tree-at-dusk",
    src: "/campaign/rakhi-tree-at-dusk.webp",
    width: 1376,
    height: 360,
    alt: "A large tree glowing at dusk with many Rakhi promises",
    aspect: "landscape",
  },
  {
    id: "promise-first-moment",
    src: "/campaign/first-rakhi-moment.webp",
    width: 730,
    height: 675,
    alt: "The first symbolic Rakhi promise being tied to a tree",
    aspect: "square",
  },
] as const satisfies readonly PromiseReelImage[];
