import { describe, it, expect, vi, beforeEach } from "vitest";
import { SERVICE_COSTS, getPointsBalance } from "@/lib/points";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [{ amount: 10 }, { amount: -3 }], error: null })),
      })),
    })),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe("SERVICE_COSTS", () => {
  it("should have correct cost values", () => {
    expect(SERVICE_COSTS.analysis).toBe(3);
    expect(SERVICE_COSTS.enhancement).toBe(5);
    expect(SERVICE_COSTS.interview).toBe(5);
    expect(SERVICE_COSTS.builder).toBe(3);
    expect(SERVICE_COSTS.smart_apply).toBe(10);
    expect(SERVICE_COSTS.marketing_per_100).toBe(15);
  });

  it("all costs should be positive numbers", () => {
    Object.values(SERVICE_COSTS).forEach((cost) => {
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe("number");
    });
  });
});

describe("getPointsBalance", () => {
  it("should sum all transactions correctly", async () => {
    const balance = await getPointsBalance("test-user-id");
    expect(balance).toBe(7); // 10 + (-3)
  });
});
