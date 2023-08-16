import { config } from "./config.ts";

let tlsCert = "";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const combinedHeaderAndSecret =
  `${config.DENO_KV_FRONTEND_SECRET_HEADER}: ${config.DENO_KV_FRONTEND_SECRET}`;
const encodedHeaderAndSecret = encoder.encode(combinedHeaderAndSecret);

export async function makeDenoDeployRequest(url: string) {
  try {
    if (!tlsCert) {
      const tlsCertUrl =
        `http://${config.region_proxy_ip}:8089/deno/kv-bench/secret/${config.DENO_KV_FRONTEND_SECRET_HEADER}/${config.DENO_KV_FRONTEND_SECRET}/${config.region_proxy_ip}`;
      const response = await fetch(tlsCertUrl);
      tlsCert = await response.text();
    }

    const conn = await Deno.connectTls({
      hostname: config.region_proxy_ip,
      port: 8989,
      caCerts: [tlsCert],
    });

    const requestBuffer = encoder.encode(url);
    const requestSizeBuffer = new Uint32Array(1);
    requestSizeBuffer[0] = requestBuffer.length;
    await conn.write(encodedHeaderAndSecret);
    await conn.write(new Uint8Array(requestSizeBuffer.buffer));
    await conn.write(requestBuffer);

    const responseSizeBuffer = new Uint32Array(1);
    await conn.read(new Uint8Array(responseSizeBuffer.buffer));

    const responseSize = responseSizeBuffer[0];
    const chunkSize = 2048;
    const chunks: { buf: Uint8Array; size: number }[] = [];
    let readTotal = 0;

    while (readTotal < responseSize) {
      const chunkBuffer = new Uint8Array(chunkSize);
      const readBytes = await conn.read(chunkBuffer);
      if (readBytes) {
        chunks.push({ buf: chunkBuffer, size: readBytes });
        readTotal += readBytes;
      }
    }

    const responseBuffer = new Uint8Array(responseSize);
    let cursorPosition = 0;
    for (const { buf, size } of chunks) {
      responseBuffer.set(buf.subarray(0, size), cursorPosition);
      cursorPosition += size;
    }

    const response = JSON.parse(decoder.decode(responseBuffer));
    return response as string;
  } catch (error) {
    console.error("failed to initiate TCP connection", error);
    throw error;
  }
}
