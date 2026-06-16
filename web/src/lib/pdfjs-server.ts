import path from "path";
import { pathToFileURL } from "url";

type PdfJsModule = {
  getDocument: (params: unknown) => { promise: Promise<any> };
  GlobalWorkerOptions: { workerSrc: string };
};

let pdfJsPromise: Promise<PdfJsModule> | null = null;

const importAtRuntime = new Function("moduleUrl", "return import(moduleUrl);") as (
  moduleUrl: string,
) => Promise<PdfJsModule>;

export async function loadServerPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = (async () => {
      const pdfModulePath = path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs");
      const workerModulePath = path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
      const mod = await importAtRuntime(pathToFileURL(pdfModulePath).href);
      mod.GlobalWorkerOptions.workerSrc = pathToFileURL(workerModulePath).href;
      return mod as PdfJsModule;
    })();
  }

  return pdfJsPromise;
}

export function getServerPdfStandardFontDataUrl(): string {
  const fontsDir = path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts");
  return `${pathToFileURL(fontsDir).href}/`;
}
