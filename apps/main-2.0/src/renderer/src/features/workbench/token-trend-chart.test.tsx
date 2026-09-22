// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { TokenTrendChart } from "./token-trend-chart";
import type { SessionDailyTokenUsage } from "../../../../core/types";

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

it.each(["invalid", "365", "unavailable"])("defaults safely when the saved range is %s", async (stored) => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.setItem("agent-recall.workbench-token-trend-period.v2", stored);
  if (stored === "unavailable") {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Storage unavailable", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Storage read-only", "QuotaExceededError"); });
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<TokenTrendChart points={[]} language="en" onSelectDay={vi.fn()} />));
    expect(host.querySelector("select")?.value).toBe("7");
    await act(async () => {
      const select = host.querySelector("select")!;
      select.value = "90";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelector("select")?.value).toBe("90");
  } finally {
    await act(async () => root.unmount());
    vi.restoreAllMocks();
  }
});

it("switches actual daily windows, totals, sparse dates and selected-day navigation", async () => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onSelectDay = vi.fn();
  const points: SessionDailyTokenUsage[] = Array.from({ length: 90 }, (_, i) => ({
    dayStart: new Date(2026, 0, i + 1).getTime(), dayEndExclusive: new Date(2026, 0, i + 2).getTime(),
    inputTokens: 1, outputTokens: 0, cachedInputTokens: 0, reasoningOutputTokens: 0, totalTokens: 1,
  }));
  try {
    await act(async () => root.render(<TokenTrendChart points={points} language="zh" onSelectDay={onSelectDay} />));
    for (const days of [7, 30, 90]) {
      await act(async () => {
        const select = host.querySelector("select")!;
        select.value = String(days);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(host.querySelector("section")?.getAttribute("aria-label")).toBe(`近 ${days} 天 Token 用量`);
      expect(host.querySelectorAll(".workbench-token-trend-point")).toHaveLength(days);
      expect(host.querySelector(".workbench-token-trend-head b")?.textContent).toBe(String(days));
      expect(host.querySelectorAll(".workbench-token-trend-labels span")).toHaveLength(days === 7 ? 7 : 5);
      await act(async () => host.querySelector<HTMLButtonElement>(".workbench-token-trend-point")!.click());
      expect(onSelectDay).toHaveBeenLastCalledWith(points[90 - days]);
      // Leaving Workbench unmounts the chart; returning must restore its range.
      await act(async () => root.render(null));
      await act(async () => root.render(<TokenTrendChart points={points} language="zh" onSelectDay={onSelectDay} />));
      expect(host.querySelector("select")?.value).toBe(String(days));
      expect(host.querySelectorAll(".workbench-token-trend-point")).toHaveLength(days);
      expect(host.querySelector(".workbench-token-trend-head b")?.textContent).toBe(String(days));
    }
    await act(async () => root.render(<TokenTrendChart points={[]} language="en" onSelectDay={onSelectDay} />));
    expect(host.querySelectorAll(".workbench-token-trend-point")).toHaveLength(0);
    expect(host.querySelector(".workbench-token-trend-head b")?.textContent).toBe("0");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
