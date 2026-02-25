/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Generate from "../src/Generate.jsx";

const authMeNotConnected = {
  ok: true,
  json: () => Promise.resolve({ connected: false }),
};

describe("Generate", () => {
  beforeEach(() => {
    // Default: /api/auth/me returns not connected for all calls
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(authMeNotConnected));
  });

  it("renders title and evidence textarea", async () => {
    render(<Generate />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /generate review/i })).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/timeframe.*contributions/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate review/i })).toBeInTheDocument();
  });

  it("Try sample loads sample JSON into textarea", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(authMeNotConnected) // /api/auth/me from GitHubConnect
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
            contributions: [],
          }),
      });
    render(<Generate />);
    fireEvent.click(screen.getByRole("button", { name: /try sample/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue(/"start_date": "2025-01-01"/)).toBeInTheDocument();
    });
  });

  it("shows error on invalid JSON when clicking Generate", async () => {
    render(<Generate />);
    const textarea = screen.getByPlaceholderText(/timeframe.*contributions/);
    fireEvent.change(textarea, { target: { value: "not json" } });
    fireEvent.click(screen.getByRole("button", { name: /generate review/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid json/i)).toBeInTheDocument();
    });
  });

  it("shows error when evidence missing timeframe or contributions", async () => {
    render(<Generate />);
    fireEvent.change(screen.getByPlaceholderText(/timeframe.*contributions/), {
      target: { value: "{}" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate review/i }));
    await waitFor(() => {
      expect(screen.getByText(/timeframe.*contributions/i)).toBeInTheDocument();
    });
  });
});
