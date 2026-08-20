import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PromiseReel } from "@/components/home/promise-reel";
import { heroPromiseImages } from "@/content/campaign";

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe("PromiseReel", () => {
  beforeEach(() => setReducedMotion(false));

  it("enhances the static image sequence with an aria-hidden duplicate", async () => {
    const { container } = render(<PromiseReel images={heroPromiseImages} />);

    await screen.findByRole("button", { name: "Pause promise reel" });
    const sequences = container.querySelectorAll(".promise-reel__sequence");

    expect(sequences).toHaveLength(2);
    expect(sequences[0]).not.toHaveAttribute("aria-hidden");
    expect(sequences[1]).toHaveAttribute("aria-hidden", "true");
    expect(sequences[0].querySelectorAll("figure")).toHaveLength(heroPromiseImages.length);
  });

  it("lets the user pause and resume playback", async () => {
    const user = userEvent.setup();
    const { container } = render(<PromiseReel images={heroPromiseImages} />);
    const reel = container.querySelector(".promise-reel");
    const track = container.querySelector(".promise-ribbon__track");
    const pauseButton = await screen.findByRole("button", { name: "Pause promise reel" });

    expect(pauseButton).toHaveTextContent("");
    expect(track).toHaveAttribute("data-playing", "true");
    await user.click(pauseButton);
    expect(track).toHaveAttribute("data-playing", "false");

    await user.click(screen.getByRole("button", { name: "Play promise reel" }));
    const resumedButton = screen.getByRole("button", { name: "Pause promise reel" });
    expect(resumedButton).toBeVisible();
    fireEvent.blur(resumedButton, { relatedTarget: null });
    fireEvent.mouseLeave(reel!);
    expect(track).toHaveAttribute("data-playing", "true");
  });

  it("temporarily pauses while hovered, focused, or directly manipulated", async () => {
    const { container } = render(<PromiseReel images={heroPromiseImages} />);
    const reel = container.querySelector(".promise-reel");
    const track = container.querySelector(".promise-ribbon__track");
    const viewport = await screen.findByRole("group", {
      name: "Scrollable campaign promise photographs",
    });

    fireEvent.mouseEnter(reel!);
    expect(track).toHaveAttribute("data-playing", "false");
    fireEvent.mouseLeave(reel!);
    expect(track).toHaveAttribute("data-playing", "true");

    fireEvent.focus(viewport);
    expect(track).toHaveAttribute("data-playing", "false");
    fireEvent.blur(viewport, { relatedTarget: null });
    expect(track).toHaveAttribute("data-playing", "true");

    fireEvent.pointerDown(viewport);
    expect(track).toHaveAttribute("data-playing", "false");
    fireEvent.pointerUp(viewport);
    expect(track).toHaveAttribute("data-playing", "true");
  });

  it("starts paused when reduced motion is preferred", async () => {
    setReducedMotion(true);
    const { container } = render(<PromiseReel images={heroPromiseImages} />);

    await screen.findByRole("button", { name: "Play promise reel" });
    await waitFor(() =>
      expect(container.querySelector(".promise-ribbon__track")).toHaveAttribute(
        "data-playing",
        "false",
      ),
    );
  });
});
