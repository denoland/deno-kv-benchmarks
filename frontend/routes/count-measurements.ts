import { HandlerContext, Handlers } from "$fresh/server.ts";
import {
  measurementKey,
  measurementReadKey,
  measurementWriteKey,
} from "../lib/constants.ts";

const db = await Deno.openKv();

export const handler: Handlers = {
  async GET(_req: Request, _ctx: HandlerContext) {
    const total = {
      [measurementReadKey]: {} as Record<string, number[]>,
      [measurementWriteKey]: {} as Record<string, number[]>,
    };

    // TODO: Maybe put this behind a flag...
    // for await (const entry of db.list({ prefix: [measurementKey] })) {
    //   const [, readWrite, _time, service] = entry.key;
    //   total[readWrite as typeof measurementReadKey][service as string] ??= [];
    //   total[readWrite as typeof measurementReadKey][service as string].push(entry.value as number);
    // }

    return new Response(JSON.stringify(total), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  },
};
