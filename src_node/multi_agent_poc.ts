import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as logic from './logic.js';

// Configuración de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const deepseekKey = process.env.DEEPSEEK_API_KEY;

// --- 1. DEFINICIÓN DE HERRAMIENTAS (ESQUEMA) ---
const TOOLS_DEFINITION: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "consult_sec_docs",
            description: "Busca en documentos financieros oficiales (10-K, 10-Q) para encontrar riesgos, deuda, ingresos y datos fundamentales.",
            parameters: {
                type: "object",
                properties: {
                    ticker: { type: "string", description: "El símbolo de la empresa (ej. AAPL, NVDA)" },
                    query: { type: "string", description: "La pregunta específica sobre los documentos" }
                },
                required: ["ticker", "query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_market_data",
            description: "Obtiene el precio actual, cambios porcentuales y rangos de 52 semanas de Yahoo Finance.",
            parameters: {
                type: "object",
                properties: {
                    ticker: { type: "string", description: "El símbolo de la empresa" }
                },
                required: ["ticker"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_news",
            description: "Busca noticias recientes, artículos y sentimiento de mercado sobre una empresa.",
            parameters: {
                type: "object",
                properties: {
                    ticker: { type: "string", description: "El símbolo de la empresa" }
                },
                required: ["ticker"]
            }
        }
    }
];

// --- 2. FUNCIONES DE LOS AGENTES ---
async function runFundamentalAgent(ticker: string, query: string) {
    console.log(`   🧐 [Tool: Fundamental] Buscando en docs de ${ticker}...`);
    try {
        const docs = await logic.searchFinancialDocs(query, 3, ticker);
        if (docs.length === 0) return "No encontré documentos relevantes en la base de datos local.";
        return `Hallazgos SEC para ${ticker}:\n${docs.map(d => `- ${d.text.substring(0, 150)}...`).join("\n")}`;
    } catch (e: any) { return `Error: ${e.message}`; }
}

async function runTechnicalAgent(ticker: string) {
    console.log(`   📈 [Tool: Técnico] Consultando precio de ${ticker}...`);
    try {
        const priceData = await logic.getStockPrice(ticker);
        const range = priceData.fiftyTwoWeekRange;
        return `Datos Yahoo para ${ticker}: Precio ${priceData.regularMarketPrice}, Cambio ${priceData.regularMarketChangePercent}%, Rango ${range?.low}-${range?.high}`;
    } catch (e: any) { return `Error: ${e.message}`; }
}

async function runNewsAgent(ticker: string) {
    console.log(`   📰 [Tool: Noticias] Buscando noticias de ${ticker}...`);
    try {
        const news = await logic.getCompanyNews(ticker);
        if (!news || news.length === 0) return "No hay noticias recientes.";
        return `Noticias para ${ticker}:\n${news.map((n:any) => `- ${n.title} (${n.publisher})`).join("\n")}`;
    } catch (e: any) { return `Error: ${e.message}`; }
}

// --- 3. ORQUESTADOR CON BUCLE (LOOP) ---
export async function runMultiAgentSystem(userQuery: string) {
    console.log(`\n🤖 [Agente Autónomo] Objetivo: "${userQuery}"`);

    if (!deepseekKey) { console.error("❌ Se requiere DeepSeek API Key"); return; }
    
    const openaiClient = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: deepseekKey });
    
    // Historial de conversación (Memoria a Corto Plazo)
    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: "Eres Financial Pandora. Tienes herramientas: 'consult_sec_docs', 'get_market_data', 'search_news'. Úsalas SIEMPRE que necesites datos reales. Si el usuario pide varias cosas, llama a varias herramientas en paralelo." },
        { role: "user", content: userQuery }
    ];

    let turns = 0;
    const MAX_TURNS = 5; // Evitar loops infinitos

    while (turns < MAX_TURNS) {
        turns++;
        // console.log(`   🔄 Turno ${turns}...`);

        const completion = await openaiClient.chat.completions.create({
            messages: messages,
            model: "deepseek-chat",
            tools: TOOLS_DEFINITION,
            tool_choice: "auto"
        });

        const msg = completion.choices[0].message;
        messages.push(msg); // Guardamos la respuesta del asistente en memoria

        // CASO A: El modelo quiere responder texto final
        if (!msg.tool_calls || msg.tool_calls.length === 0) {
            console.log("\n>>> RESPUESTA FINAL <<<");
            console.log(msg.content);
            console.log("-----------------------\n");
            return;
        }

        // CASO B: El modelo quiere usar herramientas
        console.log(`   ⚡ Ejecutando ${msg.tool_calls.length} herramientas...`);
        
        const toolOutputs = await Promise.all(msg.tool_calls.map(async (toolCall) => {
            const args = JSON.parse(toolCall.function.arguments);
            const name = toolCall.function.name;
            let output = "";

            if (name === "consult_sec_docs") output = await runFundamentalAgent(args.ticker, args.query || userQuery);
            else if (name === "get_market_data") output = await runTechnicalAgent(args.ticker);
            else if (name === "search_news") output = await runNewsAgent(args.ticker);
            else output = "Error: Herramienta no encontrada. Usa solo las listadas.";

            return {
                tool_call_id: toolCall.id,
                role: "tool" as const,
                name: name,
                content: output
            };
        }));

        // Agregamos los resultados al historial para que el modelo los lea en el siguiente turno
        messages.push(...toolOutputs);
    }
}

// --- EJECUCIÓN ---
const query = process.argv[2] || "Analiza NVDA: precio, noticias y riesgos.";
runMultiAgentSystem(query);