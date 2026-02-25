/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Landing from "../src/Landing.jsx";

describe("Landing", () => {
  it("renders brand name and primary CTA", () => {
    render(<Landing />);
    const ctas = screen.getAllByRole("link", { name: /generate my review/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    expect(ctas[0]).toHaveAttribute("href", "/generate");
    expect(screen.getByRole("navigation")).toHaveTextContent("AnnualReview.dev");
  });

  it("renders How it works section with four steps", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { name: /how it works/i })).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(list).toHaveTextContent("Sign in with GitHub");
    expect(list).toHaveTextContent("Pick the date range");
    expect(list).toHaveTextContent("AI reads your PRs");
    expect(list).toHaveTextContent("Copy the Markdown");
  });

  it("renders hero title and feature cards", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { name: /stop dreading/i })).toBeInTheDocument();
    expect(screen.getByText(/Theme Clusters/)).toBeInTheDocument();
    expect(screen.getByText(/Impact Bullets/)).toBeInTheDocument();
    expect(screen.getByText(/STAR Stories/)).toBeInTheDocument();
    expect(screen.getByText(/Evidence Appendix/)).toBeInTheDocument();
  });
});
