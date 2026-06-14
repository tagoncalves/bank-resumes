import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, "..");
export const webDir = path.join(rootDir, "web");
export const parserDir = path.join(rootDir, "parser");
export const isWindows = process.platform === "win32";

export function parserVenvDir() {
  return path.join(parserDir, ".venv");
}

export function parserVenvPython() {
  return isWindows
    ? path.join(parserVenvDir(), "Scripts", "python.exe")
    : path.join(parserVenvDir(), "bin", "python");
}

export function npmCommand() {
  return isWindows ? "npm.cmd" : "npm";
}

export function npxCommand() {
  return isWindows ? "npx.cmd" : "npx";
}

export function ensureDirExists(dirPath, label) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Falta el directorio ${label}`);
  }
}

export function configureDefaultEnv() {
  process.env.DATABASE_URL ||= "file:./prisma/dev.db";
  process.env.PARSER_SERVICE_URL ||= "http://localhost:8001";
  process.env.WORKER_SHARED_SECRET ||= "dev-worker-secret";
}

export function spawnCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    ...options,
    env: { ...process.env, ...options.env },
  });

  return child;
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, options);

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} falló${signal ? ` por señal ${signal}` : ` con código ${code}`}`));
    });
  });
}

export function npmInvocation(args = []) {
  if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...args],
    };
  }

  return {
    command: npmCommand(),
    args,
  };
}

export async function runNpm(args, options = {}) {
  const invocation = npmInvocation(args);
  await runCommand(invocation.command, invocation.args, options);
}

export function startNpm(args, options = {}) {
  const invocation = npmInvocation(args);
  return spawnCommand(invocation.command, invocation.args, options);
}

export async function resolveSystemPython() {
  for (const candidate of [isWindows ? "python" : "python3", "python", "py"]) {
    if (!candidate) continue;
    try {
      const version = await captureCommand(candidate, ["--version"]);
      if (version.ok) {
        return candidate;
      }
    } catch {
      // continue
    }
  }

  throw new Error("No se encontró Python 3.10+ en PATH");
}

export function captureCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
      env: { ...process.env, ...options.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({ ok: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

export async function ensureParserVenv() {
  if (fs.existsSync(parserVenvPython())) {
    return;
  }

  const systemPython = await resolveSystemPython();
  console.log("Creando entorno virtual del parser...");
  await runCommand(systemPython, ["-m", "venv", parserVenvDir()], { cwd: parserDir });
}

export async function installParserDeps() {
  console.log("Instalando dependencias del parser...");
  await runCommand(parserVenvPython(), ["-m", "pip", "install", "-r", path.join(parserDir, "requirements.txt")], {
    cwd: parserDir,
  });
}

export async function installWebDeps() {
  console.log("Instalando dependencias de la web...");
  await runNpm(["--prefix", webDir, "install"]);
}

export async function prepareWebDb() {
  console.log("Sincronizando base de datos...");
  await runNpm(["--prefix", webDir, "run", "db:push"]);

  console.log("Cargando datos base...");
  await runNpm(["--prefix", webDir, "run", "db:seed"]);
}

export async function bootstrapStack() {
  ensureDirExists(parserDir, "parser");
  ensureDirExists(webDir, "web");
  configureDefaultEnv();
  await ensureParserVenv();
  await installParserDeps();
  await installWebDeps();
  await prepareWebDb();
}

export function startParserDev() {
  return spawnCommand(
    npxCommand(),
    [
      "--yes",
      "nodemon",
      "--watch",
      parserDir,
      "--ext",
      "py",
      "--exec",
      `\"${parserVenvPython()}\" -m uvicorn main:app --port 8001`,
    ],
    { cwd: parserDir, shell: true }
  );
}

export function startParserProd() {
  return spawnCommand(parserVenvPython(), ["-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"], {
    cwd: parserDir,
  });
}

export function startWebDev() {
  return startNpm(["--prefix", webDir, "run", "dev"]);
}

export function startWebProd() {
  return startNpm(["--prefix", webDir, "run", "start"]);
}

export function startAIWorker() {
  return spawnCommand(process.execPath, [path.join(rootDir, "scripts", "run-ai-worker.mjs")], {
    cwd: rootDir,
  });
}

export async function buildWeb() {
  console.log("Compilando web...");
  await runNpm(["--prefix", webDir, "run", "build"]);
}

export async function waitForParserHealth(url = "http://localhost:8001/health", attempts = 30) {
  console.log("Esperando healthcheck del parser...");

  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }

    await sleep(1000);
  }

  throw new Error(`El parser no respondió en ${url}`);
}

export function attachProcessCleanup(processes) {
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;

    for (const child of processes) {
      if (child && !child.killed) {
        child.kill("SIGTERM");
      }
    }
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  process.on("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });

  process.on("exit", cleanup);
}

export function forwardChildExit(child, label, siblings = []) {
  child.on("exit", (code, signal) => {
    for (const sibling of siblings) {
      if (sibling && !sibling.killed) {
        sibling.kill("SIGTERM");
      }
    }

    if (signal) {
      process.exit(1);
      return;
    }

    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    console.error(`${label}: ${error.message}`);
    for (const sibling of siblings) {
      if (sibling && !sibling.killed) {
        sibling.kill("SIGTERM");
      }
    }
    process.exit(1);
  });
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseNodeMajor(versionText) {
  const match = /^v(\d+)/.exec(versionText.trim());
  return match ? Number(match[1]) : null;
}

export function parsePythonVersion(versionText) {
  const match = /Python\s+(\d+)\.(\d+)/i.exec(versionText.trim());
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : null;
}

export function portInUse(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    const onClose = () => resolve(false);
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", onClose);
    socket.connect(port, "127.0.0.1");
  });
}
