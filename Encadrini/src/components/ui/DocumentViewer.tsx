/**
 * DocumentViewer — affiche PDF et Word (.docx) page par page, fidèle à l'original.
 *
 * PDF  → PDF.js  (canvas, rendu exact)
 * DOCX → docx-preview (rendu HTML fidèle : polices, tableaux, images, pages séparées)
 *
 * Pour naviguer entre pages DOCX : scroll vers .docx-page:nth-child(N)
 */

import { useEffect, useRef, useState, useCallback } from "react"
import type { Annotation } from "../../lib/api"

// ── types PDF.js ─────────────────────────────────────────────────────────────
interface PDFPageProxy {
  getViewport: (opts: { scale: number }) => { width: number; height: number }
  render: (ctx: {
    canvasContext: CanvasRenderingContext2D
    viewport: { width: number; height: number }
  }) => { promise: Promise<void>; cancel: () => void }
}
interface PDFDocumentProxy {
  numPages: number
  getPage: (n: number) => Promise<PDFPageProxy>
}
interface PdfjsLib {
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PDFDocumentProxy> }
  GlobalWorkerOptions: { workerSrc: string }
}

// ── types docx-preview ────────────────────────────────────────────────────────
interface DocxLib {
  renderAsync: (
    data: ArrayBuffer,
    bodyContainer: HTMLElement,
    styleContainer?: HTMLElement | null,
    options?: Record<string, unknown>
  ) => Promise<unknown>
}

declare global {
  interface Window {
    pdfjsLib?: PdfjsLib
    docx?: DocxLib
  }
}

const PDFJS_WORKER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"

export interface SelectionInfo {
  text: string
  x: number
  y: number
  width: number
  height: number
}

interface DocumentViewerProps {
  url: string
  authHeaders: Record<string, string>
  mimeType?: string
  fileName?: string
  currentPage: number
  scale?: number
  onLoad?: (totalPages: number) => void
  onTextSelect?: (page: number, info: SelectionInfo) => void
  annotations?: Annotation[]
  onAnnotationClick?: (annotation: Annotation) => void
}

// ── helpers ───────────────────────────────────────────────────────────────────
function detectType(mimeType?: string, fileName?: string): "pdf" | "docx" | "unknown" {
  const mime = (mimeType ?? "").toLowerCase()
  const name = (fileName ?? "").toLowerCase()
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf"
  if (
    mime.includes("wordprocessingml") ||
    mime === "application/msword" ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  )
    return "docx"
  return "unknown"
}

async function waitForGlobal<T>(getter: () => T | undefined, maxMs = 10000): Promise<T | null> {
  const step = 250
  let elapsed = 0
  while (elapsed < maxMs) {
    const val = getter()
    if (val) return val
    await new Promise((r) => setTimeout(r, step))
    elapsed += step
  }
  return null
}

// Scroll vers la page N dans le conteneur docx-preview
function scrollDocxToPage(container: HTMLElement, pageIndex: number) {
  const pages = container.querySelectorAll<HTMLElement>(".docx-wrapper > section, .docx-page, article")
  const target = pages[pageIndex - 1]
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" })
  }
}

// Compter les pages dans un rendu docx-preview
function countDocxPages(container: HTMLElement): number {
  const selectors = [".docx-wrapper > section", ".docx-page", "article"]
  for (const sel of selectors) {
    const count = container.querySelectorAll(sel).length
    if (count > 0) return count
  }
  return 1
}

