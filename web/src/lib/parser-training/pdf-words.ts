import { getServerPdfStandardFontDataUrl, loadServerPdfJs } from "@/lib/pdfjs-server";

export interface WordWithPosition {
  text: string
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
}

export interface PageDimensions {
  pageNumber: number
  width: number
  height: number
}

export interface PdfWordExtraction {
  pages: PageDimensions[]
  words: WordWithPosition[]
}

export async function extractPdfPageDimensions(buffer: Buffer): Promise<PageDimensions[]> {
  const mod = await loadServerPdfJs()
  const { getDocument } = mod

  const pdfData = new Uint8Array(buffer)
  const doc = await getDocument({
    data: pdfData,
    standardFontDataUrl: getServerPdfStandardFontDataUrl(),
    disableWorker: true,
  } as any).promise

  const pages: PageDimensions[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    pages.push({
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
    })
    page.cleanup()
  }

  doc.cleanup()
  return pages
}

export async function extractWordsFromPdf(buffer: Buffer): Promise<PdfWordExtraction> {
  const mod = await loadServerPdfJs()
  const { getDocument } = mod

  const pdfData = new Uint8Array(buffer)
  const doc = await getDocument({
    data: pdfData,
    standardFontDataUrl: getServerPdfStandardFontDataUrl(),
    disableWorker: true,
  } as any).promise
  const pages: PageDimensions[] = []
  const words: WordWithPosition[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    pages.push({
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
    })

    const content = await page.getTextContent()
    for (const item of content.items) {
      if ("str" in item && item.str.trim()) {
        const tx = item.transform
        words.push({
          text: item.str,
          pageNumber: pageNum,
          x: tx[4],
          y: tx[5],
          width: item.width ?? 0,
          height: 0,
        })
      }
    }
  }

  return { pages, words }
}

function overlapsHorizontally(word: WordWithPosition, x0: number, x1: number) {
  const wordLeft = word.x
  const wordRight = word.x + word.width
  return wordLeft <= x1 && wordRight >= x0
}

function matchesVerticalBand(word: WordWithPosition, bottom: number, top: number, tolerance = 4) {
  return word.y >= bottom - tolerance && word.y <= top + tolerance
}

export function findWordsInRegion(
  words: WordWithPosition[],
  pageNumber: number,
  x0: number,
  top: number,
  x1: number,
  bottom: number,
): string[] {
  return words
    .filter(
      (w) =>
        w.pageNumber === pageNumber &&
        overlapsHorizontally(w, x0, x1) &&
        matchesVerticalBand(w, bottom, top),
    )
    .sort((a, b) => {
      const rowDiff = b.y - a.y
      if (Math.abs(rowDiff) > 5) return rowDiff
      return a.x - b.x
    })
    .map((w) => w.text)
}

export function findWordsRightOfLabel(
  words: WordWithPosition[],
  pageNumber: number,
  labelX0: number,
  labelTop: number,
  labelX1: number,
  labelBottom: number,
): string[] {
  const labelWords = words.filter(
    (w) =>
      w.pageNumber === pageNumber &&
      overlapsHorizontally(w, labelX0, labelX1) &&
      matchesVerticalBand(w, labelBottom, labelTop, 5),
  )

  if (labelWords.length === 0) return []

  const minY = Math.min(...labelWords.map((w) => w.y)) - 5
  const maxY = Math.max(...labelWords.map((w) => w.y)) + 5
  const rightEdge = Math.max(...labelWords.map((w) => w.x + w.width))

  return words
    .filter(
      (w) =>
        w.pageNumber === pageNumber &&
        w.x >= rightEdge &&
        w.y >= minY &&
        w.y <= maxY,
    )
    .sort((a, b) => {
      const rowDiff = b.y - a.y
      if (Math.abs(rowDiff) > 5) return rowDiff
      return a.x - b.x
    })
    .map((w) => w.text)
}
