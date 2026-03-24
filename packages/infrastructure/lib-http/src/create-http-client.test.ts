import { describe, it, expect } from "vitest";
import { createHttpClient } from "./index";

describe("createHttpClient", () => {
  it("returns a ky instance", () => {
    const client = createHttpClient();
    expect(client).toBeDefined();
    expect(typeof client.get).toBe("function");
  });

  it("accepts prefixUrl and headers options", () => {
    const client = createHttpClient({
      prefixUrl: "https://api.example.com",
      headers: { "X-Custom": "value" },
    });
    expect(client).toBeDefined();
  });
});
