import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

describe("EmptyState", () => {
  it("shows the title, the line and one button that acts", () => {
    const onClick = vi.fn();
    render(<EmptyState icon={Bell} title="Start your travel diary" body="Every place you log gets a page here." action={{ label: "Log a place", onClick }} />);
    expect(screen.getByText("Start your travel diary")).toBeTruthy();
    expect(screen.getByText("Every place you log gets a page here.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Log a place" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("has no button when there's nothing to do", () => {
    render(<EmptyState icon={Bell} title="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
