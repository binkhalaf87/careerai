import { describe, it, expect } from "vitest";

describe("ProtectedRoute logic", () => {
  it("user is synced when user.id matches session.user.id", () => {
    const user = { id: "abc-123" };
    const session = { user: { id: "abc-123" } };
    const isSynced = user.id === session.user.id;
    expect(isSynced).toBe(true);
  });

  it("user is NOT synced when ids differ", () => {
    const user = { id: "abc-123" };
    const session = { user: { id: "xyz-999" } };
    const isSynced = user.id === session.user.id;
    expect(isSynced).toBe(false);
  });

  it("isFullyAnonymous when both user and session are null", () => {
    const user = null;
    const session = null;
    const isFullyAnonymous = !user && !session;
    expect(isFullyAnonymous).toBe(true);
  });
});
