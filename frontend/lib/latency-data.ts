import { signal } from "@preact/signals";
import { LatencyOnlyResponse, LatencySummaryResponse } from "./types.ts";

export const latencyData = signal<LatencySummaryResponse | null>(null);
let loadingLatencyData = false;

export async function loadLatencyData() {
  if (loadingLatencyData) {
    return;
  }
  loadingLatencyData = true;

  const response = await fetch("/latency-summary");
  const data: LatencySummaryResponse = await response.json();
  latencyData.value = data;
  loadingLatencyData = false;
}
