import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RemoveStaffButton } from "@/components/admin/remove-staff-button";

describe("RemoveStaffButton", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires confirmation before allowing permanent removal", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<RemoveStaffButton displayName="Asha Rao" />);

    expect(fireEvent.click(screen.getByRole("button", { name: "Remove member" }))).toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      "Permanently remove Asha Rao and their sign-in account?",
    );

    confirm.mockReturnValue(true);
    expect(fireEvent.click(screen.getByRole("button", { name: "Remove member" }))).toBe(true);
  });

  it("can be disabled for the signed-in member", () => {
    render(<RemoveStaffButton displayName="Current Admin" disabled />);
    expect(screen.getByRole("button", { name: "Remove member" })).toBeDisabled();
  });
});
