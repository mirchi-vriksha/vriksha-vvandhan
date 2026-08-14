import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("campaign homepage", () => {
  it("renders the concise campaign experience", async () => {
    render(await Home());

    await screen.findByRole("main");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Vriksha Bandhan");
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "983 Trees. One Frequency. Infinite Gratitude." })).toBeInTheDocument();
    expect(screen.queryByText(/Ped Ka Paigaam/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/First Rakhi Moment/i)).not.toBeInTheDocument();
  });

  it("uses valid in-page destinations for every hash CTA", async () => {
    const { container } = render(await Home());
    await waitFor(() => expect(container.querySelector("#main-content")).not.toBeNull());
    const ids = new Set(Array.from(container.querySelectorAll("[id]")).map((element) => element.id));
    const inPageLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));

    expect(inPageLinks.length).toBeGreaterThan(0);
    for (const link of inPageLinks) {
      expect(ids.has(link.hash.slice(1))).toBe(true);
    }
  });

  it("does not render fabricated empty links", async () => {
    const { container } = render(await Home());
    await waitFor(() => expect(container.querySelector("#main-content")).not.toBeNull());
    expect(container.querySelector('a[href=""], a:not([href])')).toBeNull();
  });
});
