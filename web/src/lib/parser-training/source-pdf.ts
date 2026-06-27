import path from "path";
import { readPayslipPdf, readPendingPayslipPdf, readStatementPdf } from "@/lib/statement-pdf";

export function isPdfFilename(rawFilename?: string | null) {
  return path.extname(rawFilename ?? "").toLowerCase() === ".pdf";
}

export function readTrainingSourcePdf(sourceType: string, id: string, rawFilename?: string | null, storedFilename?: string | null): Buffer {
  if (sourceType === "PAYSLIP") {
    try {
      return readPayslipPdf(id, rawFilename, storedFilename);
    } catch {
      return readPendingPayslipPdf(id, rawFilename, storedFilename);
    }
  }

  if (sourceType === "STATEMENT") {
    return readStatementPdf(id, storedFilename);
  }

  throw new Error("Tipo de fuente inválido");
}
