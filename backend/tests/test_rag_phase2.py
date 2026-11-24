import unittest
import asyncio
import hashlib
import numpy as np
from typing import List, Dict, Any

from app.models.mock_defense import ProjectKnowledgeProfile
from app.services.mock_defense.document_analysis_service import DocumentAnalysisService
from app.services.mock_defense.rag_engine import RAGEngine, BGE_M3_DIMENSION, get_rag_engine


class MockEmbeddingModel:
    """Deterministic mock embedding model producing normalized 1024-dim vectors for fast offline tests."""
    def __init__(self, dimension: int = BGE_M3_DIMENSION):
        self.dimension = dimension

    def encode(self, texts: List[str], normalize_embeddings: bool = True, **kwargs):
        vectors = []
        for text in texts:
            # Deterministic pseudo-random seed from text hash
            seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)
            rng = np.random.RandomState(seed)
            vec = rng.randn(self.dimension).astype(np.float32)
            if normalize_embeddings:
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
            vectors.append(vec)
        return np.array(vectors)


class TestRAGPhase2(unittest.TestCase):
    def setUp(self):
        # Create an isolated in-memory RAGEngine with mock embeddings for fast, deterministic testing
        self.engine = RAGEngine(
            qdrant_url=":memory:",
            collection_name="test_pfe_knowledge_chunks"
        )
        self.mock_model = MockEmbeddingModel(dimension=BGE_M3_DIMENSION)
        self.engine.set_embedding_model(self.mock_model)

        self.sample_report_text = """
        Projet de Fin d'Études : Plateforme intelligente de gestion des thèses universitaires.
        Introduction et Problématique :
        Le processus de suivi des mémoires de PFE souffre de retards récurrents et d'un manque de coordination.
        Objectifs du projet :
        Automatiser l'évaluation préliminaire, offrir une interface ergonomique et sécuriser l'archivage.
        Architecture et Technologies :
        Architecture microservices conteneurisée avec Docker, FastAPI pour les APIs REST et React pour le frontend.
        Base de données :
        PostgreSQL a été sélectionné pour sa robustesse transactionnelle ACID et sa gestion des contraintes relationnelles.
        Sécurité et Authentification :
        Sécurité garantie via des jetons JWT avec expiration courte et contrôle d'accès basé sur les rôles (RBAC).
        Limites et Perspectives :
        Absence de tests de montée en charge au-delà de 500 utilisateurs concurrents.
        """

    def test_document_extraction_and_chunking(self):
        """1. Test chunking logic and section classification."""
        chunks = DocumentAnalysisService.chunk_document(self.sample_report_text, chunk_size=300, overlap=50)
        self.assertGreater(len(chunks), 0)
        self.assertTrue(all("chunk_id" in c for c in chunks))
        self.assertTrue(all("section" in c for c in chunks))
        self.assertTrue(all("text" in c for c in chunks))

        # Check section classifications
        sections = [c["section"] for c in chunks]
        self.assertTrue(any(s in ["problem_statement", "architecture", "database", "api_security", "limitations"] for s in sections))

    def test_rag_engine_collection_creation(self):
        """2. Test in-memory Qdrant collection creation and dimension validation."""
        client = self.engine.get_qdrant_client()
        self.assertIsNotNone(client)
        self.assertTrue(self.engine.is_available)
        collection_info = client.get_collection(self.engine.collection_name)
        # Vector size should be 1024 (BGE-M3 standard)
        self.assertEqual(collection_info.config.params.vectors.size, BGE_M3_DIMENSION)

    def test_deterministic_point_id(self):
        """3. Test idempotent deterministic point ID generation."""
        id1 = RAGEngine.generate_point_id("proj_100", "doc_200", "chunk_1")
        id2 = RAGEngine.generate_point_id("proj_100", "doc_200", "chunk_1")
        id3 = RAGEngine.generate_point_id("proj_100", "doc_200", "chunk_2")

        # Same inputs must produce identical ID
        self.assertEqual(id1, id2)
        # Different chunk produces distinct ID
        self.assertNotEqual(id1, id3)

    def test_embedding_generation(self):
        """4. Test non-blocking embedding generation."""
        texts = ["FastAPI microservices architecture", "PostgreSQL relational database ACID transactions"]
        vectors = asyncio.run(self.engine.embed_chunks(texts))
        self.assertEqual(len(vectors), 2)
        self.assertEqual(len(vectors[0]), BGE_M3_DIMENSION)
        self.assertEqual(len(vectors[1]), BGE_M3_DIMENSION)

        # Check L2 normalization (norm should be approximately 1.0)
        norm0 = np.linalg.norm(vectors[0])
        self.assertAlmostEqual(norm0, 1.0, places=4)

    def test_vector_upsert_and_retrieval(self):
        """5. Test upserting chunks with metadata and retrieving relevant results."""
        chunks = DocumentAnalysisService.chunk_document(self.sample_report_text, chunk_size=300, overlap=50)
        upserted_count = asyncio.run(self.engine.upsert_chunks(
            chunks=chunks,
            student_id="student_123",
            project_id="project_456",
            document_id="doc_789",
            doc_type="report"
        ))
        self.assertEqual(upserted_count, len(chunks))

        # Query semantic search
        results = asyncio.run(self.engine.semantic_search(
            query="PostgreSQL base de données relationnelle",
            project_id="project_456",
            top_k=2
        ))
        self.assertGreater(len(results), 0)
        top_hit = results[0]
        self.assertIn("score", top_hit)
        self.assertIn("text", top_hit)
        self.assertIn("chunk_id", top_hit)
        self.assertEqual(top_hit["metadata"]["student_id"], "student_123")
        self.assertEqual(top_hit["metadata"]["project_id"], "project_456")
        self.assertEqual(top_hit["metadata"]["document_id"], "doc_789")

    def test_metadata_authorization_filtering(self):
        """6. Test authorization filters isolating student and project chunks."""
        chunks1 = [{"chunk_id": "c1", "text": "PostgreSQL database configuration for Project 1", "section": "database"}]
        chunks2 = [{"chunk_id": "c2", "text": "PostgreSQL database configuration for Project 2", "section": "database"}]

        asyncio.run(self.engine.upsert_chunks(chunks1, student_id="student_A", project_id="proj_1", document_id="doc_1"))
        asyncio.run(self.engine.upsert_chunks(chunks2, student_id="student_B", project_id="proj_2", document_id="doc_2"))

        # Search restricted to student_A
        results_a = asyncio.run(self.engine.semantic_search(
            query="PostgreSQL database",
            student_id="student_A",
            top_k=5
        ))
        for res in results_a:
            self.assertEqual(res["metadata"]["student_id"], "student_A")
            self.assertNotEqual(res["metadata"]["student_id"], "student_B")

        # Search restricted to proj_2
        results_proj2 = asyncio.run(self.engine.semantic_search(
            query="PostgreSQL database",
            project_id="proj_2",
            top_k=5
        ))
        for res in results_proj2:
            self.assertEqual(res["metadata"]["project_id"], "proj_2")

    def test_idempotent_duplicate_indexing(self):
        """7. Test that re-indexing the same document does not produce duplicate chunks."""
        chunks = [
            {"chunk_id": "chunk_0", "text": "First paragraph of document", "section": "intro"},
            {"chunk_id": "chunk_1", "text": "Second paragraph of document", "section": "architecture"},
        ]

        # First indexing
        asyncio.run(self.engine.upsert_chunks(chunks, student_id="s1", project_id="p1", document_id="d1"))
        client = self.engine.get_qdrant_client()
        count1 = client.count(collection_name=self.engine.collection_name).count
        self.assertEqual(count1, 2)

        # Second indexing of identical document
        asyncio.run(self.engine.upsert_chunks(chunks, student_id="s1", project_id="p1", document_id="d1"))
        count2 = client.count(collection_name=self.engine.collection_name).count
        # Total points should remain 2 (updated in place, not duplicated)
        self.assertEqual(count2, 2)

    def test_deletion_of_document_chunks(self):
        """8. Test deletion of document chunks by document_id."""
        chunks = [
            {"chunk_id": "c1", "text": "Doc to be deleted", "section": "intro"}
        ]
        asyncio.run(self.engine.upsert_chunks(chunks, student_id="s1", project_id="p1", document_id="doc_delete_me"))

        # Verify it exists
        res = asyncio.run(self.engine.semantic_search(query="Doc to be deleted", document_id="doc_delete_me"))
        self.assertEqual(len(res), 1)

        # Delete it
        success = asyncio.run(self.engine.delete_document_chunks(document_id="doc_delete_me", project_id="p1"))
        self.assertTrue(success)

        # Verify it is deleted
        res_after = asyncio.run(self.engine.semantic_search(query="Doc to be deleted", document_id="doc_delete_me"))
        self.assertEqual(len(res_after), 0)

    def test_document_analysis_service_fallback_when_qdrant_unavailable(self):
        """9. Test DocumentAnalysisService graceful fallback to keyword search when Qdrant is offline."""
        in_memory_chunks = [
            {"chunk_id": "c1", "text": "Choix de PostgreSQL pour la persistance relationnelle ACID."},
            {"chunk_id": "c2", "text": "Implémentation d'une interface en React et TypeScript."}
        ]

        # Call semantic_retrieve with unconfigured/unavailable Qdrant filters
        retrieved = asyncio.run(DocumentAnalysisService.semantic_retrieve(
            query="PostgreSQL ACID",
            chunks=in_memory_chunks,
            project_id="non_existent_project",
            top_k=1
        ))

        # Must return the keyword-matched chunk as fallback without raising an error
        self.assertGreater(len(retrieved), 0)
        self.assertIn("PostgreSQL", retrieved[0]["text"])


if __name__ == "__main__":
    unittest.main()
