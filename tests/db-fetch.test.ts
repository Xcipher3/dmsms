import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithRetry } from "@/lib/db-fetch";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("fetchWithRetry", () => {
  it("returns the response when fetch succeeds on the first attempt", async () => {
    const ok = new Response("ok", { status: 200 });
    const mock = vi.fn(async () => ok);
    globalThis.fetch = mock as unknown as typeof fetch;

    const res = await fetchWithRetry("https://example.com/sql", { method: "POST" });

    expect(res).toBe(ok);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("retries transient fetch failures before succeeding", async () => {
    const ok = new Response("ok", { status: 200 });
    let attempts = 0;
    const mock = vi.fn(async () => {
      attempts++;
      if (attempts < 3)
        throw new TypeError("fetch failed");
      return ok;
    });
    globalThis.fetch = mock as unknown as typeof fetch;

    const res = await fetchWithRetry("https://example.com/sql");

    expect(res).toBe(ok);
    expect(attempts).toBe(3);
  });

  it("rethrows the last error after exhausting retries", async () => {
    let attempts = 0;
    const mock = vi.fn(async () => {
      attempts++;
      throw new TypeError("fetch failed");
    });
    globalThis.fetch = mock as unknown as typeof fetch;

    await expect(fetchWithRetry("https://example.com/sql")).rejects.toThrow("fetch failed");
    expect(attempts).toBe(4);
  });

  it("does not retry when the caller aborts the request", async () => {
    const controller = new AbortController();
    const mock = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    globalThis.fetch = mock as unknown as typeof fetch;
    controller.abort();

    await expect(
      fetchWithRetry("https://example.com/sql", { signal: controller.signal }),
    ).rejects.toThrow("aborted");
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
