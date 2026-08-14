import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MovementWall } from "@/components/movement/movement-wall";

describe("Movement Wall", () => {
  it("shows the honest beginning state", () => {
    render(<MovementWall initialEntries={[]} />);
    expect(screen.getByRole("heading", { name: "No moments of gratitude are public yet." })).toBeInTheDocument();
    expect(screen.getByText("The wall is just beginning.")).toBeInTheDocument();
  });

  it("renders only safe public Guardian details", () => {
    render(<MovementWall initialEntries={[{ guardian_number: 7, display_name: "Asha", published_at: "2026-08-06T12:00:00.000Z", card_path: "card/7-v1.webp", card_width: 640, card_height: 800, full_path: "full/7-v1.webp", full_width: 1200, full_height: 900, alt_text: "A protected tree", focal_x: .5, focal_y: .5, card_url: "https://example.test/card.webp", full_url: "https://example.test/full.webp" }]} />);
    expect(screen.getByText("Guardian #7")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Asha" })).toBeInTheDocument();
    expect(screen.getByAltText("A protected tree")).toHaveAttribute("src", "https://example.test/card.webp");
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
  });
});