// ── component ─────────────────────────────────────────────────────────────────
export function DocumentViewer({
  url,
  authHeaders,
  mimeType,
  fileName,
  currentPage,
  scale = 1.4,
  onLoad,
  onTextSelect,
  annotations = [],
  onAnnotationClick,
}: DocumentViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const docxBodyRef = useRef<HTMLDivElement>(null)
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const renderTaskRef = useRef<{ cancel?: () => void } | null>(null)

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [docType, setDocType] = useState<"pdf" | "docx" | "unknown">("unknown")
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const [docxTotalPages, setDocxTotalPages] = useState(1)
  const [retryKey, setRetryKey] = useState(0)

  // ── charger le document ──────────────────────────────────────────────────
  useEffect(() => {
    if (!url) return
    let cancelled = false

    const load = async () => {
      setStatus("loading")
      setErrorMsg("")
      pdfRef.current = null

      const type = detectType(mimeType, fileName)
      setDocType(type)

      if (type === "unknown") {
        setErrorMsg("Format non supporté. Téléchargez le fichier pour le consulter.")
        setStatus("error")
        return
      }

      try {
        const res = await fetch(url, { headers: authHeaders })
        if (!res.ok) throw new Error(`Erreur ${res.status} lors du téléchargement.`)
        const data = await res.arrayBuffer()
        if (cancelled) return

        if (type === "pdf") {
          // ── PDF via PDF.js ──
          const lib = await waitForGlobal(() => window.pdfjsLib)
          if (!lib) throw new Error("PDF.js non chargé. Vérifiez votre connexion internet.")
          lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN

          const pdf = await lib.getDocument({ data }).promise
          if (cancelled) return
          pdfRef.current = pdf
          onLoad?.(pdf.numPages)
          setStatus("ready")
        } else {
          // ── DOCX via docx-preview ──
          const docxLib = await waitForGlobal(() => window.docx)
          if (!docxLib) throw new Error("docx-preview non chargé. Vérifiez votre connexion internet.")

          const container = docxBodyRef.current
          if (!container) return

          // Vider le conteneur avant de re-rendre
          container.innerHTML = ""

          await docxLib.renderAsync(data, container, null, {
            inWrapper: true,          // enveloppe chaque page dans une div
            ignoreWidth: false,       // respecter la largeur de page Word
            ignoreHeight: false,      // respecter la hauteur de page Word
            ignoreFonts: false,       // utiliser les polices du document
            breakPages: true,         // créer des éléments séparés par page
            useBase64URL: true,       // images en base64 (pas besoin de serveur)
            experimental: true,       // activer les fonctionnalités expérimentales
          })

          if (cancelled) return

          // Compter les pages rendues
          const pages = countDocxPages(container)
          setDocxTotalPages(pages)
          onLoad?.(pages)
          setStatus("ready")
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "Impossible de charger le document.")
          setStatus("error")
        }
      }
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, mimeType, fileName, retryKey])

  // ── navigation de page DOCX ───────────────────────────────────────────────
  useEffect(() => {
    if (docType !== "docx" || status !== "ready" || !docxBodyRef.current) return
    scrollDocxToPage(docxBodyRef.current, currentPage)
  }, [currentPage, docType, status])

  // ── rendu page PDF ────────────────────────────────────────────────────────
  const renderPage = useCallback(async () => {
    const pdf = pdfRef.current
    const canvas = canvasRef.current
    if (!pdf || !canvas || status !== "ready" || docType !== "pdf") return

    renderTaskRef.current?.cancel?.()
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
      // render annulé — normal lors du changement rapide de page
    }
  }, [currentPage, scale, status, docType])

  useEffect(() => { renderPage() }, [renderPage])

  // ── sélection de texte ────────────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const text = sel.toString().trim()
    if (!text) return

    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const wrapRect = wrapperRef.current?.getBoundingClientRect()

    const refW = canvasSize.w || wrapRect?.width || 600
    const refH = canvasSize.h || wrapRect?.height || 800

    if (wrapRect) {
      const x = Math.max(0, Math.min(1, (rect.left - wrapRect.left) / refW))
      const y = Math.max(0, Math.min(1, (rect.top - wrapRect.top) / refH))
      const w = Math.max(0.01, Math.min(1, rect.width / refW))
      const h = Math.max(0.01, Math.min(1, rect.height / refH))
      onTextSelect?.(currentPage, { text, x, y, width: w, height: h })
    } else {
      onTextSelect?.(currentPage, { text, x: 0.05, y: 0.1, width: 0.3, height: 0.05 })
    }

    sel.removeAllRanges()
  }, [currentPage, canvasSize, onTextSelect])

  // ── annotations (PDF = page courante, DOCX = toutes) ─────────────────────
  const pageAnnotations = annotations.filter((a) => a.page_number === currentPage)

  // ── rendu ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={wrapperRef}
      className="relative w-full select-text"
      onMouseUp={handleMouseUp}
    >
      {/* ── Chargement ── */}
      {status === "loading" && (
        <div className="flex flex-col items-center justify-center gap-3 text-neutral-400 py-20">
          <div className="w-10 h-10 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-body">
            {docType === "docx" ? "Rendu Word en cours…" : "Chargement du PDF…"}
          </p>
        </div>
      )}

      {/* ── Erreur ── */}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center gap-3 text-center py-12 px-8 bg-red-50/80 border border-red-200 rounded-xl max-w-lg mx-auto my-6 shadow-sm">
          <p className="text-3xl">⚠️</p>
          <div className="space-y-1">
            <p className="text-sm text-red-800 font-body font-semibold">{errorMsg}</p>
            <p className="text-xs text-neutral-500 font-body">
              Vérifiez votre connexion internet ou réessayez l'initialisation du lecteur.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="mt-2 px-4 py-2 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold rounded-lg border border-neutral-300 shadow-2xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <span>🔄</span> Réessayer le chargement
          </button>
        </div>
      )}

      {/* ── PDF : canvas ── */}
      {docType === "pdf" && (
        <div className="flex justify-center w-full py-4">
          <div className="relative inline-block bg-white shadow-md rounded-sm border border-neutral-200">
            <canvas
              ref={canvasRef}
              className={status === "ready" ? "block max-w-full" : "hidden"}
              style={{ cursor: "text" }}
            />
            {/* Marqueurs d'annotations PDF */}
            {status === "ready" && canvasSize.w > 0 &&
              pageAnnotations.map((ann) => {
                if (ann.x == null || ann.y == null) return null
                return (
                  <button
                    key={ann.id}
                    title={ann.content}
                    onClick={() => onAnnotationClick?.(ann)}
                    className="absolute z-10 w-6 h-6 rounded-full bg-yellow-400 border-2 border-yellow-600 shadow-md text-[11px] flex items-center justify-center hover:scale-125 transition-transform"
                    style={{
                      left: ann.x * canvasSize.w - 12,
                      top: ann.y * canvasSize.h - 12,
                    }}
                  >
                    💬
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {/* ── DOCX : rendu docx-preview ── */}
      {docType === "docx" && (
        <div
          className={`w-full overflow-auto flex flex-col items-center py-6 ${status === "ready" ? "" : "hidden"}`}
        >
          {/* Conteneur dans lequel docx-preview rend les pages */}
          <div
            ref={docxBodyRef}
            className="docx-viewer-body max-w-full flex flex-col items-center gap-6"
            style={{
              width: "100%",
            }}
          />
        </div>
      )}

      {/* Info pages DOCX */}
      {docType === "docx" && status === "ready" && docxTotalPages > 1 && (
        <div className="text-center text-xs text-neutral-400 font-body py-1">
          {docxTotalPages} pages · Faites défiler ou utilisez les boutons de navigation
        </div>
      )}
    </div>
  )
}
