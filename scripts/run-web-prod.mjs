import { attachProcessCleanup, configureDefaultEnv, ensureDirExists, forwardChildExit, startWebProd, webDir } from "./lib.mjs";

ensureDirExists(webDir, "web");
configureDefaultEnv();

const web = startWebProd();
attachProcessCleanup([web]);
forwardChildExit(web, "web prod");
