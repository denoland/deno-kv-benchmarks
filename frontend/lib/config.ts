import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.187.0/path/mod.ts";

const configFile = "config.json";
const configPath = join(dirname(fromFileUrl(import.meta.url)), configFile);
const ratelimits: Config["backend_service_ratelimit"] = {
  denokv: 15e3,
  upstashredis: 15e3,
  dynamodb: 15e3,
  firestore: 15e3,
  cloudflarekv: 65e3, // 1 minute, due to limitations wrt using CF KV for this benchmark
};

async function getConfig(): Promise<Config> {
  const config: Config = { backend_service_ratelimit: ratelimits };
  try {
    return Object.assign(
      config,
      JSON.parse(await Deno.readTextFile(configPath)),
    );
  } catch (_error) {
    return config;
  }
}

export type Config = {
  DENO_KV_FRONTEND_SECRET?: string;
  DENO_KV_FRONTEND_SECRET_HEADER?: string;
  region_proxy_ip?: string;
  backend_service_urls?: {
    denokv: string;
    upstashredis: string;
    dynamodb: string;
    firestore: string;
    cloudflarekv: string;
  };
  /**
   * Rate limits measured in milliseconds
   */
  backend_service_ratelimit: {
    denokv: number;
    upstashredis: number;
    dynamodb: number;
    firestore: number;
    cloudflarekv: number;
  };
};

export const config = await getConfig();
