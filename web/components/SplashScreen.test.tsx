import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SplashScreen from "@/components/SplashScreen";

describe("SplashScreen", () => {
  it("renders the loading text", () => {
    render(<SplashScreen />);
    expect(screen.getByText("Зареждане...")).toBeInTheDocument();
  });

  it("renders the logo with correct alt text", () => {
    render(<SplashScreen />);
    const logo = screen.getByAltText("OboApp");
    expect(logo).toBeInTheDocument();
  });
});
