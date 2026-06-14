import { attachProcessCleanup, ensureParserVenv, ensureDirExists, forwardChildExit, parserDir, startParserDev } from "./lib.mjs";

await ensureDirExists(parserDir, "parser");
await ensureParserVenv();

const parser = startParserDev();
attachProcessCleanup([parser]);
forwardChildExit(parser, "parser dev");
