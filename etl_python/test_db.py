import sqlite3
import chromadb
import os

# Rutas (igual que en tu ingest.py)
DATA_DIR = os.path.join("..", "data")
SQLITE_PATH = os.path.join(DATA_DIR, "financial.db")
CHROMA_PATH = os.path.join(DATA_DIR, "vector_store")

def inspeccionar_sistema():
    print("🕵️‍♂️  INICIANDO AUDITORÍA DEL SISTEMA...\n")

    # --- PRUEBA 1: Verificar SQLite (El registro administrativo) ---
    if not os.path.exists(SQLITE_PATH):
        print("❌ Error: No existe el archivo financial.db")
        return

    try:
        conn = sqlite3.connect(SQLITE_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT ticker, filename, processed_date FROM processed_docs LIMIT 5")
        rows = cursor.fetchall()
        
        cursor.execute("SELECT Count(*) FROM processed_docs")
        count = cursor.fetchone()[0]
        
        print(f"✅ SQLite Estado: OK")
        print(f"   - Archivos procesados: {count}")
        print(f"   - Últimos 3 registros:")
        for r in rows[:3]:
            print(f"     * {r[0]} | {r[1]}")
        conn.close()
    except Exception as e:
        print(f"❌ Error leyendo SQLite: {e}")

    print("\n" + "-"*30 + "\n")

    # --- PRUEBA 2: Verificar ChromaDB (La memoria de la IA) ---
    if not os.path.exists(CHROMA_PATH):
        print("❌ Error: No existe la carpeta vector_store")
        return

    try:
        client = chromadb.PersistentClient(path=CHROMA_PATH)
        # Asegúrate de usar el mismo nombre de colección que en ingest.py
        collection = client.get_collection(name="sec_docs") 
        
        count = collection.count()
        print(f"✅ ChromaDB Estado: OK")
        print(f"   - Fragmentos de memoria (chunks): {count}")
        
        if count > 0:
            # --- PRUEBA 3: Prueba de Búsqueda Real (RAG) ---
            print("\n🧪 PRUEBA DE FUEGO: Buscando 'risk factors'...")
            results = collection.query(
                query_texts=["risk factors market competition"],
                n_results=1
            )
            
            # Mostramos un trocito de lo que encontró
            found_text = results['documents'][0][0][:200]
            metadata = results['metadatas'][0][0]
            
            print(f"   - Búsqueda exitosa. Encontrado en: {metadata['source']}")
            print(f"   - Extracto: \"{found_text}...\"")
        else:
            print("⚠️ ChromaDB existe pero está vacía. Revisa ingest.py")

    except Exception as e:
        print(f"❌ Error leyendo ChromaDB: {e}")
        print("   (Nota: Si dice 'Collection not found', es que ingest.py no guardó nada)")

if __name__ == "__main__":
    inspeccionar_sistema()
