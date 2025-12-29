
import * as logic from './logic.js';

async function testSearch() {
    console.log("Probando searchFinancialDocs...");
    try {
        const results = await logic.searchFinancialDocs("risk factors", 1, "AAPL");
        if (results.length > 0) {
            const text = results[0].text;
            console.log(`--- Resultado 1 ---`);
            console.log(`Longitud: ${text.length} caracteres`);
            console.log(`Inicio (200 chars):\n${text.substring(0, 200)}...`);
            console.log(`\nFinal (200 chars):\n...${text.substring(text.length - 200)}`);
        } else {
            console.log("No se encontraron resultados.");
        }
    } catch (e) {
        console.error("ERROR en searchFinancialDocs:", e);
    }
}

testSearch();
