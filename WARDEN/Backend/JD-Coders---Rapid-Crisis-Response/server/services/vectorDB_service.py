import os
import chromadb
from chromadb.config import Settings

# Initialize ChromaDB client. 
# It creates a local persistent database in a "vector_db" folder relative to this file.
db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "vector_db")
client = chromadb.PersistentClient(path=db_path)

# Retrieve or create a collection for incident contexts and protocols
collection = client.get_or_create_collection(name="warden_knowledge_base")

def add_document(doc_id: str, text: str, metadata: dict = None):
    """
    Adds a document (e.g., safety protocol, floorplan info) to the Vector DB.
    """
    try:
        collection.add(
            documents=[text],
            metadatas=[metadata] if metadata else [{}],
            ids=[doc_id]
        )
        print(f"[VectorDB] Successfully added document {doc_id}")
    except Exception as e:
        print(f"[VectorDB] Error adding document: {e}")

def query_context(query_text: str, n_results: int = 3) -> list:
    """
    Queries the Vector DB for similar documents to provide RAG context.
    """
    try:
        results = collection.query(
            query_texts=[query_text],
            n_results=n_results
        )
        # return the list of matched document strings
        if results and results.get("documents") and len(results["documents"]) > 0:
            return results["documents"][0]
        return []
    except Exception as e:
        print(f"[VectorDB] Error querying context: {e}")
        return []

def get_rag_context(incident_description: str) -> str:
    """
    Convenience method to get a single concatenated string of relevant knowledge.
    """
    docs = query_context(incident_description)
    if docs:
        return "\n\n".join(docs)
    return "No additional historical or spatial context found."