import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import CategoryIcon from "@/components/CategoryIcon";

describe("CategoryIcon", () => {
  it("renders an icon for a valid category", () => {
    const { container } = render(<CategoryIcon category="water" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders with custom size", () => {
    const { container } = render(<CategoryIcon category="water" size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });

  it("renders with background when showBackground is true", () => {
    const { container } = render(
      <CategoryIcon category="water" showBackground={true} />,
    );
    const wrapper = container.querySelector("div");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass("inline-flex");
    expect(wrapper).toHaveStyle({ backgroundColor: expect.any(String) });
  });

  it("renders with transparent background by default", () => {
    const { container } = render(<CategoryIcon category="water" />);
    const wrapper = container.querySelector("div");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveStyle({ backgroundColor: "transparent" });
  });

  it("renders uncategorized icon", () => {
    const { container } = render(<CategoryIcon category="uncategorized" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("applies custom className to wrapper", () => {
    const { container } = render(
      <CategoryIcon category="water" className="custom-class" />,
    );
    const wrapper = container.querySelector("div");
    expect(wrapper).toHaveClass("custom-class");
  });
});
