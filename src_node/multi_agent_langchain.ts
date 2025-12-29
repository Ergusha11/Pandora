import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import * as logic from './logic.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- 1. DEFINICIÓN DE HERRAMIENTAS (WORKERS) ---
// Usamos LangChain Tools para envolver tus funciones de logic.ts

const tools = [
  new DynamicStructuredTool({
    name: "consult_sec_docs",
    description: "Agente Fundamental: Busca en reportes 10-K/10-Q riesgos, deuda y hechos contables.",
    schema: z.object({
        ticker: z.string().describe("El símbolo de la empresa"),
        query: z.string().describe("La duda específica a resolver con los documentos")
    }),
    func: async ({ ticker, query }) => {
      console.log(`   🧐 [LangChain Tool] Leyendo documentos de ${ticker}...`);
      try {
          const docs = await logic.searchFinancialDocs(query, 3, ticker);
          if (!docs.length) return "No se encontró información en la base de datos local.";
          return docs.map(d => `[Fuente: ${d.metadata.source}] ${d.text.substring(0, 150)}...`).join("\n");
      } catch (e: any) { return `Error: ${e.message}`; }
    },
  }),

  new DynamicStructuredTool({
    name: "get_market_data",
    description: "Agente Técnico: Obtiene precio, cambios y rangos de Yahoo Finance.",
    schema: z.object({ ticker: z.string() }),
    func: async ({ ticker }) => {
      console.log(`   📈 [LangChain Tool] Buscando precio de ${ticker}...`);
      try {
          const data = await logic.getStockPrice(ticker);
          const range = data.fiftyTwoWeekRange ? `${data.fiftyTwoWeekRange.low}-${data.fiftyTwoWeekRange.high}` : "N/A";
          return `Precio: ${data.regularMarketPrice} | Cambio: ${data.regularMarketChangePercent}% | Rango 52s: ${range}`;
      } catch (e: any) { return `Error: ${e.message}`; }
    },
  }),

  new DynamicStructuredTool({
    name: "search_news",
    description: "Agente de Noticias: Busca titulares recientes y sentimiento de mercado.",
    schema: z.object({ ticker: z.string() }),
    func: async ({ ticker }) => {
      console.log(`   📰 [LangChain Tool] Buscando noticias de ${ticker}...`);
      try {
          const news = await logic.getCompanyNews(ticker);
          if (!news || !news.length) return "No hay noticias recientes.";
          return news.map((n: any) => `- ${n.title} (${n.publisher})`).join("\n");
      } catch (e: any) { return `Error: ${e.message}`; }
    },
  })
];

// --- 2. CONFIGURACIÓN DEL MODELO (SUPERVISOR) ---
// Detecta automáticamente si usar DeepSeek o Gemini basado en .env

let model: any;

if (process.env.DEEPSEEK_API_KEY) {
    console.log("🧠 Cerebro: DeepSeek (vía LangChain OpenAI Adapter)");
    model = new ChatOpenAI({
        modelName: "deepseek-chat",
        apiKey: process.env.DEEPSEEK_API_KEY,
        configuration: { baseURL: "https://api.deepseek.com" },
        temperature: 0, // Frío para decisiones lógicas
    });
} else if (process.env.GEMINI_API_KEY) {
    console.log("✨ Cerebro: Google Gemini (vía LangChain Google Adapter)");
    model = new ChatGoogleGenerativeAI({
        model: "gemini-pro",
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0,
    });
} else {
    throw new Error("No API Keys found in .env");
}

// Vinculamos las herramientas al modelo
// LangChain se encarga de traducir 'Zod' al formato JSON Schema que DeepSeek/Gemini entiendan
const modelWithTools = model.bindTools(tools);

// --- 3. BUCLE DE EJECUCIÓN (ORQUESTADOR) ---

async function runLangChainAgent(query: string) {
    console.log(`\n🤖 [LangChain Agent] Pregunta: "${query}"`);

    // Historial inicial
    const messages = [
        new SystemMessage("Eres un Supervisor Financiero Multi-Agente. Tienes expertos en Fundamental (SEC), Técnico (Precios) y Noticias. Úsalos según necesites. Si la pregunta es compleja, usa varios."),
        new HumanMessage(query)
    ];

    let turns = 0;
    while (turns < 5) {
        // 1. El modelo piensa
        const aiMessage = await modelWithTools.invoke(messages);
        messages.push(aiMessage); // Guardamos su respuesta (texto o tool_call)

        // 2. ¿Quiere usar herramientas?
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
            console.log(`   ⚡ Orquestando ${aiMessage.tool_calls.length} llamadas...`);
            
            // 3. Ejecutamos herramientas (Workers)
            for (const toolCall of aiMessage.tool_calls) {
                const tool = tools.find(t => t.name === toolCall.name);
                if (tool) {
                    const toolResult = await tool.invoke(toolCall.args);
                    
                    // 4. Devolvemos el resultado como ToolMessage
                    messages.push(new ToolMessage({
                        tool_call_id: toolCall.id!,
                        content: toolResult,
                        name: toolCall.name
                    }));
                }
            }
        } else {
            // 3. Si no hay tool_calls, es la respuesta final
            console.log("\n>>> RESPUESTA FINAL (LangChain) <<<");
            console.log(aiMessage.content);
            console.log("-----------------------------------\n");
            return;
        }
        turns++;
    }
}

// --- EJECUCIÓN DIRECTA ---
const userQuery = process.argv[2] || "Analiza NVDA: precio, noticias y qué dicen los documentos.";
runLangChainAgent(userQuery);
