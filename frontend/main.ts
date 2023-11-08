/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";

import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";

import {
  maxDataPointsPerService,
  newMeasurementNonceKey,
  serviceOpSortedBatchKey,
  serviceOpUnsortedBatchKey,
} from "./lib/constants.ts";
import { encodeMeasurements, decodeMeasurements } from "./lib/utils.ts";
import type { QueueMessage } from "./lib/types.ts";

const kv = await Deno.openKv();

kv.listenQueue(async (msg) => {
  const message = msg as QueueMessage;
  const nonce = await kv.get([newMeasurementNonceKey, message.nonce]);
  if (nonce.value === null) {
    // This message was already processed
    return;
  }

  const unsortedKey = serviceOpUnsortedBatchKey + message.serviceOp;
  const sortedKey = serviceOpSortedBatchKey + message.serviceOp;

  // Truncate up to two digits after decimal point
  const measurement = Math.trunc(message.measurement * 100) / 100;
  let unsortedMeasurements = await decodeMeasurements(
    (await kv.get([unsortedKey])).value as Uint8Array | null,
  );
  unsortedMeasurements.push(measurement);
  // Cut out any older measurements
  unsortedMeasurements = unsortedMeasurements.slice(-maxDataPointsPerService);
  const sortedMeasurements = unsortedMeasurements.slice().sort((a, b) => a - b);

  const [encodedUnsortedMeasurements, encodedSortedMeasurements] = await Promise.all([
    encodeMeasurements(unsortedMeasurements),
    encodeMeasurements(sortedMeasurements),
  ]);

  await kv
    .atomic()
    .delete(nonce.key)
    .set([unsortedKey], encodedUnsortedMeasurements)
    .set([sortedKey], encodedSortedMeasurements)
    .commit();
});

await start(manifest, { plugins: [twindPlugin(twindConfig)] });
