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
    <h3 class="text-base lg:text-xl mt-2 lg:mt-6 mb-3 ml-2 pl-5 lg:pl0 text-blue-500 font-bold">
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

  // This is a hack to put these styles end of the
  // page just to increase their specificity due to
  // some odd bug in twind or Fresh that doesn't
  // include them
  const endPageStyles = String.raw`
    @media (min-width: 768px) {
      .md\:flex {
        display: flex;
      }

      .md\:hidden {
        display: none;
      }

      .md\:text-center {
        text-align: center;
      }
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
          <div class="flex flex-col md:flex-row pt-2 md:pt-0 justify-start text-white max-w-screen-xl w-full">
            <KVGraphic />
            <h1 class="text-center text-3xl md:text-4xl px-2 md:px-0 font-thin md:-ml-8 mt-4 mb-4 md:my-0 self-center">
              Deno KV Live Latency Comparison
            </h1>
          </div>
        </header>
        <div class="max-w-screen-xl text-xl w-full mx-auto mt-0 md:mt-10 py-5 md:py-10 px-5 md:px-10 bg-gray-500 text-white">
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
        <div class="max-w-screen-xl w-full mx-auto mt-0 md:mt-10 h-full flex flex-col xl:flex-row text-white">
          <h2 class="py-5 flex flex-row justify-center md:justify-start items-center sm:text-left pl-5 md:pl-10 lg:pr-7 text-xl bg-gray-800 whitespace-nowrap">
            <span>
              Current Request
              <span class="text-opacity-75">
                <span class="hidden xl:inline">{" "}→</span>
                <span class="hidden sm:inline xl:hidden relative top-0.5">{" "}↴</span>
              </span>
            </span>
          </h2>
          <CurrentRequest />
        </div>
        <div class="max-w-screen-xl w-full mx-auto h-full py-5 md:py-10 mb-0 md:mb-10 px-0 lg:px-5 md:px-10 bg-gray-100">
          <div class="text-xl">
            <h2 class="text-2xl lg:text-3xl pl-5 lg:pl0">Read Latency</h2>

            <PercentileHeader>50th percentile</PercentileHeader>
            <div class="border-t-2 border-b-2 md:border-2 border-gray-200 md:rounded-lg bg-white p-5">
              <ReadWriteLatencies percentile="50" operation="read" />
            </div>

            <PercentileHeader>99th percentile</PercentileHeader>
            <div class="border-t-2 border-b-2 md:border-2 border-gray-200 md:rounded-lg bg-white p-5">
              <ReadWriteLatencies percentile="99" operation="read" />
            </div>

            <PercentileHeader>99.9th percentile</PercentileHeader>
            <div class="border-t-2 border-b-2 md:border-2 border-gray-200 md:rounded-lg bg-white p-5">
              <ReadWriteLatencies percentile="99.9" operation="read" />
            </div>

            <h2 class="text-2xl lg:text-3xl mt-10 pl-5 lg:pl0">Write Latency</h2>

            <PercentileHeader>50th percentile</PercentileHeader>
            <div class="border-t-2 border-b-2 md:border-2 border-gray-200 md:rounded-lg bg-white p-5">
              <ReadWriteLatencies percentile="50" operation="write" />
            </div>

            <PercentileHeader>99th percentile</PercentileHeader>
            <div class="border-t-2 border-b-2 md:border-2 border-gray-200 md:rounded-lg bg-white p-5">
              <ReadWriteLatencies percentile="99" operation="write" />
            </div>

            <PercentileHeader>99.9th percentile</PercentileHeader>
            <div class="border-t-2 border-b-2 md:border-2 border-gray-200 md:rounded-lg bg-white p-5">
              <ReadWriteLatencies percentile="99.9" operation="write" />
            </div>

            <p class="mt-5 text-sm text-gray-400">
              {"* "}
              {"Due to Cloudflare KV's heavy caching and eventual consistency, it isn't well suited for this test at lower intervals."}
              {" In this test Cloudflare KV is cached with a longer expiration time than the other services, which causes the smaller sample sizes."}
            </p>
          </div>
        </div>
      </main>
      <style>{endPageStyles}</style>
    </>
  );
}
