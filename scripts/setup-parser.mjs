import { ensureDirExists, parserDir, ensureParserVenv, installParserDeps } from "./lib.mjs";

await (async function main() {
  ensureDirExists(parserDir, "parser");
  await ensureParserVenv();
  await installParserDeps();
})();
