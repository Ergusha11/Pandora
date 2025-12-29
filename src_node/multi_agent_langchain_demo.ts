import { z } from "zod"; // Validación de tipos estándar
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import * as logic from './logic.js';

// --- 1. DEFINICIÓN DE HERRAMIENTAS (Usando Zod) ---
// LangChain usa 'Zod' para validar los inputs ANTES de llamar a la función.
// Esto evita que el agente envíe números donde van textos.

const tools = [
  new DynamicStructuredTool({
    name: "consult_sec_docs",
    description: "Busca en documentos financieros 10-K/10-Q.",
    schema: z.object({
      ticker: z.string().describe("El símbolo de la acción (ej. AAPL)"),
      query: z.string().describe("La pregunta específica")
    }),
    func: async ({ ticker, query }) => {
      const docs = await logic.searchFinancialDocs(query, 3, ticker);
      return docs.map(d => d.text).join("\n");
    },
  }),

  new DynamicStructuredTool({
    name: "get_market_data",
    description: "Obtiene precio actual de Yahoo Finance.",
    schema: z.object({
      ticker: z.string()
    }),
    func: async ({ ticker }) => {
      const data = await logic.getStockPrice(ticker);
      return JSON.stringify(data);
    },
  }),
];

// --- 2. EL MODELO (LA ABSTRACCIÓN) ---
// AQUÍ está la ventaja: Si quieres usar Gemini, solo cambias "ChatOpenAI"
// por "ChatGoogleGenerativeAI". El resto del código NO SE TOCA.

const llm = new ChatOpenAI({
  model: "deepseek-chat", 
  temperature: 0,
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: { baseURL: "https://api.deepseek.com" }
});

// --- 3. EL CEREBRO (AGENTE) ---
// LangChain ya tiene plantillas pre-armadas para el bucle.

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "Eres Financial Pandora. Usa tus herramientas para analizar acciones."],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"], // <--- Aquí LangChain inyecta el historial de herramientas automáticamente
]);

// --- EJECUCIÓN ---
async function main() {
  // Creamos el agente (MOVIDO DENTRO DE MAIN)
  const agent = await createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  const executor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
  });

  console.log("🚀 Iniciando LangChain Agent...");
  const result = await executor.invoke({
    input: "Analiza NVDA: precio y riesgos en documentos.",
  });
  
  console.log("RESPUESTA FINAL:", result.output);
}

main();
