import fs from "node:fs";
import path from "node:path";
import { configureDefaultEnv, prepareWebDb, webDir } from "./lib.mjs";

await (async function main() {
  configureDefaultEnv();

  const dbPath = path.join(webDir, "prisma", "dev.db");
  const dbJournalPath = path.join(webDir, "prisma", "dev.db-journal");

  if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });
  if (fs.existsSync(dbJournalPath)) fs.rmSync(dbJournalPath, { force: true });

  console.log("Base local reiniciada.");
  await prepareWebDb();
})();
