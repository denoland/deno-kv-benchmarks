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
