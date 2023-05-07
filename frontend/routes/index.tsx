import { Head } from "$fresh/runtime.ts";
import { KVGraphic } from "../components/KvGraphic.tsx";

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
        <title>Deno Databases</title>
        <link rel="icon" href="/favicon.svg"/>
        <style>{baseStyles}</style>
      </Head>
      <main class="bg-gray-900 flex flex-col text-white w-full">
        <h1 class="text-center text-3xl my-10 font-bold">
          Deno KV v. Other Serverless Databases
        </h1>
        <p>
          <KVGraphic />
        </p>
      </main>
    </>
  );
}
