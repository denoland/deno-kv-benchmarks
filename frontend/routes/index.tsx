import { Head } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";
import { KVGraphic } from "../components/KvGraphic.tsx";
import WriteLatencies from "../islands/WriteLatencies.tsx";

function Link({ children, url }: { children: ComponentChildren; url: string; }) {
  return (
    // <a class="text-underline" href="https://docs.github.com/en/rest">
    <a class="text-underline" href={url}>
      {children}
    </a>
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
            search endpoint that just listed the most popular repositories across a few categories. Each
            database sorts the articles by the <code class="font-bold">forks_count</code> field.
          </p>
        </div>
        <div class="max-w-screen-xl w-full mx-auto mt-10 h-full py-10 px-10 bg-gray-100">
          <div class="text-xl">
            <h2 class="text-3xl">Read Latency</h2>
            <p>numbers...</p>
            <h2 class="text-3xl mt-4">Write Latency</h2>
            <p>
              <div><WriteLatencies /></div>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
