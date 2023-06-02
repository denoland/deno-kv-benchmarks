import { HandlerContext, Handlers } from "$fresh/server.ts";
import { config } from "../lib/config.ts";
import { LatencySummaryResponse, LatencyResponse, LatencyOnlyResponse } from "../lib/types.ts";
import { measurementKey, measurementReadKey, measurementWriteKey } from "../lib/constants.ts";
import { quantile } from "../lib/utils.ts";

const secret = config.DENO_KV_FRONTEND_SECRET!;
const secretHeader = config.DENO_KV_FRONTEND_SECRET_HEADER!;

const db = await Deno.openKv();

export const handler: Handlers = {
  async GET(_req: Request, _ctx: HandlerContext) {
    const queryTime = new Date().getTime();
    const writePromises: Promise<unknown>[] = [];
    // const atomicDataInsertion = db.atomic(); // This doesn't work with
    // `.list()` when testing locally unfortunately
    const latencyDataRequests = Object
      .entries(config.backend_service_urls || {})
      // TODO: REMOVE THIS FOR CLOUDFLARE KV TO WORK
      .filter(([service]) => service !== "cloudflarekv")
      .map(async ([service, url]) => {
        const response = await fetch(url, {
          headers: {
            [secretHeader]: secret,
          },
        });
        const { records: _, ...latencyData }: LatencyResponse = await response.json();
        writePromises.push(db.set([measurementKey, measurementReadKey, queryTime, service], latencyData.latencies.read));
        writePromises.push(db.set([measurementKey, measurementWriteKey, queryTime, service], latencyData.latencies.write));
        return [service, latencyData] as [string, typeof latencyData];
      });

    // await atomicDataInsertion.commit();
    await Promise.all(writePromises);

    const latencyData: Record<string, LatencyOnlyResponse> = Object.fromEntries(await Promise.all(latencyDataRequests));

    // This is just dummy data when you don't want to
    // actually hit the endpoints, say during development.
    // It can be removed.
    // const latencyData = {
    //   denokv: {
    //     latencies: {
    //       read: Math.floor(Math.random() * 1000),
    //       write: Math.floor(Math.random() * 1000),
    //     },
    //   },
    //   upstashredis: {
    //     latencies: {
    //       read: Math.random() * 1000,
    //       write: Math.random() * 1000,
    //     },
    //   },
    //   dynamodb: {
    //     latencies: {
    //       read: Math.random() * 1000,
    //       write: Math.random() * 1000,
    //     },
    //   },
    //   firestore: {
    //     latencies: {
    //       read: Math.random() * 1000,
    //       write: Math.random() * 1000,
    //     },
    //   },
    //   cloudflarekv: {
    //     latencies: {
    //       read: Math.random() * 1000,
    //       write: Math.random() * 1000,
    //     },
    //   },
    // };

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
