import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RakhiPromiseCounter } from "@/components/home/rakhi-promise-counter";

describe("RakhiPromiseCounter", () => {
  const metric = { current: 9, target: 983, label: "trees celebrated" };

  it("displays the real current value and target", () => {
    const { container } = render(<RakhiPromiseCounter metric={metric} />);

    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("983")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("rakhi-counter-ornament.png"),
    );
    expect(container.querySelector(".rakhi-counter__ring")).not.toBeInTheDocument();
    expect(container.querySelector(".rakhi-counter__thread")).not.toBeInTheDocument();
  });

  it("exposes a concise accessible progress label", () => {
    render(<RakhiPromiseCounter metric={metric} />);

    expect(screen.getByRole("img", { name: "9 of 983 trees celebrated." })).toBeInTheDocument();
    expect(screen.getByText("1% complete.")).toHaveClass("visually-hidden");
  });

  it("shows an honest unavailable state without inventing a count", () => {
    render(<RakhiPromiseCounter metric={{ current: null, target: 983, label: "trees celebrated" }} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Live tracker updating.")).toHaveClass("visually-hidden");
    expect(screen.getByRole("img", {
      name: "Campaign promise count is currently unavailable. Target: 983 trees celebrated.",
    })).toBeInTheDocument();
  });
});
