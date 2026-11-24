# Encadrini AI – RAG Upgrade Audit & Implementation Plan

## 1️⃣ Existing RAG Pipeline Overview

| File | Key Functions | Purpose |
|------|---------------|---------|
| `backend/app/services/mock_defense/document_analysis_service.py` | `extract_text`, `chunk_document`, `retrieve_relevant_chunks`, `build_knowledge_profile` | Handles raw document extraction, naïve overlapping chunking, keyword‑based retrieval, and builds a `ProjectKnowledgeProfile` used downstream for mock‑defense analysis. |
| Front‑end (`Encadrini/src/pages/admin/AdminDashboard.tsx`) | UI element labelled *"Moteur d'Audit IA (RAG)"* | Triggers the mock‑defense pipeline, which eventually calls the backend service above. |

### 1.1 Extraction
- Supports PDF (via **pdfplumber**), DOCX (via **python‑docx**), PPTX (via zip‑XML parsing).  Returns a plain‑text string.

### 1.2 Chunking
- `chunk_document(text, chunk_size=1500, overlap=200)` → splits on double‑newline paragraphs, builds overlapping semantic chunks, and classifies each chunk using a simple keyword rule set (`_classify_section`).

### 1.3 Retrieval (Keyword‑based)
- `retrieve_relevant_chunks(query, chunks, top_k=3)` → tokenises the query (`\w{3,}`) and scores each chunk by the proportion of query terms present.  Returns the top‑k chunks.

### 1.4 Knowledge‑profile generation
- `build_knowledge_profile` aggregates extracted text, tech‑stack detection, problem‑statement extraction, etc., and returns a MongoDB model `ProjectKnowledgeProfile`.

## 2️⃣ Re‑usable Components
- **Extraction utilities** (`extract_text`) are pure functions – perfect for reuse.
- **Chunking logic** is generic and can be kept; we will add a *vector‑id* field.
- **MongoDB models** (`ProjectKnowledgeProfile`) already exist; we will store a reference to the vector collection (Qdrant collection name) in the model for traceability.
- **FastAPI** app structure (routers, dependency injection) is already in place; we will add a new dependency for the Qdrant client.

## 3️⃣ Gaps & Upgrade Targets
| Area | Current | Desired |
|------|---------|---------|
| **Semantic Retrieval** | Keyword match only | Dense embeddings (Sentence‑Transformers, BGE‑M3) stored in Qdrant |
| **Hybrid Search** | N/A | Combine keyword/BM25 with dense vector scores (RRF fusion) |
| **Reranking** | N/A | Use BAAI/bge‑reranker‑v2‑m3 to reorder top‑k hybrid results |
| **LLM Prompt** | Groq integration (presumably `groq` client) | Keep, but feed retrieved chunks with source citations |
| **Persistence** | In‑memory only | Persistent Qdrant collection; metadata includes `student_id`, `project_id`, `doc_type` |
| **Configuration** | Hard‑coded paths | Env‑vars (`QDRANT_URL`, `QDRANT_API_KEY`, `EMBED_MODEL`, `RERANK_MODEL`, `GROQ_API_KEY`) |
| **Testing** | Minimal unit tests | Full suite covering extraction → retrieval → rerank → LLM call |

## 4️⃣ Implementation Plan (Incremental)

### Phase 1 – Audit (completed)
- Documented current architecture and identified reusable pieces.

### Phase 2 – Semantic Retrieval (first code change) 
1. **Add dependencies** to `backend/requirements.txt`:
   ```
   sentence-transformers>=2.2.2
   qdrant-client>=1.7.0
   transformers>=4.40.0
   huggingface_hub>=0.23.0
   ```
2. **Create a `rag_engine.py`** in `backend/app/services/mock_defense/` encapsulating:
   - Model loading (`SentenceTransformer('BAAI/bge-m3')`).
   - Qdrant client singleton (FastAPI dependency).
   - Methods: `embed_chunks(chunks)`, `upsert_chunks(chunks, metadata)`, `search(query, filter, top_k)`.
3. **Extend `DocumentAnalysisService`**:
   - Add `store_chunks` that calls `RAGEngine.upsert_chunks` after `chunk_document`.
   - Add `semantic_retrieve(query, filter, top_k)` that queries Qdrant.
   - Keep existing `retrieve_relevant_chunks` for fallback.
4. **Configuration** – add env vars in `backend/app/core/config.py` (e.g., `QDRANT_URL`, `QDRANT_API_KEY`).
5. **Logging & error handling** – use standard `logging`.
6. **Dockerfile** – ensure the image installs the new Python packages (requirements automatically handled).

### Phase 3 – Hybrid Search
- Implement a thin wrapper `hybrid_search(query, filter, top_k)` that:
  1. Calls Qdrant dense search → list of scored chunks.
  2. Calls keyword‑based `retrieve_relevant_chunks` → list.
  3. Applies Reciprocal Rank Fusion (RRF) to merge scores.
- Return merged list.

### Phase 4 – Reranking
- Load `SentenceTransformer('BAAI/bge-reranker-v2-m3')`.
- Provide `rerank(query, candidates, top_n)` method that scores each candidate text and returns top‑n ordered chunks.
- Integrate into `hybrid_search` – after fusion, run reranker, then slice to final `top_k`.

### Phase 5 – LLM Integration
- Locate the Groq integration (likely `backend/app/ai/ai_provider.py`).
- Modify the prompt template to append a *retrieved context* block:
  ```
  Context:
  {chunk_1}\n---\n{chunk_2}\n---\n...
  ```
- Ensure the response JSON includes `source_ids` and page numbers (metadata stored with each chunk).

### Phase 6 – Mock‑Defense Workflow
- In `backend/app/services/mock_defense/*` where the knowledge profile is built, call the new `hybrid_search`/`rerank` pipeline to enrich `ProjectKnowledgeProfile` with `retrieved_chunks` and `sources`.
- Use these enriched sources for:
  * Jury question generation (already uses the profile).
  * Answer evaluation – compare student answer against retrieved evidence.
  * Audit feedback – highlight missing sections based on retrieved docs.

### Phase 7 – Testing
- Add tests under `backend/tests/`:
  * `test_extraction.py` – validate `extract_text` on sample PDF/DOCX.
  * `test_chunking.py` – ensure chunk size & overlap.
  * `test_embeddings.py` – confirm embedding dimensions and deterministic output (use a small stub model or mock).
  * `test_qdrant_integration.py` – spin up a local Qdrant container (docker‑compose) in CI, test upsert & search.
  * `test_hybrid.py` – check that fusion returns expected order.
  * `test_rerank.py` – verify reranker improves relevance on a toy dataset.
  * `test_end_to_end.py` – simulate a mock‑defense request and assert response includes cited sources.
- Use fixtures for temporary Qdrant collections and clean‑up after each test.

## 5️⃣ Deliverables (by the end of this upgrade)
- Updated `requirements.txt`.
- New module `rag_engine.py` with full semantic‑retrieval API.
- Extended `DocumentAnalysisService` preserving original methods.
- Configuration entries and Docker‑ready image.
- Comprehensive test suite with >90 % coverage for the RAG path.
- Updated README / `.env.example` with new variables.
- Minimal front‑end impact – the existing “Moteur d'Audit IA (RAG)” button will automatically benefit from the richer backend.

---
**Next Step:** Implement Phase 2 – add dependencies, create `rag_engine.py`, and extend `DocumentAnalysisService` with embedding and persistence helpers.

Feel free to approve proceeding with Phase 2 or request adjustments.
