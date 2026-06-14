import { attachProcessCleanup, ensureParserVenv, ensureDirExists, forwardChildExit, parserDir, startParserProd } from "./lib.mjs";

await ensureDirExists(parserDir, "parser");
await ensureParserVenv();

const parser = startParserProd();
attachProcessCleanup([parser]);
forwardChildExit(parser, "parser prod");
