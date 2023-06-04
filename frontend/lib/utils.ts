import { quantileSorted } from "https://esm.sh/d3-array@3.2.4";
import { measurementKey, measurementReadKey, measurementWriteKey } from "./constants.ts";

const maxDataPointsPerService = 10_000;
const services = [
  "denokv",
  "upstashredis",
  "dynamodb",
  "firestore",
  "cloudflarekv",
] as const;

const percentiles = ["50", "99", "99.9"] as const;
const numberPercentiles = percentiles.map(Number);

export type Percentiles = (typeof percentiles)[number];
export type QuantileCalculations = {
  calculations: {
    [measurementReadKey]: Record<string, Record<Percentiles, number>>;
    [measurementWriteKey]: Record<string, Record<Percentiles, number>>;
  };
  samples: {
    [measurementReadKey]: Record<string, number>;
    [measurementWriteKey]: Record<string, number>;
  };
};

export async function quantile(db: Deno.Kv): Promise<QuantileCalculations> {
  const operations = 2; // 1 read, 1 write
  const maxDataPoints = services.length * operations * maxDataPointsPerService;

  const measurements = {
    [measurementReadKey]: {} as Record<string, number[]>,
    [measurementWriteKey]: {} as Record<string, number[]>,
  };

  const measurementPercentiles = {
    [measurementReadKey]: {} as Record<string, Record<Percentiles, number>>,
    [measurementWriteKey]: {} as Record<string, Record<Percentiles, number>>,
  };

  for await (const entry of db.list({ prefix: [measurementKey] }, { limit: maxDataPoints, reverse: true })) {
    const [, readWrite, _time, service] = entry.key;
    measurements[readWrite as typeof measurementReadKey][service as string] ??= [];
    measurements[readWrite as typeof measurementReadKey][service as string].push(entry.value as number);
  }

  for (const operation of [measurementReadKey, measurementWriteKey] as const) {
    const operationObj = measurements[operation];
    for (const [service, latencyMeasurements] of Object.entries(operationObj)) {
      const percentileValues: Record<string, number> = {};
      measurementPercentiles[operation][service] ??= percentileValues;
      for (const percentile of numberPercentiles) {
        const sorted = latencyMeasurements.slice().sort((a, b) => a - b);
        percentileValues[String(percentile)] = quantileSorted(sorted, percentile / 100)!;
      }
    }
  }

  const sampleSizes = {
    [measurementReadKey]: Object.fromEntries(
      Object.entries(measurements[measurementReadKey]).map(([key, value]) => [key, value.length])
    ),
    [measurementWriteKey]: Object.fromEntries(
      Object.entries(measurements[measurementWriteKey]).map(([key, value]) => [key, value.length])
    ),
  };

  return {
    calculations: measurementPercentiles,
    samples: sampleSizes,
  };
}

export function capitalize(str: string): string {
  return str.slice(0, 1).toUpperCase() + str.slice(1).toLowerCase();
}