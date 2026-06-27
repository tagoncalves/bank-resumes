import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "statements");
const IMPORT_JOB_UPLOADS_DIR = path.join(process.cwd(), "uploads", "import-jobs");
const PAYSLIP_UPLOADS_DIR = path.join(process.cwd(), "uploads", "payslips");
const PENDING_PAYSLIP_UPLOADS_DIR = path.join(PAYSLIP_UPLOADS_DIR, "pending");

const SUPPORTED_PAYSLIP_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"] as const;

function getPayslipStoredExtension(rawFilename?: string | null) {
  const ext = path.extname(rawFilename ?? "").toLowerCase();
  return SUPPORTED_PAYSLIP_EXTENSIONS.includes(ext as (typeof SUPPORTED_PAYSLIP_EXTENSIONS)[number]) ? ext : ".pdf";
}

function sanitizePathFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function slugFilenamePart(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "sin_dato";
}

export function createStoredFilename(rawFilename?: string | null, fallbackExtension = ".pdf") {
  const rawExt = path.extname(rawFilename ?? "").toLowerCase();
  const ext = rawExt || fallbackExtension;
  return `${randomUUID()}${ext}`;
}

export function buildDownloadFilename(input: {
  bankName?: string | null;
  type: "resumen" | "recibo";
  period?: string | Date | null;
  username?: string | null;
  extension?: string | null;
}) {
  const period = input.period instanceof Date
    ? `${input.period.getUTCFullYear()}-${String(input.period.getUTCMonth() + 1).padStart(2, "0")}`
    : slugFilenamePart(input.period).replace(/_/g, "-");
  const ext = input.extension?.startsWith(".") ? input.extension : `.${input.extension ?? "pdf"}`;
  return `${slugFilenamePart(input.bankName)}_${input.type}_${period}_${slugFilenamePart(input.username)}${ext}`;
}

function findPayslipFile(baseDir: string, payslipId: string, rawFilename?: string | null, storedFilename?: string | null): string | null {
  if (storedFilename) {
    const stored = path.join(baseDir, sanitizePathFilename(storedFilename));
    if (fs.existsSync(stored)) {
      return stored;
    }
  }

  const preferred = path.join(baseDir, `${payslipId}${getPayslipStoredExtension(rawFilename)}`);
  if (fs.existsSync(preferred)) {
    return preferred;
  }

  for (const ext of SUPPORTED_PAYSLIP_EXTENSIONS) {
    const candidate = path.join(baseDir, `${payslipId}${ext}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function getPayslipContentType(rawFilename?: string | null) {
  switch (getPayslipStoredExtension(rawFilename)) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "application/pdf";
  }
}

export function getPayslipFileExtension(rawFilename?: string | null, storedFilename?: string | null) {
  return path.extname(storedFilename ?? "") || getPayslipStoredExtension(rawFilename);
}

export function saveStatementPdf(statementId: string, buffer: Buffer, storedFilename?: string | null) {
  const filename = storedFilename ? sanitizePathFilename(storedFilename) : `${statementId}.pdf`;
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  } catch {
    // non-fatal
  }
  return filename;
}

export function readStatementPdf(statementId: string, storedFilename?: string | null): Buffer {
  const filePath = storedFilename
    ? path.join(UPLOADS_DIR, sanitizePathFilename(storedFilename))
    : path.join(UPLOADS_DIR, `${statementId}.pdf`);

  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }

  const fallbackPath = path.join(UPLOADS_DIR, `${statementId}.pdf`);
  if (!fs.existsSync(fallbackPath)) {
    throw new Error("PDF no disponible para reproceso");
  }

  return fs.readFileSync(fallbackPath);
}

export function saveImportJobPdf(jobId: string, buffer: Buffer, storedFilename?: string | null) {
  const filename = storedFilename ? sanitizePathFilename(storedFilename) : `${jobId}.pdf`;
  try {
    fs.mkdirSync(IMPORT_JOB_UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(IMPORT_JOB_UPLOADS_DIR, filename), buffer);
  } catch {
    // non-fatal
  }
  return filename;
}

export function readImportJobPdf(jobId: string, storedFilename?: string | null): Buffer {
  const filePath = storedFilename
    ? path.join(IMPORT_JOB_UPLOADS_DIR, sanitizePathFilename(storedFilename))
    : path.join(IMPORT_JOB_UPLOADS_DIR, `${jobId}.pdf`);

  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }

  const fallbackPath = path.join(IMPORT_JOB_UPLOADS_DIR, `${jobId}.pdf`);
  if (!fs.existsSync(fallbackPath)) {
    throw new Error("PDF no disponible para el job de importación");
  }

  return fs.readFileSync(fallbackPath);
}

export function savePayslipPdf(payslipId: string, buffer: Buffer, rawFilename?: string | null, storedFilename?: string | null) {
  const filename = storedFilename ? sanitizePathFilename(storedFilename) : `${payslipId}${getPayslipStoredExtension(rawFilename)}`;
  try {
    fs.mkdirSync(PAYSLIP_UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(PAYSLIP_UPLOADS_DIR, filename), buffer);
  } catch {
    // non-fatal
  }
  return filename;
}

export function readPayslipPdf(payslipId: string, rawFilename?: string | null, storedFilename?: string | null): Buffer {
  const filePath = findPayslipFile(PAYSLIP_UPLOADS_DIR, payslipId, rawFilename, storedFilename);
  const pendingFilePath = findPayslipFile(PENDING_PAYSLIP_UPLOADS_DIR, payslipId, rawFilename, storedFilename);

  if (!filePath) {
    if (!pendingFilePath) {
      throw new Error("Archivo no disponible para el recibo");
    }

    return fs.readFileSync(pendingFilePath);
  }

  return fs.readFileSync(filePath);
}

export function savePendingPayslipPdf(payslipId: string, buffer: Buffer, rawFilename?: string | null, storedFilename?: string | null) {
  const filename = storedFilename ? sanitizePathFilename(storedFilename) : `${payslipId}${getPayslipStoredExtension(rawFilename)}`;
  try {
    fs.mkdirSync(PENDING_PAYSLIP_UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(PENDING_PAYSLIP_UPLOADS_DIR, filename), buffer);
  } catch {
    // non-fatal
  }
  return filename;
}

export function readPendingPayslipPdf(payslipId: string, rawFilename?: string | null, storedFilename?: string | null): Buffer {
  const filePath = findPayslipFile(PENDING_PAYSLIP_UPLOADS_DIR, payslipId, rawFilename, storedFilename);

  if (!filePath) {
    throw new Error("Archivo pendiente no disponible para el recibo");
  }

  return fs.readFileSync(filePath);
}
