import { ChromaClient } from 'chromadb';
// @ts-ignore
import { DefaultEmbeddingFunction } from '@chroma-core/default-embed';

async function diag() {
    console.log("🔍 Probando conexión a ChromaDB en localhost:8000...");
    try {
        const client = new ChromaClient({ host: "localhost", port: 8000 });
        
        // 1. Ver si responde el latido
        const heartbeat = await client.heartbeat();
        console.log("✅ Servidor responde (Heartbeat):", heartbeat);

        // 2. Intentar obtener la colección
        const embedder = new DefaultEmbeddingFunction();
        const collection = await client.getCollection({ 
            name: "sec_docs",
            embeddingFunction: embedder
        });
        const count = await collection.count();
        console.log("✅ Colección 'sec_docs' encontrada. Documentos:", count);

        // 3. Intentar una búsqueda simple
        const results = await collection.query({
            queryTexts: ["riesgos"],
            nResults: 1
        });
        console.log("✅ Búsqueda exitosa. Primer resultado encontrado.");

    } catch (e: any) {
        console.error("❌ ERROR DE DIAGNÓSTICO:");
        console.error(e.message);
        if (e.message.includes("fetch failed")) {
            console.error("👉 CONSEJO: El servidor Chroma NO está corriendo o el puerto 8000 está bloqueado.");
        }
    }
}

diag();
