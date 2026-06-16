import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "statements");
const IMPORT_JOB_UPLOADS_DIR = path.join(process.cwd(), "uploads", "import-jobs");
const PAYSLIP_UPLOADS_DIR = path.join(process.cwd(), "uploads", "payslips");
const PENDING_PAYSLIP_UPLOADS_DIR = path.join(PAYSLIP_UPLOADS_DIR, "pending");

const SUPPORTED_PAYSLIP_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"] as const;

function getPayslipStoredExtension(rawFilename?: string | null) {
  const ext = path.extname(rawFilename ?? "").toLowerCase();
  return SUPPORTED_PAYSLIP_EXTENSIONS.includes(ext as (typeof SUPPORTED_PAYSLIP_EXTENSIONS)[number]) ? ext : ".pdf";
}

function findPayslipFile(baseDir: string, payslipId: string, rawFilename?: string | null): string | null {
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

export function saveStatementPdf(statementId: string, buffer: Buffer) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, `${statementId}.pdf`), buffer);
  } catch {
    // non-fatal
  }
}

export function readStatementPdf(statementId: string): Buffer {
  const filePath = path.join(UPLOADS_DIR, `${statementId}.pdf`);

  if (!fs.existsSync(filePath)) {
    throw new Error("PDF no disponible para reproceso");
  }

  return fs.readFileSync(filePath);
}

export function saveImportJobPdf(jobId: string, buffer: Buffer) {
  try {
    fs.mkdirSync(IMPORT_JOB_UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(IMPORT_JOB_UPLOADS_DIR, `${jobId}.pdf`), buffer);
  } catch {
    // non-fatal
  }
}

export function readImportJobPdf(jobId: string): Buffer {
  const filePath = path.join(IMPORT_JOB_UPLOADS_DIR, `${jobId}.pdf`);

  if (!fs.existsSync(filePath)) {
    throw new Error("PDF no disponible para el job de importación");
  }

  return fs.readFileSync(filePath);
}

export function savePayslipPdf(payslipId: string, buffer: Buffer, rawFilename?: string | null) {
  try {
    fs.mkdirSync(PAYSLIP_UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(PAYSLIP_UPLOADS_DIR, `${payslipId}${getPayslipStoredExtension(rawFilename)}`), buffer);
  } catch {
    // non-fatal
  }
}

export function readPayslipPdf(payslipId: string, rawFilename?: string | null): Buffer {
  const filePath = findPayslipFile(PAYSLIP_UPLOADS_DIR, payslipId, rawFilename);
  const pendingFilePath = findPayslipFile(PENDING_PAYSLIP_UPLOADS_DIR, payslipId, rawFilename);

  if (!filePath) {
    if (!pendingFilePath) {
      throw new Error("Archivo no disponible para el recibo");
    }

    return fs.readFileSync(pendingFilePath);
  }

  return fs.readFileSync(filePath);
}

export function savePendingPayslipPdf(payslipId: string, buffer: Buffer, rawFilename?: string | null) {
  try {
    fs.mkdirSync(PENDING_PAYSLIP_UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(PENDING_PAYSLIP_UPLOADS_DIR, `${payslipId}${getPayslipStoredExtension(rawFilename)}`), buffer);
  } catch {
    // non-fatal
  }
}

export function readPendingPayslipPdf(payslipId: string, rawFilename?: string | null): Buffer {
  const filePath = findPayslipFile(PENDING_PAYSLIP_UPLOADS_DIR, payslipId, rawFilename);

  if (!filePath) {
    throw new Error("Archivo pendiente no disponible para el recibo");
  }

  return fs.readFileSync(filePath);
}
