import { IS_BROWSER } from "$fresh/runtime.ts";
import { useState } from "preact/hooks";
import { latencyData, loadLatencyData } from "../lib/latency-data.ts";

export default function WriteLatencies() {
  const [count, setCount] = useState(0);

  if (IS_BROWSER) {
    if (!latencyData.value) {
      loadLatencyData();
    }
  }

  return (
    <div>
      Counter is at {count}.{" "}
      <br />
      Latency Data says: {JSON.stringify(latencyData.value || {})}
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}
