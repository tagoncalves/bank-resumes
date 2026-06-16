import path from "path";
import { readPayslipPdf, readPendingPayslipPdf, readStatementPdf } from "@/lib/statement-pdf";

export function isPdfFilename(rawFilename?: string | null) {
  return path.extname(rawFilename ?? "").toLowerCase() === ".pdf";
}

export function readTrainingSourcePdf(sourceType: string, id: string, rawFilename?: string | null): Buffer {
  if (sourceType === "PAYSLIP") {
    try {
      return readPayslipPdf(id, rawFilename);
    } catch {
      return readPendingPayslipPdf(id, rawFilename);
    }
  }

  if (sourceType === "STATEMENT") {
    return readStatementPdf(id);
  }

  throw new Error("Tipo de fuente inválido");
}
