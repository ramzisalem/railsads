import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../empty-state";
import { Package } from "lucide-react";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        icon={Package}
        title="No products yet"
        description="Add products to get started."
      />
    );

    expect(screen.getByText("No products yet")).toBeInTheDocument();
    expect(screen.getByText("Add products to get started.")).toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(
      <EmptyState
        icon={Package}
        title="Empty"
        description="Nothing here."
        action={<button>Add item</button>}
      />
    );

    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
  });

  it("does not render action slot when omitted", () => {
    const { container } = render(
      <EmptyState
        icon={Package}
        title="Empty"
        description="Nothing here."
      />
    );

    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
