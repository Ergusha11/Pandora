
import * as logic from './logic.js';

async function testComplexSearch() {
    const query = "risks related to international operations and foreign currency";
    const ticker = "AAPL";
    
    console.log(`🤖 Pregunta compleja: "${query}" para ${ticker}`);
    
    try {
        // Pedimos 3 resultados para ver la variedad
        const results = await logic.searchFinancialDocs(query, 3, ticker);
        
        if (results.length === 0) {
            console.log("⚠️ No se encontraron resultados.");
            return;
        }

        console.log(`✅ Se encontraron ${results.length} fragmentos relevantes.\n
`);

        results.forEach((res, index) => {
            console.log(`--- Fragmento #${index + 1} (Score de relevancia implícito) ---`);
            // Limpiamos saltos de línea extra para visualizar mejor
            const cleanSnippet = res.text.replace(/\s+/g, ' ').substring(0, 300);
            console.log(`📜 Contenido: "...${cleanSnippet}..."`);
            console.log(`📍 Fuente: ${res.metadata.source}`);
            console.log("");
        });

    } catch (e) {
        console.error("❌ ERROR:", e);
    }
}

testComplexSearch();
