import yahooFinance from 'yahoo-finance2';
import { ChromaClient } from 'chromadb';
// @ts-ignore
import { DefaultEmbeddingFunction } from '@chroma-core/default-embed';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURACIÓN DE RUTAS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../data/financial.db'); 

// Inicializar clientes
const db = new Database(DB_PATH, { readonly: true });
// Usamos localhost que sabemos que funciona según diag_chroma.ts
const chromaClient = new ChromaClient({ host: "localhost", port: 8000 });

// --- FUNCIONES CENTRALES ---

export async function getStockPrice(ticker: string) {
    const yf = new yahooFinance();
    // @ts-ignore
    if (yf.suppressNotices) yf.suppressNotices(['yahooSurvey']);

    const quote = await yf.quote(ticker);
    
    if (!quote) throw new Error(`Ticker not found: ${ticker}`);
    
    // Devolvemos objeto crudo para que la API o MCP lo formateen como quieran
    return quote;
}

export async function getStockHistory(ticker: string) {
    // Necesario para las gráficas de la GUI
    const yf = new yahooFinance();
    // @ts-ignore
    if (yf.suppressNotices) yf.suppressNotices(['yahooSurvey']);
    
    // Usamos 'chart' en lugar de 'historical' (que está deprecated)
    // Yahoo espera fechas relativas o strings ISO. 'period1' es el inicio.
    const result = await yf.chart(ticker, { 
        period1: '2024-01-01', 
        interval: '1d' 
    });
    
    // El formato de respuesta de .chart() es ligeramente distinto ({ meta, quotes, ... })
    // Pero quotes suele ser el array que queremos.
    // Si result.quotes existe, lo devolvemos. Si es array directo, también.
    return result.quotes || result;
}

export async function searchFinancialDocs(query: string, nResults: number = 3, filterTicker?: string) {
    const embedder = new DefaultEmbeddingFunction();
    const collection = await chromaClient.getCollection({ 
        name: "sec_docs",
        embeddingFunction: embedder
    });

    const whereClause = filterTicker ? { ticker: filterTicker } : undefined;

    const results = await collection.query({
        queryTexts: [query],
        nResults: nResults,
        where: whereClause // Filtro opcional por ticker
    });

    // Aplanamos resultados para facilitar consumo
    const docs = results.documents[0];
    const metadatas = results.metadatas[0];
    
    return docs.map((text, i) => ({
        text,
        metadata: metadatas[i]
    }));
}

export async function getCompanyNews(ticker: string) {
    const yf = new yahooFinance();
    // @ts-ignore
    if (yf.suppressNotices) yf.suppressNotices(['yahooSurvey']);

    try {
        const result = await yf.search(ticker, { newsCount: 5 });
        return result.news || [];
    } catch (e) {
        console.error("Error buscando noticias:", e);
        return [];
    }
}

export function getProcessedFiles() {
    const stmt = db.prepare('SELECT ticker, filename, processed_date FROM processed_docs ORDER BY processed_date DESC LIMIT 20');
    return stmt.all();
}
