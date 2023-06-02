import { IS_BROWSER } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";
import { latencyData, loadLatencyData } from "../lib/latency-data.ts";
import { measurementReadKey, measurementWriteKey, prettyServiceNames } from "../lib/constants.ts";
import { capitalize } from "../lib/utils.ts";
import type { Percentiles } from "../lib/utils.ts";

export type LatencyChartProps = {
  percentile: Percentiles;
  operation: typeof measurementReadKey | typeof measurementWriteKey;
}

function LoadingText({ children }: { children: ComponentChildren; }) {
  return (
    <span style={{opacity: 0.5}}><em>{children}</em></span>
  );
}

export default function LatencyChart(props: LatencyChartProps) {
  const id = `rw-${props.percentile}-${props.operation}`;

  if (!IS_BROWSER) {
    return (
      <LoadingText>Loading...</LoadingText>
    );
  }

  const latencyDataResponse = latencyData.value;
  if (!latencyDataResponse) {
    loadLatencyData();
    return (
      <LoadingText>Loading {props.operation} latency data...</LoadingText>
    );
  }

  const data: number[] = [];
  const labels: string[] = [];

  const serviceMeasurements = Object.entries(latencyDataResponse.percentileData[props.operation]);
  for (const [service, measurements] of serviceMeasurements) {
    data.push(Math.floor(measurements[props.percentile]));
    labels.push(prettyServiceNames[service as keyof typeof prettyServiceNames]);
  }

  const chartData = {
    name: `${capitalize(props.operation)} Latency`,
    data,
    labels,
  };

  if (!data.length) {
    return (
      <span>No data to display...</span>
    );
  }

  return (
    <>
      <div id={id} />
      <script
        id={`${id}-data`}
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(chartData) }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (() => {
              const deserialized = JSON.parse(document.getElementById("${id}-data").text);
              new ApexCharts(document.getElementById("${id}"), {
                chart: {
                  // height: 320,
                  height: 220,
                  type: "bar",
                  // toolbar: {
                  //   show: true,
                  // },
                  animations: { enabled: false },
                },
                series: [{
                  name: deserialized.name,
                  data: deserialized.data,
                }],
                // legend: {
                //   show: true,
                //   showForSingleSeries: true,
                //   position: "bottom",
                // },
                dataLabels: {
                  formatter: (value) => Math.floor(value) + "ms",
                  style: {
                    fontSize: "16px",
                  },
                  dropShadow: {
                      enabled: true,
                      top: 1,
                      left: 1,
                      blur: 2,
                      color: "#000",
                      opacity: 0.85
                  },
                },
                yaxis: {
                  labels: {
                    formatter: (value) => value + "ms",
                  },
                },
                xaxis: {
                  categories: deserialized.labels,
                  position: "bottom",
                  labels: {
                    show: true,
                  },
                  tooltip: {
                    enabled: false,
                  },
                },
              }).render();
            })();
          `,
        }}
      />
    </>
  );
}

