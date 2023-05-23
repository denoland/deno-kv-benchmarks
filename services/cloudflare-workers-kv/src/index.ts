/// <reference types="./cf-worker.d.ts" />

type Env = {
  deno_kv_ns: KVNamespace;
};

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const kvNs = env.deno_kv_ns?.list?.toString();
    const { url } = request;
    return new Response(`
      <h1>CF Workers Working</h1>
      <p>CF Workers KV is the next stop</p>
      <p>URL: <code>${url}</code></p>
      <p>KV Namespace: <code>${kvNs}</code></p>
    `, {
      headers: {
        "content-type": "text/html; charset=UTF-8",
      },
    });
  }
}
