from PyPDF2 import PdfReader
from docx import Document
from io import BytesIO
from services.vectorDB_service import get_embedding



def extract_text(content, filename: str):

    if filename.endswith(".pdf"):
        reader = PdfReader(BytesIO(content))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text

    elif filename.endswith(".txt"):
        return content.decode("utf-8")

    elif filename.endswith(".docx"):
        doc = Document(BytesIO(content))   
        return "\n".join([para.text for para in doc.paragraphs])

    else:
        raise ValueError("Unsupported file type")



def chunk_text(text, chunk_size=300, overlap=50):
    words = text.split()
    chunks = []

    i = 0
    while i < len(words):
        chunk = words[i:i + chunk_size]
        chunks.append(" ".join(chunk))  
        i += chunk_size - overlap

    return chunks


