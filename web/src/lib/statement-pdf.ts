import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "statements");
const IMPORT_JOB_UPLOADS_DIR = path.join(process.cwd(), "uploads", "import-jobs");
const PAYSLIP_UPLOADS_DIR = path.join(process.cwd(), "uploads", "payslips");
const PENDING_PAYSLIP_UPLOADS_DIR = path.join(PAYSLIP_UPLOADS_DIR, "pending");

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

export function savePayslipPdf(payslipId: string, buffer: Buffer) {
  try {
    fs.mkdirSync(PAYSLIP_UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(PAYSLIP_UPLOADS_DIR, `${payslipId}.pdf`), buffer);
  } catch {
    // non-fatal
  }
}

export function readPayslipPdf(payslipId: string): Buffer {
  const filePath = path.join(PAYSLIP_UPLOADS_DIR, `${payslipId}.pdf`);
  const pendingFilePath = path.join(PENDING_PAYSLIP_UPLOADS_DIR, `${payslipId}.pdf`);

  if (!fs.existsSync(filePath)) {
    if (!fs.existsSync(pendingFilePath)) {
      throw new Error("PDF no disponible para el recibo");
    }

    return fs.readFileSync(pendingFilePath);
  }

  return fs.readFileSync(filePath);
}

export function savePendingPayslipPdf(payslipId: string, buffer: Buffer) {
  try {
    fs.mkdirSync(PENDING_PAYSLIP_UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(PENDING_PAYSLIP_UPLOADS_DIR, `${payslipId}.pdf`), buffer);
  } catch {
    // non-fatal
  }
}

export function readPendingPayslipPdf(payslipId: string): Buffer {
  const filePath = path.join(PENDING_PAYSLIP_UPLOADS_DIR, `${payslipId}.pdf`);

  if (!fs.existsSync(filePath)) {
    throw new Error("PDF pendiente no disponible para el recibo");
  }

  return fs.readFileSync(filePath);
}
