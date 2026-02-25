/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GitHubConnect from "../src/GitHubConnect.jsx";

describe("GitHubConnect", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows loading state initially", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})); // never resolves
    render(<GitHubConnect />);
    expect(screen.getByText(/checking github connection/i)).toBeInTheDocument();
  });

  it("shows connect buttons when not connected", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connected: false }),
    });
    render(<GitHubConnect />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /connect github \(public repos\)/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /connect \(include private repos\)/i })).toBeInTheDocument();
  });

  it("connect (public) link points to /api/auth/start", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connected: false }),
    });
    render(<GitHubConnect />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /connect github \(public repos\)/i })).toHaveAttribute(
        "href",
        "/api/auth/start"
      );
    });
  });

  it("connect (private) link points to /api/auth/start?scope=private", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connected: false }),
    });
    render(<GitHubConnect />);
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /connect \(include private repos\)/i })
      ).toHaveAttribute("href", "/api/auth/start?scope=private");
    });
  });

  it("shows connected state with username", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connected: true, login: "octocat", avatar_url: "" }),
    });
    render(<GitHubConnect />);
    await waitFor(() => {
      expect(screen.getByText(/@octocat/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });

  it("calls onConnected with user data when connected", async () => {
    const onConnected = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connected: true, login: "octocat", avatar_url: "https://example.com/a.png" }),
    });
    render(<GitHubConnect onConnected={onConnected} />);
    await waitFor(() => {
      expect(onConnected).toHaveBeenCalledWith(
        expect.objectContaining({ connected: true, login: "octocat" })
      );
    });
  });

  it("disconnect button calls /api/auth/disconnect and shows connect buttons", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connected: true, login: "octocat", avatar_url: "" }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });

    const onDisconnected = vi.fn();
    render(<GitHubConnect onDisconnected={onDisconnected} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /connect github \(public repos\)/i })).toBeInTheDocument();
    });
    expect(onDisconnected).toHaveBeenCalled();
  });

  it("falls back to not-connected on fetch error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));
    render(<GitHubConnect />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /connect github \(public repos\)/i })).toBeInTheDocument();
    });
  });
});
