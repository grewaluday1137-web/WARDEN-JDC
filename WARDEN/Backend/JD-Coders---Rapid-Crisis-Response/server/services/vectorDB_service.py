import os
from google import genai
from google.genai import types
from google.cloud.firestore_v1.vector import Vector
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from core.config import settings
from services.db_service import db

# 2. AI Connection (Standard Developer API)
client = genai.Client(api_key=settings.GEMINI_API_KEY)

def get_embedding(text: str):
    """
    Generates high-dimensional vectors and forces them to 768 dimensions 
    """
    try:
        response = client.models.embed_content(
            model="models/gemini-embedding-2-preview", 
            contents=text,
           
            config=types.EmbedContentConfig(output_dimensionality=768)
        )
        return response.embeddings[0].values
    except Exception as e:
        print(f"[ERROR] Default Prefix Failed. Trying fallback: {e}")
        try:
            response = client.models.embed_content(
                model="gemini-embedding-2-preview", 
                contents=text,
                config=types.EmbedContentConfig(output_dimensionality=768)
            )
            return response.embeddings[0].values
        except Exception as fallback_e:
            print(f"[ERROR] Fallback Embedding Failed: {fallback_e}")
            return [0.0] * 768
    

def store_embeddings(chunks, filename):
    """
    Chunks: List of strings from your safety manual.
    filename: Used to create unique IDs.
    """
    collection_ref = db.collection("safety_manuals")
    
    for i, chunk in enumerate(chunks):
        embedding_values = get_embedding(chunk)
        
        doc_id = f"{filename}_{i}"
        collection_ref.document(doc_id).set({
            "id": doc_id,
            "text": chunk,
            "embedding": Vector(embedding_values), 
            "source": filename,
            "model": "gemini-embedding-2-preview"
        })
        
    print(f"[SUCCESS] Stored {len(chunks)} chunks from {filename} into Firestore.")

def search_similar(query_text, top_k=3):
    """SEARCHES FIRESTORE"""
    collection_ref = db.collection("safety_manuals")
    
    query_vector = get_embedding(query_text)
    
    # DistanceMeasure is now properly imported from base_vector_query
    results = collection_ref.find_nearest(
        vector_field="embedding",
        query_vector=Vector(query_vector),
        distance_measure=DistanceMeasure.COSINE, 
        limit=top_k
    ).get()

    return [doc.to_dict() for doc in results]