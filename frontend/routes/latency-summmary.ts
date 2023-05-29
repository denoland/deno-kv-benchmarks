import { HandlerContext, Handlers } from "$fresh/server.ts";
import { config } from "../lib/config.ts";
import { LatencyResponse, LatencyOnlyResponse } from "../lib/types.ts";

const secret = config.DENO_KV_FRONTEND_SECRET!;
const secretHeader = config.DENO_KV_FRONTEND_SECRET_HEADER!;

export const handler: Handlers = {
  async GET(_req: Request, _ctx: HandlerContext) {
    const latencyDataRequests = Object
      .entries(config.backend_service_urls || {})
      .filter(([service]) => service !== "cloudflarekv")
      .map(async ([service, url]) => {
        const response = await fetch(url, {
          headers: {
            [secretHeader]: secret,
          },
        });
        const { records: _, ...latencyData }: LatencyResponse = await response.json();
        return [service, latencyData];
      });

    const latencyData: Record<string, LatencyOnlyResponse> = Object.fromEntries(await Promise.all(latencyDataRequests));
    return new Response(JSON.stringify(latencyData), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  },
};
