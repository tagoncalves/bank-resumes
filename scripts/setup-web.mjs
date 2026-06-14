import { ensureDirExists, webDir, configureDefaultEnv, installWebDeps, prepareWebDb } from "./lib.mjs";

await (async function main() {
  ensureDirExists(webDir, "web");
  configureDefaultEnv();
  await installWebDeps();
  await prepareWebDb();
})();
