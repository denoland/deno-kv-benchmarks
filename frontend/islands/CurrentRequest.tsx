import { IS_BROWSER } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";
import { latencyData, loadLatencyData } from "../lib/latency-data.ts";
import { measurementReadKey, measurementWriteKey, prettyServiceNames } from "../lib/constants.ts";

function LoadingText({ children }: { children: ComponentChildren; }) {
  return (
    <span class="py-0 md:py-7" style={{opacity: 0.5}}><em>{children}</em></span>
  );
}

function Wrapper({ children, ready = false }: { children: ComponentChildren; ready?: boolean; }) {
  const bgClass = ready ? "bg-[#E8570C]" : "bg-gray-400";
  const verticalPadding = ready ? "pt-8 pb-10 md:py-5" : "py-7";
  return (
    <div class={`w-full flex flex-row flex-wrap lg:flex-nowrap ${verticalPadding} md:py-0 items-center justify-center ${bgClass}`}>
      {children}
    </div>
  );
}

export default function CurrentRequest() {
  if (!IS_BROWSER) {
    return (
      <Wrapper>
        <LoadingText>Loading...</LoadingText>
      </Wrapper>
    );
  }

  const latencyDataResponse = latencyData.value;
  if (!latencyDataResponse) {
    loadLatencyData();
    return (
      <Wrapper>
        <LoadingText>Loading current request...</LoadingText>
      </Wrapper>
    );
  }

  const latencyItems = Object.entries(latencyDataResponse.currentRequestLatencies);
  const latencyStripItems = latencyItems
    .map(([service, data]) => (
      <div class="md:flex hidden lg:min-w-0 min-w-[33.333%] sm:flex-grow lg:w-full lg:h-full flex-col items-center justify-center py-3 xl:py-0">
        <div class="text-left md:text-center">
          <h3 class="text-xs">{prettyServiceNames[service as keyof typeof prettyServiceNames]}</h3>
          <div class="text-base lg:text-sm">
            <span>Read <span class="font-bold">{Math.floor(data.latencies.read)}ms</span></span>
            <span class="md:inline hidden">{" | "}</span>
            <br class="block md:hidden" />
            <span>Write <span class="font-bold">{Math.floor(data.latencies.write)}ms</span></span>
          </div>
        </div>
      </div>
    ));
  const latencyTableRows = latencyItems
    .map(([service, data]) => (
      <tr class="border-b-1 border-white border-opacity-10 last:border-b-0">
        <td class="py-1 pl-5">{prettyServiceNames[service as keyof typeof prettyServiceNames]}</td>
        <td class="py-1 text-right"><span class="font-bold">{Math.floor(data.latencies.read)}ms</span></td>
        <td class="py-1 text-right pr-5"><span class="font-bold">{Math.floor(data.latencies.write)}ms</span></td>
      </tr>
    ));

  return (
    <>
      <Wrapper ready={true}>
        {latencyStripItems}
        <table class="table md:hidden w-full">
          <thead>
            <tr class="font-bold">
              <td class="py-2 border-b-1 border-white border-opacity-25 pl-5">Service</td>
              <td class="py-2 border-b-1 border-white border-opacity-25 text-right">Read Latency</td>
              <td class="py-2 border-b-1 border-white border-opacity-25 text-right pr-5">Write Latency</td>
            </tr>
          </thead>
          <tbody>
            {latencyTableRows}
          </tbody>
        </table>
      </Wrapper>
    </>
  );
}

