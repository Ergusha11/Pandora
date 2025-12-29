import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import * as logic from './logic.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Configurar entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- 1. DEFINIR HERRAMIENTAS ---
const tools = [
  new DynamicStructuredTool({
    name: "get_stock_price",
    description: "Obtiene el precio actual y métricas básicas de una acción.",
    schema: z.object({ ticker: z.string() }),
    func: async ({ ticker }) => {
      const data = await logic.getStockPrice(ticker);
      return JSON.stringify(data);
    },
  }),
  new DynamicStructuredTool({
    name: "search_financial_docs",
    description: "Busca en los reportes 10-K procesados información cualitativa.",
    schema: z.object({ query: z.string(), ticker: z.string().optional() }),
    func: async ({ query, ticker }) => {
      const docs = await logic.searchFinancialDocs(query, 3, ticker);
      if (!docs || docs.length === 0) return "No se encontró información. Verifica si la empresa está en la base de datos usando 'list_available_companies'.";
      return docs.map(d => `[Fuente: ${d.metadata.source}]\n${d.text}`).join("\n\n");
    },
  }),
  new DynamicStructuredTool({
    name: "list_available_companies",
    description: "Lista las empresas (tickers) que tienen reportes procesados en la base de datos local.",
    schema: z.object({}), // Sin argumentos
    func: async () => {
      const files = logic.getProcessedFiles();
      // Extraer tickers únicos
      const tickers = [...new Set(files.map((f: any) => f.ticker))];
      return `Empresas disponibles en base de datos: ${tickers.join(", ")}`;
    },
  })
];

// --- 2. CONFIGURAR EL MODELO ---
let model: any;
if (process.env.LLM_PROVIDER === 'deepseek') {
    model = new ChatOpenAI({
        modelName: "deepseek-chat",
        openAIApiKey: process.env.DEEPSEEK_API_KEY,
        configuration: { baseURL: "https://api.deepseek.com" },
        temperature: 0,
    });
} else if (process.env.GEMINI_API_KEY) {
    model = new ChatGoogleGenerativeAI({
        model: "gemini-2.5-flash",
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0,
    });
} else {
    model = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });
}

// Enlazar herramientas al modelo
const modelWithTools = model.bindTools(tools);

// --- 3. BUCLE DEL AGENTE ---
async function runAgent(input: string) {
    let messages: any[] = [
        ["system", "Eres un Agente Financiero. Usa tus herramientas para dar respuestas precisas."],
        ["human", input]
    ];

    console.log("🤔 Pensando...");
    
    // Paso 1: El modelo decide qué hacer
    let response = await modelWithTools.invoke(messages);
    
    // Si el modelo quiere usar herramientas (loop simple)
    while (response.tool_calls && response.tool_calls.length > 0) {
        messages.push(response);
        
        for (const toolCall of response.tool_calls) {
            const tool = tools.find(t => t.name === toolCall.name);
            console.log(`🛠️ Ejecutando herramienta: ${toolCall.name}...`);
            const result = tool ? await tool.invoke(toolCall.args) : "Herramienta no encontrada";
            
            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result
            });
        }
        
        // Paso 2: El modelo genera la respuesta final con los datos obtenidos
        response = await modelWithTools.invoke(messages);
    }

    return response.content;
}

// --- 4. CLI ---
async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("\n💬 Agente Financiero (Modo Herramientas Directas) listo.");
    
    const ask = () => {
        rl.question('\n> ', async (input) => {
            if (input.toLowerCase() === 'exit') process.exit(0);
            try {
                const answer = await runAgent(input);
                console.log("\n🏁 RESPUESTA:\n", answer);
            } catch (error: any) {
                console.error("Error:", error.message);
            }
            ask();
        });
    };
    ask();
}

main();
