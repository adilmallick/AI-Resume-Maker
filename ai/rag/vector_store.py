from abc import ABC, abstractmethod
from typing import List, Tuple
from ai.rag.embeddings import Embeddings
import math

class VectorStore(ABC):
    @abstractmethod
    def add(self, texts: List[str]):
        """Add documents to the store."""
        pass
        
    @abstractmethod
    def search(self, query: str, k: int) -> List[str]:
        """Search the store and return top k matching documents."""
        pass

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    if not v1 or not v2: 
        return 0.0
    dot_product = sum(a * b for a, b in zip(v1, v2))
    norm_v1 = math.sqrt(sum(a * a for a in v1))
    norm_v2 = math.sqrt(sum(b * b for b in v2))
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return dot_product / (norm_v1 * norm_v2)

class InMemoryVectorStore(VectorStore):
    def __init__(self, embeddings: Embeddings):
        self.embeddings = embeddings
        self.documents: List[str] = []
        self.document_embeddings: List[List[float]] = []

    def add(self, texts: List[str]):
        for text in texts:
            emb = self.embeddings.embed_text(text)
            if emb:
                self.documents.append(text)
                self.document_embeddings.append(emb)

    def search(self, query: str, k: int) -> List[str]:
        query_emb = self.embeddings.embed_text(query)
        if not query_emb or not self.documents:
            return []
        
        scored_docs = []
        for doc, doc_emb in zip(self.documents, self.document_embeddings):
            score = cosine_similarity(query_emb, doc_emb)
            scored_docs.append((score, doc))
        
        # Sort by similarity score descending
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        return [doc for score, doc in scored_docs[:k]]
