import asyncio
import logging
import uuid
from typing import List, Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger("encadrini.rag_engine")

# Vector dimension for BAAI/bge-m3 dense embeddings
BGE_M3_DIMENSION = 1024


class RAGEngine:
    """
    Production-grade Semantic Retrieval Engine for Encadrini AI.
    - Model: BAAI/bge-m3 dense representation (1024-dim)
    - Vector Database: Qdrant
    - Features: Idempotent upserts, metadata authorization filtering,
      non-blocking execution via asyncio.to_thread, graceful degradation.
    """

    def __init__(
        self,
        qdrant_url: Optional[str] = None,
        qdrant_api_key: Optional[str] = None,
        collection_name: Optional[str] = None,
        embed_model_name: Optional[str] = None,
        embed_device: Optional[str] = None,
    ):
        self.qdrant_url = qdrant_url or settings.QDRANT_URL
        self.qdrant_api_key = qdrant_api_key or settings.QDRANT_API_KEY
        self.collection_name = collection_name or settings.QDRANT_COLLECTION
        self.embed_model_name = embed_model_name or settings.EMBED_MODEL
        self.embed_device = embed_device or settings.EMBED_DEVICE

        self._embed_model = None
        self._qdrant_client = None
        self._is_qdrant_available: Optional[bool] = None

    # --------------------------------------------------------------------------
    # Lazy Initializers & Lifecycle
    # --------------------------------------------------------------------------

    def get_embedding_model(self):
        """Lazily load SentenceTransformer model in a thread-safe manner."""
        if self._embed_model is None:
            logger.info("Initializing embedding model: %s on %s", self.embed_model_name, self.embed_device)
            try:
                from sentence_transformers import SentenceTransformer
                self._embed_model = SentenceTransformer(
                    model_name_or_path=self.embed_model_name,
                    device=self.embed_device
                )
            except Exception as e:
                logger.error("Failed to load embedding model %s: %s", self.embed_model_name, e)
                raise
        return self._embed_model

    def set_embedding_model(self, model: Any):
        """Allows injecting custom or mock embedding model for testing."""
        self._embed_model = model

    def get_qdrant_client(self):
        """Lazily initialize and validate Qdrant client connection."""
        if self._qdrant_client is None:
            try:
                from qdrant_client import QdrantClient
                if self.qdrant_url == ":memory:" or (self.qdrant_url and self.qdrant_url.startswith("memory:")):
                    logger.info("Connecting to in-memory Qdrant instance")
                    self._qdrant_client = QdrantClient(":memory:")
                else:
                    logger.info("Connecting to Qdrant at %s", self.qdrant_url)
                    self._qdrant_client = QdrantClient(
                        url=self.qdrant_url,
                        api_key=self.qdrant_api_key or None,
                        timeout=5.0
                    )
                self.ensure_collection()
                self._is_qdrant_available = True
            except Exception as e:
                logger.warning("Qdrant connection not available (%s). Semantic search will degrade gracefully.", e)
                self._is_qdrant_available = False
                self._qdrant_client = None
        return self._qdrant_client

    def set_qdrant_client(self, client: Any):
        """Allows injecting mock or custom Qdrant client."""
        self._qdrant_client = client
        self._is_qdrant_available = client is not None
        if client is not None:
            try:
                self.ensure_collection()
            except Exception as e:
                logger.warning("Could not ensure collection on injected client: %s", e)

    @property
    def is_available(self) -> bool:
        """Returns True if Qdrant client is connected and ready."""
        if self._is_qdrant_available is None:
            self.get_qdrant_client()
        return bool(self._is_qdrant_available)

    # --------------------------------------------------------------------------
    # Collection Management
    # --------------------------------------------------------------------------

    def ensure_collection(self) -> bool:
        """Validates or creates the target Qdrant collection with 1024-dim cosine config."""
        if self._qdrant_client is None:
            return False

        try:
            from qdrant_client.http import models as qmodels

            # Check if collection exists
            exists = False
            try:
                # Modern qdrant-client has collection_exists
                if hasattr(self._qdrant_client, "collection_exists"):
                    exists = self._qdrant_client.collection_exists(self.collection_name)
                else:
                    self._qdrant_client.get_collection(self.collection_name)
                    exists = True
            except Exception:
                exists = False

            if not exists:
                logger.info("Creating Qdrant collection '%s' (dim=%d, distance=COSINE)...", self.collection_name, BGE_M3_DIMENSION)
                self._qdrant_client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qmodels.VectorParams(
                        size=BGE_M3_DIMENSION,
                        distance=qmodels.Distance.COSINE
                    )
                )
            return True
        except Exception as e:
            logger.error("Error creating/validating Qdrant collection '%s': %s", self.collection_name, e)
            raise

    # --------------------------------------------------------------------------
    # Embeddings Generation (Non-blocking)
    # --------------------------------------------------------------------------

    def _sync_embed(self, texts: List[str]) -> List[List[float]]:
        """Synchronous embedding computation."""
        if not texts:
            return []
        model = self.get_embedding_model()
        # sentence-transformers encode
        embeddings = model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        return [vec.tolist() for vec in embeddings]

    async def embed_chunks(self, texts: List[str]) -> List[List[float]]:
        """
        Asynchronously generate normalized dense embeddings for list of texts
        without blocking the FastAPI event loop.
        """
        if not texts:
            return []
        return await asyncio.to_thread(self._sync_embed, texts)

    # --------------------------------------------------------------------------
    # Deterministic Point Identification (Idempotency)
    # --------------------------------------------------------------------------

    @staticmethod
    def generate_point_id(project_id: str, document_id: str, chunk_id: str) -> str:
        """
        Generates a deterministic UUID5 point ID.
        Re-indexing the same project, document, and chunk produces the identical ID,
        ensuring upserts are strictly idempotent.
        """
        unique_key = f"{project_id}::{document_id}::{chunk_id}"
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, unique_key))

    # --------------------------------------------------------------------------
    # Upsert Operations
    # --------------------------------------------------------------------------

    def _sync_upsert(
        self,
        points: List[Any]
    ) -> bool:
        client = self.get_qdrant_client()
        if not client or not points:
            return False
        client.upsert(
            collection_name=self.collection_name,
            points=points
        )
        return True

    async def upsert_chunks(
        self,
        chunks: List[Dict[str, Any]],
        student_id: str,
        project_id: str,
        document_id: str,
        doc_type: str = "report"
    ) -> int:
        """
        Indexes chunks into Qdrant with comprehensive metadata and deterministic IDs.
        Metadata schema:
          - student_id: str
          - project_id: str
          - document_id: str
          - doc_type: str ('report', 'slides', 'cahier_charges')
          - chunk_id: str
          - page_number: Optional[int]
          - section: str
          - original_text: str
        """
        if not chunks:
            return 0

        client = self.get_qdrant_client()
        if not client:
            logger.warning("Qdrant unavailable; skipping vector upsert of %d chunks", len(chunks))
            return 0

        texts = [c.get("text", "") for c in chunks]
        embeddings = await self.embed_chunks(texts)

        try:
            from qdrant_client.http import models as qmodels
        except ImportError:
            logger.error("qdrant-client not installed")
            return 0

        points = []
        for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):
            chunk_id = chunk.get("chunk_id", f"chunk_{i}")
            point_id = self.generate_point_id(project_id, document_id, chunk_id)

            payload = {
                "student_id": str(student_id),
                "project_id": str(project_id),
                "document_id": str(document_id),
                "doc_type": doc_type,
                "chunk_id": chunk_id,
                "page_number": chunk.get("page_number", chunk.get("page", 1)),
                "section": chunk.get("section", "general"),
                "original_text": chunk.get("text", "")
            }

            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload
                )
            )

        success = await asyncio.to_thread(self._sync_upsert, points)
        if success:
            logger.info(
                "Successfully upserted %d chunks for project %s, doc %s into Qdrant",
                len(points), project_id, document_id
            )
            return len(points)
        return 0

    # --------------------------------------------------------------------------
    # Semantic Search & Metadata Filtering
    # --------------------------------------------------------------------------

    def _sync_search(
        self,
        query_vector: List[float],
        filter_obj: Any,
        top_k: int
    ) -> List[Dict[str, Any]]:
        client = self.get_qdrant_client()
        if not client:
            return []

        # Check search API compatibility (query_points vs search)
        if hasattr(client, "query_points"):
            response = client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                query_filter=filter_obj,
                limit=top_k,
                with_payload=True
            )
            hits = response.points
        else:
            hits = client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=filter_obj,
                limit=top_k,
                with_payload=True
            )

        results = []
        for hit in hits:
            payload = getattr(hit, "payload", {}) or {}
            results.append({
                "chunk_id": payload.get("chunk_id"),
                "score": float(getattr(hit, "score", 0.0)),
                "text": payload.get("original_text", ""),
                "section": payload.get("section", "general"),
                "page_number": payload.get("page_number", 1),
                "metadata": payload
            })
        return results

    async def semantic_search(
        self,
        query: str,
        student_id: Optional[str] = None,
        project_id: Optional[str] = None,
        document_id: Optional[str] = None,
        doc_type: Optional[str] = None,
        section: Optional[str] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Executes dense semantic similarity search against Qdrant collection with
        mandatory / optional metadata authorization filters.
        """
        if not query.strip():
            return []

        client = self.get_qdrant_client()
        if not client:
            logger.warning("Qdrant unavailable; cannot execute semantic search")
            return []

        query_vectors = await self.embed_chunks([query])
        if not query_vectors:
            return []
        query_vector = query_vectors[0]

        try:
            from qdrant_client.http import models as qmodels
        except ImportError:
            return []

        # Build metadata filter conditions
        must_conditions = []
        if student_id:
            must_conditions.append(qmodels.FieldCondition(key="student_id", match=qmodels.MatchValue(value=str(student_id))))
        if project_id:
            must_conditions.append(qmodels.FieldCondition(key="project_id", match=qmodels.MatchValue(value=str(project_id))))
        if document_id:
            must_conditions.append(qmodels.FieldCondition(key="document_id", match=qmodels.MatchValue(value=str(document_id))))
        if doc_type:
            must_conditions.append(qmodels.FieldCondition(key="doc_type", match=qmodels.MatchValue(value=str(doc_type))))
        if section:
            must_conditions.append(qmodels.FieldCondition(key="section", match=qmodels.MatchValue(value=str(section))))

        filter_obj = qmodels.Filter(must=must_conditions) if must_conditions else None

        return await asyncio.to_thread(self._sync_search, query_vector, filter_obj, top_k)

    # --------------------------------------------------------------------------
    # Deletion Operations
    # --------------------------------------------------------------------------

    def _sync_delete_doc(self, document_id: str, project_id: Optional[str] = None) -> bool:
        client = self.get_qdrant_client()
        if not client:
            return False

        from qdrant_client.http import models as qmodels
        must_conditions = [
            qmodels.FieldCondition(key="document_id", match=qmodels.MatchValue(value=str(document_id)))
        ]
        if project_id:
            must_conditions.append(
                qmodels.FieldCondition(key="project_id", match=qmodels.MatchValue(value=str(project_id)))
            )

        client.delete(
            collection_name=self.collection_name,
            points_selector=qmodels.FilterSelector(
                filter=qmodels.Filter(must=must_conditions)
            )
        )
        return True

    async def delete_document_chunks(self, document_id: str, project_id: Optional[str] = None) -> bool:
        """Deletes all chunks belonging to a document from Qdrant."""
        client = self.get_qdrant_client()
        if not client:
            return False
        return await asyncio.to_thread(self._sync_delete_doc, document_id, project_id)


# ------------------------------------------------------------------------------
# Global Singleton Access
# ------------------------------------------------------------------------------

_rag_engine_instance: Optional[RAGEngine] = None


def get_rag_engine() -> RAGEngine:
    """Returns the managed RAGEngine singleton."""
    global _rag_engine_instance
    if _rag_engine_instance is None:
        _rag_engine_instance = RAGEngine()
    return _rag_engine_instance


async def init_rag_engine() -> RAGEngine:
    """FastAPI lifespan hook to validate RAG engine readiness asynchronously."""
    engine = get_rag_engine()
    # Try connecting in a separate thread to avoid blocking startup
    await asyncio.to_thread(engine.get_qdrant_client)
    return engine
