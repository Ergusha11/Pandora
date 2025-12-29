import os
import glob
import chromadb
import sqlite3
import re
from dotenv import load_dotenv
import uuid

# Eliminamos LlamaParse
# from llama_parse import LlamaParse 

load_dotenv(dotenv_path="../.env")

# 1. CONFIGURACIÓN DE RUTAS Y DBs
DATA_DIR = os.path.join("..", "data")
PDF_DIR = os.path.join(DATA_DIR, "raw_pdfs")
CHROMA_PATH = os.path.join(DATA_DIR, "vector_store")
SQLITE_PATH = os.path.join(DATA_DIR, "financial.db")

# Asegurar que el directorio de Chroma exista
os.makedirs(CHROMA_PATH, exist_ok=True)

# 2. INICIALIZAR CLIENTES
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = chroma_client.get_or_create_collection(name="sec_docs")

def init_sqlite():
    conn = sqlite3.connect(SQLITE_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS processed_docs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT,
            doc_type TEXT,
            filename TEXT,
            processed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def clean_sec_text(text):
    """Limpia la basura técnica de los encabezados de la SEC"""
    # 1. Eliminar etiquetas XML/SGML grandes
    text = re.sub(r'<sec-header>.*?</sec-header>', '', text, flags=re.DOTALL)
    text = re.sub(r'<sec-document>.*?</sec-document>', '', text, flags=re.DOTALL)
    
    # Usamos MULTILINE y $ para evitar escribir \n que pueda romperse al guardar
    flags = re.IGNORECASE | re.MULTILINE
    text = re.sub(r'^<TYPE>.*?$', '', text, flags=flags)
    text = re.sub(r'^<SEQUENCE>.*?$', '', text, flags=flags)
    text = re.sub(r'^<FILENAME>.*?$', '', text, flags=flags)
    text = re.sub(r'^<DESCRIPTION>.*?$', '', text, flags=flags)

    # Eliminar tags HTML comunes para dejar texto limpio (opcional pero útil)
    text = re.sub(r'<[^>]+>', ' ', text) # Reemplaza tags por espacio
    
    # 2. Eliminar líneas de metadatos específicos
    lines = text.splitlines() # splitlines es más seguro
    cleaned_lines = []
    started_content = False
    
    for line in lines:
        if started_content:
            # Reducir múltiples espacios
            clean_line = " ".join(line.split())
            if clean_line:
                cleaned_lines.append(clean_line)
            continue
            
        if "ACCESSION NUMBER:" in line or "CONFORMED SUBMISSION TYPE:" in line or "FILING VALUES:" in line:
            continue
            
        # Si encontramos algo que parece un título real o texto normal
        # Ajustamos heurística: líneas largas o encabezados comunes de 10-K
        if (len(line) > 50 and "|" not in line) or "Item 1." in line or "ITEM 1." in line or "PART I" in line:
            started_content = True
            cleaned_lines.append(line)
             
    if len(cleaned_lines) < 10:
        return text # Fallback
        
    return "\n".join(cleaned_lines)

def process_pdfs():
    extensions = ["*.txt", "*.html", "*.htm", "*.xml"]
    files_to_process = []
    
    for ext in extensions:
        found = glob.glob(os.path.join(PDF_DIR, "**", ext), recursive=True)
        files_to_process.extend(found)
    
    conn = sqlite3.connect(SQLITE_PATH)
    cursor = conn.cursor()

    print(f"🔎 Encontrados {len(files_to_process)} archivos de reporte.")

    for file_path in files_to_process:
        if "full-submission.txt" not in os.path.basename(file_path):
             pass 

        try:
            parts = file_path.split(os.sep)
            ticker = parts[-4] 
            doc_type = parts[-3]
        except IndexError:
            ticker = "UNKNOWN"
            doc_type = "DOC"

        filename = os.path.basename(file_path)

        cursor.execute("SELECT id FROM processed_docs WHERE filename = ? AND ticker = ?", (filename, ticker))
        if cursor.fetchone():
            print(f"⏩ Saltando {ticker} - {filename} (Ya procesado)")
            continue

        print(f"🧠 Procesando {ticker} ({doc_type}) desde {filename} (Local Mode)...")
        
        try:
            # LECTURA LOCAL SIMPLE
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                full_text = f.read()
            
            print("   🧹 Limpiando encabezados técnicos...")
            clean_text = clean_sec_text(full_text)
            
            # Chunking 
            chunk_size = 4000
            overlap = 200
            chunks = []
            for i in range(0, len(clean_text), chunk_size - overlap):
                chunks.append(clean_text[i:i+chunk_size])
            
            if not chunks:
                print("⚠️ No quedaron chunks después de limpiar.")
                continue

            ids = [f"{ticker}_{doc_type}_{str(uuid.uuid4())[:8]}" for _ in chunks]
            metadatas_list = [{"ticker": ticker, "type": doc_type, "source": filename} for _ in chunks]
            
            collection.add(
                documents=chunks,
                metadatas=metadatas_list,
                ids=ids
            )
            
            cursor.execute(
                "INSERT INTO processed_docs (ticker, doc_type, filename) VALUES (?, ?, ?)",
                (ticker, doc_type, filename)
            )
            conn.commit()
            print(f"✅ Guardado {ticker} en Memoria ({len(chunks)} fragmentos).")

        except Exception as e:
            print(f"❌ Error procesando {file_path}: {e}")

    conn.close()

if __name__ == "__main__":
    init_sqlite()
    process_pdfs()
