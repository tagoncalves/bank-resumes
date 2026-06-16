"use client"

import { useMemo, useRef, useState, useCallback } from "react"

interface Selection {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Props {
  sourceType: string
  sourceId: string
  pdfUrl: string
  pages: Array<{ pageNumber: number; width: number; height: number }>
  onSelection: (selection: {
    pageNumber: number
    x0: number
    top: number
    x1: number
    bottom: number
    rawText: string
  }) => void | Promise<void>
  onPageChange?: (page: number) => void
}

export default function PdfViewer({ sourceType, sourceId, pdfUrl, pages, onSelection, onPageChange }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [selectionStart, setSelectionStart] = useState<Selection | null>(null)
  const [loadingImage, setLoadingImage] = useState(true)
  const [useNativePdfViewer, setUseNativePdfViewer] = useState(false)

  const page = useMemo(
    () => pages.find((item) => item.pageNumber === currentPage) ?? pages[0] ?? null,
    [currentPage, pages],
  )

  const imageUrl = useMemo(() => {
    if (!page) return ""
    return `/api/admin/ai-parsers/training/page-image/${sourceType}/${sourceId}/${page.pageNumber}`
  }, [page, sourceType, sourceId])

  const nativePdfUrl = useMemo(() => {
    if (!page) return pdfUrl
    return `${pdfUrl}#page=${page.pageNumber}&toolbar=0&navpanes=0&scrollbar=0&view=FitH`
  }, [page, pdfUrl])

  const getOverlayPoint = useCallback((clientX: number, clientY: number) => {
    if (!overlayRef.current) return { x: 0, y: 0 }
    const rect = overlayRef.current.getBoundingClientRect()

    return {
      x: Math.max(0, Math.min(clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(clientY - rect.top, rect.height)),
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!page || loadingImage) return
    const pos = getOverlayPoint(e.clientX, e.clientY)
    setSelectionStart({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y })
    setSelection({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y })
    setIsSelecting(true)
  }, [getOverlayPoint, loadingImage, page])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !selectionStart) return
    const pos = getOverlayPoint(e.clientX, e.clientY)
    setSelection({
      x0: Math.min(selectionStart.x0, pos.x),
      y0: Math.min(selectionStart.y0, pos.y),
      x1: Math.max(selectionStart.x0, pos.x),
      y1: Math.max(selectionStart.y0, pos.y),
    })
  }, [getOverlayPoint, isSelecting, selectionStart])

  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !selection || !page || !overlayRef.current) {
      setIsSelecting(false)
      setSelectionStart(null)
      return
    }

    const rect = overlayRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      setIsSelecting(false)
      setSelectionStart(null)
      return
    }

    const scaleX = page.width / rect.width
    const scaleY = page.height / rect.height
    const x0 = selection.x0 * scaleX
    const x1 = selection.x1 * scaleX
    const top = page.height - selection.y0 * scaleY
    const bottom = page.height - selection.y1 * scaleY

    void onSelection({
      pageNumber: page.pageNumber,
      x0,
      x1,
      top,
      bottom,
      rawText: "",
    })

    setIsSelecting(false)
    setSelectionStart(null)
  }, [isSelecting, onSelection, page, selection])

  const goToPage = (pageNumber: number) => {
    if (pageNumber < 1 || pageNumber > pages.length) return
    setCurrentPage(pageNumber)
    setSelection(null)
    setSelectionStart(null)
    setLoadingImage(true)
    onPageChange?.(pageNumber)
  }

  if (!page) {
    return <div className="text-sm text-red-600">No se pudo cargar la vista previa del PDF.</div>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
        >
          Anterior
        </button>
        <span>
          Página {currentPage} de {pages.length}
        </span>
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= pages.length}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>

      {loadingImage && <div className="text-gray-500">Cargando vista del PDF...</div>}

      <div className="relative overflow-hidden rounded border bg-white" style={{ maxWidth: "100%" }}>
        {useNativePdfViewer ? (
          <iframe
            src={nativePdfUrl}
            title={`Página ${page.pageNumber} del PDF`}
            className="block w-full border-0"
            style={{ aspectRatio: `${page.width} / ${page.height}` }}
            onLoad={() => setLoadingImage(false)}
          />
        ) : (
          <img
            src={imageUrl}
            alt={`Página ${page.pageNumber} del PDF`}
            className="block w-full h-auto select-none"
            onLoad={() => setLoadingImage(false)}
            onError={() => {
              setUseNativePdfViewer(true)
              setLoadingImage(true)
            }}
            draggable={false}
          />
        )}

        <div
          ref={overlayRef}
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsSelecting(false)
            setSelectionStart(null)
          }}
        >
          {selection && (
            <div
              className="pointer-events-none absolute border-2 border-blue-500 bg-blue-100/30"
              style={{
                left: selection.x0,
                top: selection.y0,
                width: selection.x1 - selection.x0,
                height: selection.y1 - selection.y0,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
