import { Head } from "$fresh/runtime.ts";
import { KVGraphic } from "../components/KvGraphic.tsx";
import WriteLatencies from "../islands/WriteLatencies.tsx";

export default function Home() {
  const baseStyles = `
    html, body {
      display: flex;
      min-width: 100%;
      min-height: 100%;
    }

    body {
      margin: 0;
    }
  `;

  return (
    <>
      <Head>
        <title>Deno KV Latency Comparison</title>
        <link rel="icon" href="/favicon.svg"/>
        <style>{baseStyles}</style>
      </Head>
      <main class="flex flex-col w-full">
        <header class="bg-gray-900 flex flex-row justify-center">
          <div class="flex flex-row justify-start text-white max-w-screen-xl w-full">
            <KVGraphic />
            <h1 class="text-center text-4xl font-thin -ml-8 self-center">
              Deno KV Live Latency Comparison
            </h1>
          </div>
        </header>
        <div class="max-w-screen-xl w-full mx-auto h-full py-10 px-10 bg-gray-100">
          <div class="text-xl">
            <h2 class="text-3xl">Read Latency</h2>
            <p>numbers...</p>
            <h2 class="text-3xl mt-4">Write Latency</h2>
            <p>
              <WriteLatencies />
              <span>idk</span>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
