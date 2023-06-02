import { Head } from "$fresh/runtime.ts";
import { asset } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";
import { KVGraphic } from "../components/KvGraphic.tsx";
import ReadWriteLatencies from "../islands/ReadWriteLatencies.tsx";
import CurrentRequest from "../islands/CurrentRequest.tsx";

function Link({ children, url }: { children: ComponentChildren; url: string; }) {
  return (
    <a class="text-underline" href={url}>
      {children}
    </a>
  );
}

function PercentileHeader({ children }: { children: ComponentChildren; }) {
  return (
    <h3 class="text-xl mt-6 mb-3 ml-2 text-blue-500 font-bold">
      — {children}
    </h3>
  );
}

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
        <script src={asset("/vendor/apexcharts.js")} />
      </Head>
      <main class="flex flex-col w-full">
        <header class="bg-gray-900 flex flex-row justify-center py-5">
          <div class="flex flex-row justify-start text-white max-w-screen-xl w-full">
            <KVGraphic />
            <h1 class="text-center text-4xl font-thin -ml-8 self-center">
              Deno KV Live Latency Comparison
            </h1>
          </div>
        </header>
        <div class="max-w-screen-xl text-xl w-full mx-auto mt-10 py-10 px-10 bg-gray-500 text-white">
          <p>
            There are five databases tested here: <Link url="https://deno.com/kv">Deno KV</Link>,{" "}
            <Link url="https://upstash.com/redis">Upstash Redis</Link>,{" "}
            <Link url="https://aws.amazon.com/dynamodb/global-tables/">AWS DynamoDB Global Tables</Link>,{" "}
            <Link url="https://firebase.google.com/docs/firestore">Firestore</Link>,{" "}
            and <Link url="https://www.cloudflare.com/products/workers-kv/">Cloudflare Workers KV</Link>.
          </p>
          <p class="mt-5">
            We have inserted 14,275 records into each database. Each record is Github repo metadata
            obtained from the <Link url="https://docs.github.com/en/rest">Github API</Link> using the
            search endpoint, which was used to list the most popular repositories across a few
            select categories. Each database has an index on the <code class="font-bold">forks_count</code>{" "}
            field.
          </p>
        </div>
        <div class="max-w-screen-xl w-full mx-auto mt-10 h-full flex flex-row text-white">
          <h2 class="py-5 pl-10 pr-7 text-xl bg-gray-800 whitespace-nowrap">Current Request ➝</h2>
          <div class="w-full flex flex-row items-center justify-center bg-gray-400">
            <CurrentRequest />
          </div>
        </div>
        <div class="max-w-screen-xl w-full mx-auto h-full py-10 mb-10 px-10 bg-gray-100">
          <div class="text-xl">
            <h2 class="text-3xl">Read Latency</h2>

            <PercentileHeader>50th percentile</PercentileHeader>
            <div class="border-2 border-gray-200 rounded-lg bg-white p-5">
              <ReadWriteLatencies percentile="50" operation="read" />
            </div>

            <PercentileHeader>99th percentile</PercentileHeader>
            <div class="border-2 border-gray-200 rounded-lg bg-white p-5">
              <ReadWriteLatencies percentile="99" operation="read" />
            </div>

            <PercentileHeader>99.9th percentile</PercentileHeader>
            <div class="border-2 border-gray-200 rounded-lg bg-white p-5">
              <ReadWriteLatencies percentile="99.9" operation="read" />
            </div>

            <h2 class="text-3xl mt-10">Write Latency</h2>

            <PercentileHeader>50th percentile</PercentileHeader>
            <div class="border-2 border-gray-200 rounded-lg bg-white p-5">
              <ReadWriteLatencies percentile="50" operation="write" />
            </div>

            <PercentileHeader>99th percentile</PercentileHeader>
            <div class="border-2 border-gray-200 rounded-lg bg-white p-5">
              <ReadWriteLatencies percentile="99" operation="write" />
            </div>

            <PercentileHeader>99.9th percentile</PercentileHeader>
            <div class="border-2 border-gray-200 rounded-lg bg-white p-5">
              <ReadWriteLatencies percentile="99.9" operation="write" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
