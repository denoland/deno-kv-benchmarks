import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.187.0/path/mod.ts";

const configFile = "config.json";
const configPath = join(dirname(fromFileUrl(import.meta.url)), configFile);

async function getConfig(): Promise<Config> {
  try {
    return JSON.parse(await Deno.readTextFile(configPath));
  } catch (_error) {
    return {};
  }
}

export type Config = {
  DENO_KV_FRONTEND_SECRET?: string;
  DENO_KV_FRONTEND_SECRET_HEADER?: string;
};

export const config = await getConfig();
