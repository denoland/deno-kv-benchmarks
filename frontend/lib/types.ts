import type { QuantileCalculations } from "./utils.ts";

export type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};

export type LatencyResponse = {
  latencies: {
    read: number;
    write: number;
  };
  records: GithubRepoRecord[];
};

export type LatencyOnlyResponse = Omit<LatencyResponse, "records">;

export type LatencySummaryResponse = {
  currentRequestLatencies: Record<string, LatencyOnlyResponse>;
  percentileData: QuantileCalculations;
}

export type CachedLatencyResponse = {
  time: number;
  is_updating: boolean;
  response: LatencyOnlyResponse;
};
