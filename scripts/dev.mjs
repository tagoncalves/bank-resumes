import {
  attachProcessCleanup,
  bootstrapStack,
  forwardChildExit,
  startAIWorker,
  startParserDev,
  startWebDev,
  waitForParserHealth,
} from "./lib.mjs";

await bootstrapStack();

const parser = startParserDev();
attachProcessCleanup([parser]);

try {
  await waitForParserHealth();
} catch (error) {
  parser.kill("SIGTERM");
  throw error;
}

const web = startWebDev();
const worker = startAIWorker();
attachProcessCleanup([parser, web, worker]);
forwardChildExit(parser, "parser dev", [web, worker]);
forwardChildExit(web, "web dev", [parser, worker]);
forwardChildExit(worker, "worker dev", [parser, web]);
