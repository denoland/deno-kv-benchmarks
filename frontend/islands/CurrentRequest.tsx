import { IS_BROWSER } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";
import { latencyData, loadLatencyData } from "../lib/latency-data.ts";
import { measurementReadKey, measurementWriteKey, prettyServiceNames } from "../lib/constants.ts";

function LoadingText({ children }: { children: ComponentChildren; }) {
  return (
    <span style={{opacity: 0.5}}><em>{children}</em></span>
  );
}

export default function CurrentRequest() {
  if (!IS_BROWSER) {
    return (
      <LoadingText>Loading...</LoadingText>
    );
  }

  const latencyDataResponse = latencyData.value;
  if (!latencyDataResponse) {
    loadLatencyData();
    return (
      <LoadingText>Loading current request...</LoadingText>
    );
  }

  const elements = Object
    .entries(latencyDataResponse.currentRequestLatencies)
    .map(([service, data]) => (
      <div class="w-full h-full flex flex-col items-center justify-center bg-[#E8570C] text-xs">
        <h3>{prettyServiceNames[service as keyof typeof prettyServiceNames]}</h3>
        <div class="text-sm">
          <span>Read <span class="font-bold">{Math.floor(data.latencies.read)}ms</span></span>
          {" | "}
          <span>Write <span class="font-bold">{Math.floor(data.latencies.write)}ms</span></span>
        </div>
      </div>
    ));

  return (
    <>
      {elements}
    </>
  );
}

