import { transpile } from "https://deno.land/x/emit@0.22.0/mod.ts";
import { fromFileUrl, toFileUrl, join, dirname, relative } from "https://deno.land/std@0.187.0/path/mod.ts";

const currentWorkingDirPath = dirname(fromFileUrl(import.meta.url));
const sourceDirPath = join(currentWorkingDirPath, "./src");
const buildDirPath = join(currentWorkingDirPath, "./build");
const entryPointPath = join(currentWorkingDirPath, "./src/index.ts");

await Deno.mkdir(buildDirPath, { recursive: true });
const result = await transpile(toFileUrl(entryPointPath));

for (const [fileUrl, transpiledSource] of Object.entries(result)) {
  const sourceFilePath = fromFileUrl(fileUrl);
  const relativePath = relative(sourceDirPath, sourceFilePath);
  const outFilePath = join(buildDirPath, relativePath.slice(0, -3) + ".js");
  await Deno.writeTextFile(outFilePath, transpiledSource);
}

console.log("Worker function bundle successful");
