/**
 * PdfViewer — renders a PDF using PDF.js loaded via CDN (window.pdfjsLib).
 * The script tag in index.html loads:
 *   https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
 * which exposes window.pdfjsLib.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import type { Annotation } from "../../lib/api"

const PDFJS_WORKER_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"

// ── types ──────────────────────────────────────────────────────────────────
interface PDFPageProxy {
  getViewport: (opts: { scale: number }) => PDFViewport
  render: (ctx: RenderContext) => RenderTask
}
interface PDFViewport { width: number; height: number }
interface RenderContext { canvasContext: CanvasRenderingContext2D; viewport: PDFViewport }
interface RenderTask { promise: Promise<void>; cancel: () => void }
interface PDFDocumentProxy {
  numPages: number
  getPage: (n: number) => Promise<PDFPageProxy>
}
interface PdfjsLib {
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PDFDocumentProxy> }
  GlobalWorkerOptions: { workerSrc: string }
}

declare global {
  interface Window { pdfjsLib?: PdfjsLib }
}

// ── helpers ────────────────────────────────────────────────────────────────
function getPdfjsLib(): PdfjsLib | null {
  return (window as Window).pdfjsLib ?? null
}

export interface SelectionInfo {
  text: string
  x: number   // normalised 0-1 relative to canvas width
  y: number   // normalised 0-1 relative to canvas height
  width: number
  height: number
}

interface PdfViewerProps {
  url: string
  authHeaders: Record<string, string>
  currentPage: number
  scale?: number
  onLoad?: (totalPages: number) => void
  onTextSelect?: (page: number, info: SelectionInfo) => void
  annotations?: Annotation[]
  onAnnotationClick?: (annotation: Annotation) => void
}

// ── component ──────────────────────────────────────────────────────────────
export function PdfViewer({
  url,
  authHeaders,
  currentPage,
  scale = 1.4,
  onLoad,
  onTextSelect,
  annotations = [],
  onAnnotationClick,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })

  // ── load PDF whenever URL changes ─────────────────────────────────────
  useEffect(() => {
    if (!url) return
    let cancelled = false

    const load = async () => {
      setStatus("loading")
      setErrorMsg("")
      pdfRef.current = null

      // Wait for PDF.js to be ready (script might still be loading)
      let attempts = 0
      while (!getPdfjsLib() && attempts < 30) {
        await new Promise((r) => setTimeout(r, 200))
        attempts++
      }

      const lib = getPdfjsLib()
      if (!lib) {
        setErrorMsg("PDF.js n'est pas chargé. Vérifiez votre connexion internet.")
        setStatus("error")
        return
      }

      // Configure worker
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN

      try {
        // Fetch the PDF bytes with auth headers
        const res = await fetch(url, { headers: authHeaders })
        if (!res.ok) throw new Error(`Erreur HTTP ${res.status} lors du téléchargement du PDF.`)
        const data = await res.arrayBuffer()
        if (cancelled) return

        const pdf = await lib.getDocument({ data }).promise
        if (cancelled) return

        pdfRef.current = pdf
        onLoad?.(pdf.numPages)
        setStatus("ready")
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Impossible de charger le PDF."
          setErrorMsg(msg)
          setStatus("error")
        }
      }
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  // ── render current page ───────────────────────────────────────────────
  const renderPage = useCallback(async () => {
    const pdf = pdfRef.current
    const canvas = canvasRef.current
    if (!pdf || !canvas || status !== "ready") return

    // Cancel ongoing render
    renderTaskRef.current?.cancel()
    renderTaskRef.current = null

    try {
      const page = await pdf.getPage(currentPage)
      const viewport = page.getViewport({ scale })

      canvas.width = viewport.width
      canvas.height = viewport.height
      setCanvasSize({ w: viewport.width, h: viewport.height })

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const task = page.render({ canvasContext: ctx, viewport })
      renderTaskRef.current = task
      await task.promise
    } catch {
      // render cancelled — normal when switching pages quickly
    }
  }, [currentPage, scale, status])

  useEffect(() => { renderPage() }, [renderPage])

  // ── text selection ────────────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const text = sel.toString().trim()
    if (!text) return

    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const wrapRect = wrapperRef.current?.getBoundingClientRect()

    if (wrapRect && canvasSize.w > 0) {
      const x = Math.max(0, Math.min(1, (rect.left - wrapRect.left) / canvasSize.w))
      const y = Math.max(0, Math.min(1, (rect.top - wrapRect.top) / canvasSize.h))
      const w = Math.max(0.01, Math.min(1, rect.width / canvasSize.w))
      const h = Math.max(0.01, Math.min(1, rect.height / canvasSize.h))
      onTextSelect?.(currentPage, { text, x, y, width: w, height: h })
    } else {
      onTextSelect?.(currentPage, { text, x: 0.1, y: 0.1, width: 0.1, height: 0.05 })
    }

    sel.removeAllRanges()
  }, [currentPage, canvasSize, onTextSelect])

  // ── page annotations ──────────────────────────────────────────────────
  const pageAnnotations = annotations.filter((a) => a.page_number === currentPage)

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className="relative inline-block select-text" onMouseUp={handleMouseUp}>
      {/* Loading spinner */}
      {status === "loading" && (
        <div className="flex flex-col items-center justify-center gap-3 text-neutral-400 py-16 px-8 min-w-[440px]">
          <div className="w-10 h-10 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-body">Chargement du PDF…</p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center gap-3 text-center py-16 px-8 min-w-[440px] bg-red-50 rounded-lg">
          <p className="text-3xl">⚠️</p>
          <p className="text-sm text-red-700 font-body font-semibold">{errorMsg}</p>
          <p className="text-xs text-neutral-500 font-body">
            Seuls les fichiers PDF peuvent être prévisualisés directement.
          </p>
        </div>
      )}

      {/* PDF canvas */}
      <canvas
        ref={canvasRef}
        className={status === "ready" ? "block max-w-full shadow-sm" : "hidden"}
        style={{ cursor: "text" }}
      />

      {/* Annotation markers */}
      {status === "ready" && canvasSize.w > 0 && pageAnnotations.map((ann) => {
        if (ann.x == null || ann.y == null) return null
        return (
          <button
            key={ann.id}
            title={ann.content}
            onClick={() => onAnnotationClick?.(ann)}
            className="absolute z-10 w-6 h-6 rounded-full bg-yellow-400 border-2 border-yellow-600 shadow-md text-[11px] flex items-center justify-center hover:scale-125 transition-transform"
            style={{
              left: (ann.x * canvasSize.w) - 12,
              top: (ann.y * canvasSize.h) - 12,
            }}
          >
            💬
          </button>
        )
      })}
    </div>
  )
}
