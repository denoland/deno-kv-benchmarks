type TerraformState = {
  outputs: {
    [outputName: string]:
      | { value: string; type: "string" }
      | { value: number; type: "number" }
      | { value: boolean; type: "bool" }
      | { value: Record<string, unknown>; type: "object" };
  };
};

type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};
