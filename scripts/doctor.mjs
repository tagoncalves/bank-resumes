import fs from "node:fs";
import path from "node:path";
import {
  captureCommand,
  npmInvocation,
  parserDir,
  parserVenvPython,
  parseNodeMajor,
  parsePythonVersion,
  portInUse,
  rootDir,
  webDir,
} from "./lib.mjs";

const issues = [];
const minNodeMajor = 18;
const minPython = { major: 3, minor: 10 };

function logOk(message) {
  console.log(`[OK] ${message}`);
}

function logWarn(message) {
  console.log(`[WARN] ${message}`);
}

function logFail(message) {
  console.log(`[FAIL] ${message}`);
}

function logInfo(message) {
  console.log(`[INFO] ${message}`);
}

async function findPythonVersion() {
  for (const candidate of [process.platform === "win32" ? "python" : "python3", "python", "py"]) {
    try {
      const result = await captureCommand(candidate, ["--version"]);
      if (!result.ok) continue;
      const versionText = result.stdout || result.stderr;
      const parsed = parsePythonVersion(versionText);
      if (parsed) {
        return { command: candidate, versionText, parsed };
      }
    } catch {
      // continue
    }
  }

  return null;
}

console.log("== Bank Resumes Doctor ==");
console.log("");
console.log(`Repo: ${rootDir}`);
console.log("");

if (fs.existsSync(webDir)) logOk("Directorio web presente");
else {
  logFail("Falta directorio web");
  issues.push("Falta el directorio web");
}

if (fs.existsSync(parserDir)) logOk("Directorio parser presente");
else {
  logFail("Falta directorio parser");
  issues.push("Falta el directorio parser");
}

const nodeVersion = process.version;
const nodeMajor = parseNodeMajor(nodeVersion);
if (nodeMajor && nodeMajor >= minNodeMajor) {
  logOk(`Node disponible: ${nodeVersion}`);
} else {
  logFail(`Node insuficiente: ${nodeVersion}`);
  issues.push(`Actualizar Node.js a ${minNodeMajor}+ (actual: ${nodeVersion})`);
}

try {
  const invocation = npmInvocation(["--version"]);
  const npm = await captureCommand(invocation.command, invocation.args);
  if (npm.ok) logOk(`npm disponible: ${npm.stdout}`);
  else {
    logFail("npm no está disponible en PATH");
    issues.push("Instalar npm y agregarlo a PATH");
  }
} catch {
  logFail("npm no está disponible en PATH");
  issues.push("Instalar npm y agregarlo a PATH");
}

const python = await findPythonVersion();
if (!python) {
  logFail("Python no está disponible en PATH");
  issues.push("Instalar Python 3.10+ y exponer python o py en PATH");
} else if (
  python.parsed.major > minPython.major ||
  (python.parsed.major === minPython.major && python.parsed.minor >= minPython.minor)
) {
  logOk(`Python disponible: ${python.versionText}`);
} else {
  logFail(`Python insuficiente: ${python.versionText}`);
  issues.push(`Actualizar Python a ${minPython.major}.${minPython.minor}+ (actual: ${python.versionText})`);
}

if (fs.existsSync(parserVenvPython())) logOk("Virtualenv del parser presente");
else {
  logWarn("No existe parser/.venv");
  issues.push("Ejecutar npm run setup:parser");
}

if (fs.existsSync(path.join(webDir, "node_modules"))) logOk("Dependencias web instaladas");
else {
  logWarn("Faltan dependencias en web/node_modules");
  issues.push("Ejecutar npm run setup:web");
}

if (process.env.JWT_SECRET) logOk("JWT_SECRET definido en la sesión");
else logWarn("JWT_SECRET no está definido en la sesión actual");

if (process.env.DATABASE_URL) logOk(`DATABASE_URL definido: ${process.env.DATABASE_URL}`);
else logInfo("DATABASE_URL no está definido. Se usará el default local en los scripts raíz");

if (process.env.PARSER_SERVICE_URL) logOk(`PARSER_SERVICE_URL definido: ${process.env.PARSER_SERVICE_URL}`);
else logInfo("PARSER_SERVICE_URL no está definido. Se usará http://localhost:8001");

if (await portInUse(3000)) {
  logWarn("El puerto 3000 ya está en uso");
  issues.push("Liberar el puerto 3000 o cambiar el puerto de la web");
} else {
  logOk("Puerto 3000 disponible");
}

if (await portInUse(8001)) {
  logWarn("El puerto 8001 ya está en uso");
  issues.push("Liberar el puerto 8001 o cambiar el puerto del parser");
} else {
  logOk("Puerto 8001 disponible");
}

console.log("");

if (issues.length === 0) {
  console.log("Diagnóstico: OK");
  process.exit(0);
}

console.log("Diagnóstico: hay acciones pendientes");
for (const issue of issues) {
  console.log(`- ${issue}`);
}

process.exit(1);
