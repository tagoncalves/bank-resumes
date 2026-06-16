import type { WordWithPosition } from "./pdf-words"
import { findWordsInRegion, findWordsRightOfLabel } from "./pdf-words"

export interface TrainingAnchor {
  id?: string
  fieldName: string
  pageNumber: number
  x0: number
  top: number
  x1: number
  bottom: number
  mode: string
  rawText?: string | null
  confirmedText?: string | null
  labelText?: string | null
}

export interface ParserTestResult {
  fieldName: string
  expected: string | null
  extracted: string | null
  passed: boolean
  normalizedExpected?: string | null
  normalizedExtracted?: string | null
}

export interface ParserOutput {
  fields: Record<string, string | null>
  testResults: ParserTestResult[]
  allPassed: boolean
}

function normalizeString(val: string): string {
  return val.trim().replace(/\s+/g, " ").toUpperCase()
}

function normalizeMoney(val: string): string {
  const cleaned = val
    .replace(/[^0-9.,]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
  const num = parseFloat(cleaned)
  return isNaN(num) ? val : num.toFixed(2)
}

function normalizeDate(val: string): string {
  const cleaned = val.trim()
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  ]
  for (const fmt of formats) {
    const m = cleaned.match(fmt)
    if (m) {
      const [, d, mo, y] = m
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
    }
  }
  return val.trim()
}

function normalizeByFieldType(fieldName: string, val: string): string {
  if (fieldName === "net_amount_ars" || fieldName === "gross_amount_ars") {
    return normalizeMoney(val)
  }
  if (fieldName === "pay_date") {
    return normalizeDate(val)
  }
  return normalizeString(val)
}

function extractField(
  words: WordWithPosition[],
  anchor: TrainingAnchor,
): string | null {
  if (anchor.mode === "region_exact") {
    const found = findWordsInRegion(
      words,
      anchor.pageNumber,
      anchor.x0,
      anchor.top,
      anchor.x1,
      anchor.bottom,
    )
    if (found.length === 0) return null
    return found.join(" ")
  }

  if (anchor.mode === "right_of_label") {
    const found = findWordsRightOfLabel(
      words,
      anchor.pageNumber,
      anchor.x0,
      anchor.top,
      anchor.x1,
      anchor.bottom,
    )
    if (found.length === 0) return null
    return found.join(" ")
  }

  return null
}

export function runDeterministicParser(
  words: WordWithPosition[],
  anchors: TrainingAnchor[],
): ParserOutput {
  const fields: Record<string, string | null> = {}
  const testResults: ParserTestResult[] = []

  for (const anchor of anchors) {
    const extracted = extractField(words, anchor)
    fields[anchor.fieldName] = extracted

    let passed = false
    if (anchor.confirmedText && extracted) {
      const normExpected = normalizeByFieldType(anchor.fieldName, anchor.confirmedText)
      const normExtracted = normalizeByFieldType(anchor.fieldName, extracted)
      passed = normExpected === normExtracted
    } else if (!anchor.confirmedText) {
      passed = true
    }

    testResults.push({
      fieldName: anchor.fieldName,
      expected: anchor.confirmedText ?? null,
      extracted,
      passed,
      normalizedExpected: anchor.confirmedText ? normalizeByFieldType(anchor.fieldName, anchor.confirmedText) : null,
      normalizedExtracted: extracted ? normalizeByFieldType(anchor.fieldName, extracted) : null,
    })
  }

  const allPassed = testResults.length > 0 && testResults.every((r) => r.passed)

  return { fields, testResults, allPassed }
}
