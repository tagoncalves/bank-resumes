"use client"

import { use, useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import PdfViewer from "@/components/admin/parser-training/pdf-viewer"
import FieldPanel from "@/components/admin/parser-training/field-panel"
import TestResults from "@/components/admin/parser-training/test-results"
import type { TestResultItem } from "@/components/admin/parser-training/test-results"

interface TrainingContext {
  sourceType: string
  id: string
  rawFilename: string
  processingStatus: string
  employerName?: string | null
  employeeName?: string | null
  periodLabel?: string | null
  payDate?: string | null
  netAmount?: number | null
  grossAmount?: number | null
  anchors: AnchorData[]
  approvedParser?: unknown | null
  pages: { pageNumber: number; width: number; height: number }[]
}

interface AnchorData {
  id: string
  fieldName: string
  pageNumber: number
  x0: number
  top: number
  x1: number
  bottom: number
  mode: string
  rawText: string | null
  confirmedText: string | null
  labelText: string | null
  updatedAt: string
}

interface CurrentSelection {
  pageNumber: number
  x0: number
  top: number
  x1: number
  bottom: number
  rawText: string
}

export default function ParserTrainingPage({
  params,
}: {
  params: Promise<{ sourceType: string; id: string }>
}) {
  const { sourceType, id } = use(params)
  const router = useRouter()
  const [context, setContext] = useState<TrainingContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [currentSelection, setCurrentSelection] = useState<CurrentSelection | null>(null)
  const [confirmedText, setConfirmedText] = useState("")
  const [saving, setSaving] = useState(false)
  const [testResults, setTestResults] = useState<TestResultItem[]>([])
  const [allPassed, setAllPassed] = useState(false)
  const [approving, setApproving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [extractingSelection, setExtractingSelection] = useState(false)

  const fetchContext = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/admin/ai-parsers/training/context/${sourceType}/${id}`)
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${r.status}`)
      }
      const data: TrainingContext = await r.json()
      setContext(data)
      setTestResults([])
      setAllPassed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar contexto")
    } finally {
      setLoading(false)
    }
  }, [sourceType, id])

  useEffect(() => {
    fetchContext()
  }, [fetchContext])

  const handleSelectField = useCallback(
    (fieldName: string) => {
      setSelectedField(fieldName)
      const existing = context?.anchors.find((a) => a.fieldName === fieldName)
      if (existing) {
        setCurrentSelection({
          pageNumber: existing.pageNumber,
          x0: existing.x0,
          top: existing.top,
          x1: existing.x1,
          bottom: existing.bottom,
          rawText: existing.rawText ?? "",
        })
        setConfirmedText(existing.confirmedText ?? existing.rawText ?? "")
      } else {
        setConfirmedText("")
      }
    },
    [context],
  )

  const handleSelection = useCallback(
    async (selection: {
      pageNumber: number
      x0: number
      top: number
      x1: number
      bottom: number
      rawText: string
    }) => {
      setExtractingSelection(true)
      setCurrentSelection({ ...selection, rawText: "" })

      try {
        const response = await fetch(`/api/admin/ai-parsers/training/extract-region/${sourceType}/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageNumber: selection.pageNumber,
            x0: selection.x0,
            top: selection.top,
            x1: selection.x1,
            bottom: selection.bottom,
            mode: "region_exact",
          }),
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error ?? "No se pudo extraer texto de la región")
        }

        const data = await response.json()
        const rawText = typeof data.rawText === "string" ? data.rawText.trim() : ""

        setCurrentSelection({ ...selection, rawText })
        if (rawText) {
          setConfirmedText(rawText)
        }
      } catch (e) {
        setCurrentSelection({ ...selection, rawText: "" })
        setError(e instanceof Error ? e.message : "Error al extraer texto de la región")
      } finally {
        setExtractingSelection(false)
      }
    },
    [sourceType, id],
  )

  const handleSaveAnchor = useCallback(async () => {
    if (!selectedField || !currentSelection || !confirmedText.trim()) return

    setSaving(true)
    setMessage(null)

    const existingAnchor = context?.anchors.find((a) => a.fieldName === selectedField)

    try {
      const r = await fetch("/api/admin/ai-parsers/training/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: existingAnchor?.id,
          sourceType,
          sourceId: id,
          fieldName: selectedField,
          pageNumber: currentSelection.pageNumber,
          x0: currentSelection.x0,
          top: currentSelection.top,
          x1: currentSelection.x1,
          bottom: currentSelection.bottom,
          mode: "region_exact",
          rawText: currentSelection.rawText,
          confirmedText: confirmedText.trim(),
        }),
      })

      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? "Error al guardar")
      }

      await fetchContext()
      setMessage(`"${selectedField}" guardado`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }, [selectedField, currentSelection, confirmedText, sourceType, id, context, fetchContext])

  const handleGenerateAndTest = useCallback(async () => {
    setGenerating(true)
    setError(null)
    setMessage(null)

    try {
      const r = await fetch(`/api/admin/ai-parsers/training/generate/${sourceType}/${id}`, {
        method: "POST",
      })

      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? "Error al generar parser")
      }

      const data = await r.json()
      setTestResults(data.testResult.testResults)
      setAllPassed(data.testResult.allPassed)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar parser")
    } finally {
      setGenerating(false)
    }
  }, [sourceType, id])

  const handleApprove = useCallback(async () => {
    setApproving(true)
    setError(null)
    setMessage(null)

    try {
      const r = await fetch(`/api/admin/ai-parsers/training/approve/${sourceType}/${id}`, {
        method: "POST",
      })

      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? "Error al aprobar parser")
      }

      setMessage("Parser aprobado y recibo procesado exitosamente")
      setTimeout(() => router.push("/admin/review-statements"), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al aprobar parser")
    } finally {
      setApproving(false)
    }
  }, [sourceType, id, router])

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando contexto de entrenamiento...</div>
  }

  if (error && !context) {
    return <div className="p-6 text-red-600">Error: {error}</div>
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Entrenar Parser</h1>
          <p className="text-sm text-gray-500">
            {context?.rawFilename} — Estado: {context?.processingStatus}
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/review-statements")}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
        >
          Volver
        </button>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-sm">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PdfViewer
            sourceType={sourceType}
            sourceId={id}
            pdfUrl={`/api/admin/ai-parsers/training/pdf/${id}`}
            pages={context?.pages ?? []}
            onSelection={handleSelection}
          />
        </div>

        <div>
          <FieldPanel
            selectedField={selectedField}
            onSelectField={handleSelectField}
            anchors={context?.anchors ?? []}
            currentRawText={currentSelection?.rawText ?? null}
            confirmedText={confirmedText}
            onConfirmedTextChange={setConfirmedText}
            onSave={handleSaveAnchor}
            saving={saving || extractingSelection}
            extractingSelection={extractingSelection}
          />

          {(context?.anchors?.length ?? 0) > 0 && (
            <div className="mt-4">
              <button
                onClick={handleGenerateAndTest}
                disabled={generating}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {generating ? "Generando..." : "Generar y Probar Parser"}
              </button>
            </div>
          )}
        </div>
      </div>

      {testResults.length > 0 && (
        <div className="mt-6 max-w-2xl">
          <TestResults
            results={testResults}
            allPassed={allPassed}
            onApprove={handleApprove}
            approving={approving}
          />
        </div>
      )}
    </div>
  )
}
