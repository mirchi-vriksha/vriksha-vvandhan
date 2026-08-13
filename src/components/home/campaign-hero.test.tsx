import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CampaignHero } from "@/components/home/campaign-hero";
import { heroPromiseImages } from "@/content/campaign";

describe("CampaignHero", () => {
  it("renders the Mirchi-led campaign identity with one page heading", () => {
    render(<CampaignHero />);

    expect(screen.getByRole("img", { name: "Mirchi" })).toBeInTheDocument();
    expect(screen.getByText("Presents")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Vriksha Bandhan" })).toBeInTheDocument();
    expect(screen.getByText("It’s time to celebrate the ones who’ve always been there for us.")).toBeInTheDocument();
    expect(screen.queryByText("This Raksha Bandhan")).not.toBeInTheDocument();
  });

  it("renders the honest tracker fallback and both valid hero actions", () => {
    render(<CampaignHero />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("img", {
      name: "Campaign promise count is currently unavailable. Target: 983 trees celebrated.",
    })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tie a Rakhi to a Tree" })).toHaveAttribute(
      "href",
      "/join",
    );
    expect(screen.getByRole("link", { name: "How It Works" })).toHaveAttribute(
      "href",
      "/join#how-to-participate",
    );
  });

  it("renders live count and target values in the rakhi counter", () => {
    render(<CampaignHero metric={{ current: 27, target: 983, label: "trees celebrated" }} />);

    expect(screen.getByText("27")).toBeInTheDocument();
    expect(screen.getByRole("img", {
      name: "27 of 983 trees celebrated.",
    })).toBeInTheDocument();
  });

  it("renders the typed Promise Ribbon without the retired Promise Halo", () => {
    const { container } = render(<CampaignHero />);

    const ribbon = screen.getByRole("region", { name: "Mumbai’s growing wall of gratitude" });
    expect(ribbon.querySelectorAll(".promise-reel__sequence:not([aria-hidden]) figure")).toHaveLength(
      heroPromiseImages.length,
    );
    expect(container.querySelector(".promise-halo")).toBeNull();
  });
});
