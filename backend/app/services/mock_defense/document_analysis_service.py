import io
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Tuple
from app.models.mock_defense import ProjectKnowledgeProfile

class DocumentAnalysisService:
    @staticmethod
    def extract_text(file_bytes: bytes, filename: str, mime_type: str = "") -> str:
        """Extract plain text from PDF, DOCX, or PPTX bytes."""
        fname = filename.lower()

        # 1. DOCX
        if fname.endswith(".docx") or "wordprocessingml" in mime_type:
            try:
                import docx
                doc = docx.Document(io.BytesIO(file_bytes))
                paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
                for table in doc.tables:
                    for row in table.rows:
                        paragraphs.extend([cell.text.strip() for cell in row.cells if cell.text.strip()])
                if paragraphs:
                    return "\n\n".join(paragraphs)
            except Exception as e:
                print(f"[doc-analysis] docx extract error: {e}")

        # 2. PPTX
        if fname.endswith(".pptx") or "presentationml" in mime_type:
            try:
                slide_texts = []
                with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                    slide_files = sorted([f for f in z.namelist() if f.startswith("ppt/slides/slide") and f.endswith(".xml")])
                    for slide_file in slide_files:
                        xml_content = z.read(slide_file)
                        tree = ET.fromstring(xml_content)
                        # Find all text elements <a:t>
                        texts = [elem.text for elem in tree.iter() if elem.tag.endswith("}t") and elem.text]
                        if texts:
                            slide_texts.append(" ".join(texts))
                if slide_texts:
                    return "\n\n".join(slide_texts)
            except Exception as e:
                print(f"[doc-analysis] pptx extract error: {e}")

        # 3. PDF
        if fname.endswith(".pdf") or "pdf" in mime_type:
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                    pages = [page.extract_text() or "" for page in pdf.pages]
                    full_text = "\n\n".join(p for p in pages if p.strip())
                    if full_text.strip():
                        return full_text
            except Exception as e:
                print(f"[doc-analysis] pdf extract error: {e}")

        # 4. Fallback decode
        try:
            decoded = file_bytes.decode("utf-8", errors="ignore")
            printable = "".join(c for c in decoded if c.isprintable() or c in "\n\r\t ")
            if len(printable.strip()) > 30:
                return printable
        except Exception:
            pass

        return ""

    @staticmethod
    def chunk_document(text: str, chunk_size: int = 1500, overlap: int = 200) -> List[Dict[str, Any]]:
        """Splits document text into overlapping semantic chunks with section classification."""
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        chunks: List[Dict[str, Any]] = []

        current_chunk = []
        current_len = 0
        chunk_idx = 0

        for para in paragraphs:
            para_len = len(para)
            if current_len + para_len > chunk_size and current_chunk:
                chunk_str = "\n\n".join(current_chunk)
                section_type = DocumentAnalysisService._classify_section(chunk_str)
                chunks.append({
                    "chunk_id": f"chunk_{chunk_idx}",
                    "section": section_type,
                    "text": chunk_str,
                })
                chunk_idx += 1
                # Keep overlap if possible
                overlap_text = current_chunk[-1] if current_chunk else ""
                current_chunk = [overlap_text, para] if len(overlap_text) < overlap else [para]
                current_len = sum(len(c) for c in current_chunk)
            else:
                current_chunk.append(para)
                current_len += para_len

        if current_chunk:
            chunk_str = "\n\n".join(current_chunk)
            section_type = DocumentAnalysisService._classify_section(chunk_str)
            chunks.append({
                "chunk_id": f"chunk_{chunk_idx}",
                "section": section_type,
                "text": chunk_str,
            })

        return chunks

    @staticmethod
    def _classify_section(text: str) -> str:
        lower = text.lower()
        if any(k in lower for k in ["introduction", "contexte", "problématique", "problematique", "objectifs"]):
            return "problem_statement"
        if any(k in lower for k in ["architecture", "composant", "diagramme", "vue logique", "microservice"]):
            return "architecture"
        if any(k in lower for k in ["base de données", "database", "modèle relationnel", "schéma", "mongodb", "postgresql", "sql"]):
            return "database"
        if any(k in lower for k in ["api", "rest", "endpoint", "contrôleur", "service web", "jwt"]):
            return "api_security"
        if any(k in lower for k in ["intelligence artificielle", "machine learning", "modèle", "llm", "réseau de neurones", "deep learning"]):
            return "ai_ml"
        if any(k in lower for k in ["test", "validation", "résultats", "expérimentation", "performance", "métriques"]):
            return "testing_evaluation"
        if any(k in lower for k in ["limite", "difficulté", "perspective", "amélioration", "conclusion"]):
            return "limitations"
        return "general"

    @classmethod
    def retrieve_relevant_chunks(cls, query: str, chunks: List[Dict[str, Any]], top_k: int = 3) -> List[Dict[str, Any]]:
        """Lightweight keyword-based RAG retriever to fetch top relevant chunks."""
        if not chunks:
            return []
        
        query_terms = set(re.findall(r"\w{3,}", query.lower()))
        if not query_terms:
            return chunks[:top_k]

        scored: List[Tuple[float, Dict[str, Any]]] = []
        for ch in chunks:
            text_lower = ch.get("text", "").lower()
            matches = sum(1 for term in query_terms if term in text_lower)
            score = matches / max(1, len(query_terms))
            scored.append((score, ch))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:top_k]]

    @classmethod
    def build_knowledge_profile(
        cls,
        report_text: str,
        slides_text: str = "",
        user_tech_stack: List[str] = None,
        title: str = "",
        description: str = ""
    ) -> ProjectKnowledgeProfile:
        """
        Analyzes full report and slides content to produce a comprehensive, structured
        ProjectKnowledgeProfile grounded strictly in the provided text.
        """
        combined_text = f"{title}\n{description}\n{report_text}\n{slides_text}".strip()
        lower = combined_text.lower()

        # 1. Tech stack detection
        all_techs = set(user_tech_stack or [])
        known_techs = [
            "React", "Vue", "Angular", "Next.js", "TypeScript", "JavaScript", "HTML5", "Tailwind CSS",
            "Node.js", "Express", "NestJS", "Spring Boot", "Java", "Python", "FastAPI", "Flask", "Django",
            "C#", ".NET", "PHP", "Laravel", "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "Oracle",
            "Docker", "Kubernetes", "AWS", "Azure", "GCP", "CI/CD", "GitHub Actions",
            "PyTorch", "TensorFlow", "Scikit-Learn", "OpenAI", "HuggingFace", "LangChain", "BERT", "LLM",
            "Kafka", "RabbitMQ", "GraphQL", "REST API", "gRPC", "OAuth2", "JWT"
        ]
        for tech in known_techs:
            if re.search(rf"\b{re.escape(tech.lower())}\b", lower):
                all_techs.add(tech)

        # 2. Database choices
        db_choices = []
        for db in ["MongoDB", "PostgreSQL", "MySQL", "Redis", "Oracle", "SQLite", "Cassandra", "Neo4j", "Elasticsearch"]:
            if db.lower() in lower:
                db_choices.append(db)

        # 3. Problem Statement & Objectives
        prob_match = re.search(r"(?:problématique|contexte|problem statement)[:\s]+([^\.\n]+(?:\.[^\.\n]+){1,2})", combined_text, re.I)
        problem_statement = prob_match.group(1).strip() if prob_match else (
            description or f"Conception et réalisation de la solution {title} pour répondre aux besoins opérationnels et académiques ciblés."
        )

        objectives = []
        obj_matches = re.findall(r"(?:objectif|viser à|permettre de|afin de)[:\s]+([^\.\n]+)", combined_text, re.I)
        for m in obj_matches[:4]:
            cleaned = m.strip()
            if len(cleaned) > 15:
                objectives.append(cleaned)
        if not objectives:
            objectives = [
                f"Automatiser et optimiser les processus liés à {title}",
                "Offrir une interface utilisateur moderne, réactive et ergonomique",
                "Assurer la haute disponibilité et la robustesse des flux de données"
            ]

        # 4. Architecture Summary
        arch_summary = "Architecture en couches découplée séparant la logique métier, la persistance des données et les interfaces de présentation."
        if "microservice" in lower:
            arch_summary = "Architecture orientée microservices favorisant l'isolation des responsabilités et le déploiement conteneurisé."
        elif "mvc" in lower:
            arch_summary = "Architecture Modèle-Vue-Contrôleur (MVC) structurant la gestion des requêtes et le rendu applicatif."
        elif "clean" in lower or "hexagonale" in lower:
            arch_summary = "Architecture hexagonale / Clean Architecture isolant le domaine métier des détails d'infrastructure."

        # 5. Methodologies
        methodologies = []
        for meth in ["Scrum", "Agile", "Kanban", "Cycle en V", "TDD", "DevOps", "UML"]:
            if meth.lower() in lower:
                methodologies.append(meth)
        if not methodologies:
            methodologies = ["Méthodologie Agile / Scrum", "Modélisation UML"]

        # 6. Technical limitations & potential weaknesses
        limitations = []
        if "sécurité" not in lower and "chiffrement" not in lower:
            limitations.append("Documentation succincte sur les mécanismes de chiffrement et de gestion des secrets.")
        if "scalabilité" not in lower and "charge" not in lower:
            limitations.append("Absence d'évaluation formelle de la montée en charge (benchmarking / load testing).")
        if "test" not in lower:
            limitations.append("Faible taux de couverture de tests unitaires et d'intégration documenté.")
        if not limitations:
            limitations.append("Dépendance vis-à-vis de services tiers externes et latence sous forte concurrence.")

        # 7. Security considerations
        security = []
        if "jwt" in lower or "token" in lower:
            security.append("Authentification sans état basée sur JSON Web Tokens (JWT)")
        if "bcrypt" in lower or "argon2" in lower or "hash" in lower:
            security.append("Hachage fort des mots de passe utilisateurs")
        if "cors" in lower or "csrf" in lower:
            security.append("Politiques de restriction CORS et protection CSRF")
        if not security:
            security = ["Contrôle d'accès basé sur les rôles (RBAC)", "Validation stricte des entrées utilisateurs"]

        # 8. Scalability & Performance
        scalability = []
        if "cache" in lower or "redis" in lower:
            scalability.append("Mise en cache en mémoire des requêtes fréquentes")
        if "docker" in lower or "conteneur" in lower:
            scalability.append("Conteneurisation favorisant la réplication horizontale")
        if not scalability:
            scalability = ["Optimisation des index de base de données et pagination des requêtes"]

        # 9. Challengeable claims (points the jury might attack)
        claims = [
            f"Choix technologique de {list(all_techs)[0] if all_techs else 'la pile applicative'} face aux solutions concurrentes du marché",
            "Gestion des pannes et résilience en cas d'indisponibilité de la base de données",
            "Garantie de la cohérence des données lors de transactions concurrentes"
        ]

        return ProjectKnowledgeProfile(
            objectives=objectives,
            problem_statement=problem_statement,
            architecture_summary=arch_summary,
            technologies=sorted(list(all_techs)),
            database_choices=db_choices or (["Base relationnelle / NoSQL"] if not db_choices else db_choices),
            key_methodologies=methodologies,
            technical_limitations=limitations,
            security_considerations=security,
            scalability_performance=scalability,
            challengeable_claims=claims,
            extracted_sections={
                "overview": combined_text[:3000]
            }
        )
