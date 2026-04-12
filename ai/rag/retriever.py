from typing import List
from ai.rag.vector_store import VectorStore
import logging

logger = logging.getLogger(__name__)

class RAGRetriever:
    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store
        self._seed_examples()

    def _seed_examples(self):
        """Pre-populate with example ATS bullet points."""
        seed_bullets = [
            "Engineered a scalable REST API using Python and FastAPI, increasing system throughput by 40% and reducing latency.",
            "Architected and deployed microservices on AWS, lowering infrastructure costs by 15% whilst supporting 1M+ daily active users.",
            "Optimized PostgreSQL database queries, reducing data retrieval time by 30% for core reporting features.",
            "Developed responsive user interfaces with React and Next.js, improving page load speed by 25% and boosting user retention.",
            "Integrated CI/CD pipelines with GitHub Actions, reducing deployment time from hours to minutes and decreasing deployment errors by 50%.",
            "Led the migration of legacy monolothic application to Docker containerized services, improving developer velocity by 20%.",
            "Designed automated test suites with Pytest and Playwright, achieving 90% code coverage and virtually eliminating critical production bugs."
        ]
        self.vector_store.add(seed_bullets)

    def retrieve_examples(self, job_description: str, skills: List[str], k: int = 3) -> List[str]:
        query = job_description + "\nSkills: " + ", ".join(skills)
        logger.info("RAGRetriever: Retrieving examples based on JD and skills...")
        return self.vector_store.search(query, k)
