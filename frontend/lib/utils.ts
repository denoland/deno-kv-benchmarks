import { quantileSorted } from "https://esm.sh/d3-array@3.2.4";
import {
  maxDataPointsPerService,
  measurementKey,
  measurementReadKey,
  measurementWriteKey,
  serviceOpSortedBatchKey,
} from "./constants.ts";

const services = [
  "denokv",
  "upstashredis",
  "dynamodb",
  "firestore",
  "cloudflarekv",
] as const;

const percentiles = ["50", "90", "99"] as const;
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
  const measurements = {
    [measurementReadKey]: {} as Record<string, number[]>,
    [measurementWriteKey]: {} as Record<string, number[]>,
  };

  const measurementPercentiles = {
    [measurementReadKey]: {} as Record<string, Record<Percentiles, number>>,
    [measurementWriteKey]: {} as Record<string, Record<Percentiles, number>>,
  };

  const serviceMeasurementKeys: [string][] = [];
  for (const service of services) {
    for (const op of ["read", "write"]) {
      serviceMeasurementKeys.push([`${serviceOpSortedBatchKey}${service}:${op}`]);
    }
  }

  const databaseMeasurements = await db.getMany<Uint8Array[]>(serviceMeasurementKeys);
  const databaseMeasurementsDecoded = await Promise.all(
    databaseMeasurements
      .filter((entry) => entry.value)
      .map(async (entry) => [entry.key[0].toString(), await decodeMeasurements(entry.value!)] as const)
  );
  for (const databaseMeasurement of databaseMeasurementsDecoded) {
    const [serviceOp, values] = databaseMeasurement;
    const [, service, op] = serviceOp.split(":");
    measurements[op as typeof measurementReadKey][service] = values;
  }

  for (const operation of [measurementReadKey, measurementWriteKey] as const) {
    const operationObj = measurements[operation];
    for (const [service, latencyMeasurements] of Object.entries(operationObj)) {
      const percentileValues: Record<string, number> = {};
      measurementPercentiles[operation][service] ??= percentileValues;
      for (const percentile of numberPercentiles) {
        // The latency measurements are already sorted
        const sorted = latencyMeasurements;
        percentileValues[String(percentile)] = quantileSorted(
          sorted,
          percentile / 100,
        )!;
      }
    }
  }

  const sampleSizes = {
    [measurementReadKey]: Object.fromEntries(
      Object.entries(measurements[measurementReadKey]).map((
        [key, value],
      ) => [key, value.length]),
    ),
    [measurementWriteKey]: Object.fromEntries(
      Object.entries(measurements[measurementWriteKey]).map((
        [key, value],
      ) => [key, value.length]),
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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function gzip(rawData: string | Uint8Array, compress = true): Promise<Uint8Array> {
  const data = typeof rawData === "string" ? encoder.encode(rawData) : rawData;
  const stream = compress ? new CompressionStream("gzip") : new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  writer.write(data);
  writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function decodeMeasurements(rawData: Uint8Array | null): Promise<number[]> {
  if (rawData) {
    return JSON.parse(decoder.decode(await gzip(rawData, false)));
  }
  return [];
}

export async function encodeMeasurements(measurements: number[]): Promise<Uint8Array> {
  return await gzip(encoder.encode(JSON.stringify(measurements)));
}
