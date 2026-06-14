import { attachProcessCleanup, configureDefaultEnv, ensureDirExists, forwardChildExit, startWebDev, webDir } from "./lib.mjs";

ensureDirExists(webDir, "web");
configureDefaultEnv();

const web = startWebDev();
attachProcessCleanup([web]);
forwardChildExit(web, "web dev");
