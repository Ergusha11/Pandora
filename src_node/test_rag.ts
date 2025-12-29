import { ChromaClient } from 'chromadb';
import yahooFinance from 'yahoo-finance2';

async function runTest() {
  console.log("🤖 === INICIANDO SIMULACIÓN DE CONSULTA ===");

  // Intentar importar el embedder por defecto dentro de la función async
  let DefaultEmbeddingFunction;
  try {
    // @ts-ignore
    const mod = await import('@chroma-core/default-embed');
    DefaultEmbeddingFunction = mod.DefaultEmbeddingFunction;
  } catch (e) {
    console.log("Aviso: No se pudo cargar el embedder explícitamente, confiando en auto-detección.");
  }

  // 1. PRUEBA DE DATOS EN VIVO (Yahoo Finance)
  try {
    console.log("\n📈 Consultando precio en vivo de AAPL...");
    const yf = new yahooFinance();
    const quote = await yf.quote('AAPL');
    console.log(`   ✅ Precio Actual: $${quote.regularMarketPrice}`);
    console.log(`   ✅ Cambio: ${quote.regularMarketChangePercent?.toFixed(2)}%`);
  } catch (e) {
    console.error("   ❌ Error en Yahoo Finance:", e.message);
  }

  // 2. PRUEBA DE MEMORIA RAG (ChromaDB)
  try {
    console.log("\n🧠 Consultando Memoria (RAG): 'risk factors'...");
    
    const client = new ChromaClient({ 
      host: "localhost",
      port: 8000
    });
    
    // Configurar el embedder para que coincida con Python
    const embedder = DefaultEmbeddingFunction ? new DefaultEmbeddingFunction() : undefined;
    
    const collection = await client.getCollection({
      name: "sec_docs",
      embeddingFunction: embedder 
    });

    const results = await collection.query({
      queryTexts: ["What are the risk factors for the company?"], // Pregunta típica para un 10-K
      nResults: 1, 
    });

    const doc = results.documents[0][0];
    const meta = results.metadatas[0][0];

    if (doc) {
      console.log(`   ✅ Respuesta encontrada en: ${meta.source}`);
      console.log(`   📜 Fragmento (primeros 200 chars):`);
      console.log(`      "${doc.substring(0, 200)}"...`);
    } else {
      console.log("   ⚠️ No se encontraron documentos relevantes.");
    }

  } catch (e) {
    console.error("   ❌ Error en ChromaDB:", e);
  }
  
  console.log("\n=== FIN DE LA SIMULACIÓN ===");
}

runTest();
