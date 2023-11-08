import { HandlerContext, Handlers } from "$fresh/server.ts";
import { config } from "../lib/config.ts";
import {
  CachedLatencyResponse,
  LatencyOnlyResponse,
  LatencyResponse,
  LatencySummaryResponse,
  QueueMessage,
} from "../lib/types.ts";
import {
  cachedRequestKey,
  newMeasurementNonceKey,
} from "../lib/constants.ts";
import { quantile } from "../lib/utils.ts";
import type { Config } from "../lib/config.ts";
import { makeDenoDeployRequest } from "../lib/deno-kv-backend.ts";

type ServiceName = keyof Config["backend_service_ratelimit"];
type ServiceLatencyData = [string, LatencyOnlyResponse];

function delay(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function checkStaleCache(service: string, time: number | null) {
  if (time) {
    const now = new Date().getTime();
    const nextRequestTime = time + config.backend_service_ratelimit[service as ServiceName];
    return nextRequestTime < now;
  }

  return true;
}

// We have to wait a while since some services take way too
// long to respond sometimes (e.g. Firestore can take
// upwards of 6 seconds to respond sometimes). A proper
// solution would probably involve `BroadcastChannel` but
// there's no time for that.
const serviceWaitIsUpdatingDelayMs = 7500;

/**
 * Attempt to return the current control node's response for this service
 * (if any), otherwise try creating a lock to take control of the service
 * and then request from the service. If taking control doesn't work, repeat
 * this process
 */
async function setNewCachedResponse(
  service: string,
  serviceUrl: string,
  serviceCachedKey: string[],
  serviceCachedResponse: Deno.KvEntryMaybe<CachedLatencyResponse>,
  db: Deno.Kv,
): Promise<CachedLatencyResponse> {
  while (true) {
    if (!checkStaleCache(service, serviceCachedResponse.value?.time ?? null)) {
      // TODO: Maybe remove or add to actual contract
      ((serviceCachedResponse.value?.response || {}) as Record<string, unknown>)
        .cached = true;
      return serviceCachedResponse.value!;
    }

    const now = new Date().getTime();
    if (serviceCachedResponse.value?.is_updating) {
      // Wait for whoever is in control of this service to update the cache with
      // a new response
      await delay(serviceWaitIsUpdatingDelayMs);
      const newServiceCachedResponse = await db.get<CachedLatencyResponse>(
        serviceCachedKey,
      );

      if (
        !checkStaleCache(service, newServiceCachedResponse.value?.time ?? null)
      ) {
        // TODO: Maybe remove or add to actual contract
        ((newServiceCachedResponse.value?.response || {}) as Record<
          string,
          unknown
        >).cached = true;
        return newServiceCachedResponse.value!;
      }

      // They're taking too long (maybe something went wrong), so we'll send our
      // own request
      serviceCachedResponse = newServiceCachedResponse;
    }

    const atomicLock = db
      .atomic()
      .check({
        key: serviceCachedKey,
        versionstamp: serviceCachedResponse.versionstamp,
      })
      .set(serviceCachedKey, {
        time: serviceCachedResponse.value?.time || now,
        is_updating: true,
        response: serviceCachedResponse.value?.response || null,
      } as CachedLatencyResponse);
    const result = await atomicLock.commit();

    if (result.ok) {
      // We've confirmed that we've received control of this service, so we're okay to request now
      let latencyResponse: LatencyResponse;
      if (service === "denokv") {
        // To eliminate network latency when requesting from Deno KV, we request
        // from a VM running in the same GCP region to ensure that the Deno
        // Deploy code is run from the same region
        latencyResponse = JSON.parse(await makeDenoDeployRequest(serviceUrl));
      } else {
        const response = await fetch(serviceUrl, {
          headers: {
            [secretHeader]: secret,
          },
        });
        latencyResponse = await response.json();
      }

      const { records: _, ...latencyData } = latencyResponse;

      // TODO: Maybe remove or add to actual contract
      (latencyData as Record<string, unknown>).cached = false;

      const cachedLatencyResponse: CachedLatencyResponse = {
        time: now,
        is_updating: false,
        response: latencyData,
      };

      const queueWriteMessage: QueueMessage = {
        nonce: crypto.randomUUID(),
        serviceOp: `${service}:write`,
        measurement: latencyData.latencies.write,
      };
      const queueReadMessage: QueueMessage = {
        nonce: crypto.randomUUID(),
        serviceOp: `${service}:read`,
        measurement: latencyData.latencies.read,
      };

      const finalResult = await db
        .atomic()
        .check({ key: serviceCachedKey, versionstamp: result.versionstamp })
        .set(serviceCachedKey, cachedLatencyResponse)
        .set([newMeasurementNonceKey, queueWriteMessage.nonce], true)
        .set([newMeasurementNonceKey, queueReadMessage.nonce], true)
        .enqueue(queueWriteMessage)
        .enqueue(queueReadMessage)
        .commit();

      if (finalResult.ok) {
        return cachedLatencyResponse;
      }
    }

    serviceCachedResponse = await db.get<CachedLatencyResponse>(
      serviceCachedKey,
    );
  }
}

const secret = config.DENO_KV_FRONTEND_SECRET!;
const secretHeader = config.DENO_KV_FRONTEND_SECRET_HEADER!;

const db = await Deno.openKv();

export const handler: Handlers = {
  async GET(_req: Request, _ctx: HandlerContext) {
    const latencyDataRequests = Object
      .entries(config.backend_service_urls || {})
      .map(async ([service, url]) => {
        const cachedResponseKey = [cachedRequestKey, service];
        const cachedResponse = await db.get<CachedLatencyResponse>(
          cachedResponseKey,
        );

        if (!checkStaleCache(service, cachedResponse.value?.time ?? null)) {
          // TODO: Maybe remove or add to actual contract
          const latencyResponse = cachedResponse.value?.response;
          ((latencyResponse || {}) as Record<string, unknown>).cached = true;
          return [service, latencyResponse] as ServiceLatencyData;
        }

        const newCachedResponse = await setNewCachedResponse(
          service,
          url,
          cachedResponseKey,
          cachedResponse,
          db,
        );

        return [service, newCachedResponse.response] as ServiceLatencyData;
      });

    let latencyData: Record<string, LatencyOnlyResponse>;
    try {
      latencyData = Object.fromEntries(
        await Promise.all(latencyDataRequests),
      );
    } catch (error) {
      console.error("Failed to get latency requests", error);
      return new Response(
        JSON.stringify({
          error: "failed",
        }),
        { status: 500 },
      );
    }

    const quantileData = await quantile(db);
    const responseData: LatencySummaryResponse = {
      currentRequestLatencies: latencyData,
      percentileData: quantileData,
    };

    return new Response(JSON.stringify(responseData), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  },
};
