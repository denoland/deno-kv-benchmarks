import { signal } from "@preact/signals";
import { LatencyOnlyResponse } from "./types.ts";

export const latencyData = signal<Record<string, LatencyOnlyResponse> | null>(null);

const delay = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));
let loadingLatencyData = false;

export async function loadLatencyData() {
  if (loadingLatencyData) {
    return;
  }

  loadingLatencyData = true;

  await delay(1500);
  latencyData.value = {
    denokv: {
      latencies: {
        read: Math.floor(Math.random() * 1000),
        write: Math.floor(Math.random() * 1000),
      },
    },
    upstashredis: {
      latencies: {
        read: Math.floor(Math.random() * 1000),
        write: Math.floor(Math.random() * 1000),
      },
    },
    dynamodb: {
      latencies: {
        read: Math.floor(Math.random() * 1000),
        write: Math.floor(Math.random() * 1000),
      },
    },
    firestore: {
      latencies: {
        read: Math.floor(Math.random() * 1000),
        write: Math.floor(Math.random() * 1000),
      },
    },
    cloudflarekv: {
      latencies: {
        read: Math.floor(Math.random() * 1000),
        write: Math.floor(Math.random() * 1000),
      },
    },
  };

  // const response = await fetch("/latency-summary");
  // const data: Record<string, LatencyOnlyResponse> = await response.json();
  // latencyData.value = data;

  console.log("Data retrieved");
}
