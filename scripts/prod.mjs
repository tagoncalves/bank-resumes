import {
  attachProcessCleanup,
  bootstrapStack,
  buildWeb,
  forwardChildExit,
  startAIWorker,
  startParserProd,
  startWebProd,
  waitForParserHealth,
} from "./lib.mjs";

await bootstrapStack();
await buildWeb();

const parser = startParserProd();
attachProcessCleanup([parser]);

try {
  await waitForParserHealth();
} catch (error) {
  parser.kill("SIGTERM");
  throw error;
}

const web = startWebProd();
const worker = startAIWorker();
attachProcessCleanup([parser, web, worker]);
forwardChildExit(parser, "parser prod", [web, worker]);
forwardChildExit(web, "web prod", [parser, worker]);
forwardChildExit(worker, "worker prod", [parser, web]);
