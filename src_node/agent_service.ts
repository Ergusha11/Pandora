import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import * as logic from './logic.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurar entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- 1. DEFINICIÓN DE AGENTES ESPECIALISTAS (TOOLS) ---

const tools = [
  // TECHNICAL AGENT
  new DynamicStructuredTool({
    name: "get_stock_price",
    description: "Technical Agent: Gets current price, changes, and market metrics. Input must be a SINGLE ticker (e.g. 'AAPL'). For multiple stocks, call this tool multiple times.",
    schema: z.object({ ticker: z.string() }),
    func: async ({ ticker }) => {
      try {
          const data = await logic.getStockPrice(ticker);
          const range = data.fiftyTwoWeekRange ? `${data.fiftyTwoWeekRange.low} - ${data.fiftyTwoWeekRange.high}` : "N/A";
          return JSON.stringify({
             price: data.regularMarketPrice,
             percent_change: data.regularMarketChangePercent,
             fifty_two_week_range: range,
             currency: data.currency
          });
      } catch (e: any) { return `Error getting price: ${e.message}`; }
    },
  }),

  // FUNDAMENTAL AGENT (RAG)
  new DynamicStructuredTool({
    name: "search_financial_docs",
    description: "Fundamental Agent: Searches 10-K/10-Q reports (risks, debt, strategy). Input ticker must be a SINGLE ticker.",
    schema: z.object({ query: z.string(), ticker: z.string().optional() }),
    func: async ({ query, ticker }) => {
      try {
          const docs = await logic.searchFinancialDocs(query, 3, ticker);
          if (!docs || docs.length === 0) return "No relevant information found in local documents.";
          return docs.map(d => `[Source: ${d.metadata.source}]\n${d.text}`).join("\n\n");
      } catch (e: any) { return `Error searching docs: ${e.message}`; }
    },
  }),

  // NEWS AGENT
  new DynamicStructuredTool({
    name: "search_news",
    description: "News Agent: Searches for recent events, sentiment, and headlines. Input must be a SINGLE ticker.",
    schema: z.object({ ticker: z.string() }),
    func: async ({ ticker }) => {
      try {
          const news = await logic.getCompanyNews(ticker);
          if (!news || news.length === 0) return "No recent news found.";
          return news.map((n: any) => `- [${new Date(n.providerPublishTime * 1000).toLocaleDateString()}] ${n.title} (${n.publisher})`).join("\n");
      } catch (e: any) { return `Error searching news: ${e.message}`; }
    },
  }),

  // UTILITY: LIST COMPANIES
  new DynamicStructuredTool({
    name: "list_available_companies",
    description: "Lists companies currently in the local database.",
    schema: z.object({}), 
    func: async () => {
      const files = logic.getProcessedFiles();
      const tickers = [...new Set(files.map((f: any) => f.ticker))];
      return `Ingested companies: ${tickers.join(", ")}`;
    },
  })
];

// --- 2. CONFIGURAR EL CEREBRO (LLM) ---
let model: any;
let selectedModelName = "";
if (process.env.DEEPSEEK_API_KEY) {
    selectedModelName = "DeepSeek (deepseek-chat)";
    model = new ChatOpenAI({
        modelName: "deepseek-chat",
        apiKey: process.env.DEEPSEEK_API_KEY,
        configuration: { baseURL: "https://api.deepseek.com" },
        temperature: 0, 
    });
} else if (process.env.GEMINI_API_KEY) {
    selectedModelName = "Gemini (gemini-pro)";
    model = new ChatGoogleGenerativeAI({
        model: "gemini-pro",
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0,
    });
} else {
    selectedModelName = "OpenAI (gpt-3.5-turbo)";
    // Fallback por si acaso
    model = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
}

const modelWithTools = model.bindTools(tools);

// --- 3. FUNCIÓN PRINCIPAL (API WEB) ---
export async function runAgentService(query: string, currentContextTicker?: string) {
    console.log(`🤖 [Agent] Using model: ${selectedModelName}`);
    console.log(`🤖 [Agent] Query: "${query}" (Context: ${currentContextTicker || 'None'})`);

    const systemPrompt = `CRITICAL: You MUST respond EXCLUSIVELY in ENGLISH.
- Ignore the language of the user's query.
- Even if the user asks in Spanish, translate your understanding and answer in English.
- NEVER answer in Spanish.

You are Financial Pandora, an Investment Desk Supervisor.

AVAILABLE ROLES:
1. Technical (Prices, Yahoo)
2. Fundamental (Local SEC Documents)
3. News (Recent Sentiment)

STRATEGY:
- If the user asks "Analyze X", use ALL THREE agents.
- If they only ask for price, use only the Technical agent.
- If you don't find info in documents, state it clearly and suggest searching news.
${currentContextTicker ? `NOTE: The user is viewing the screen for ${currentContextTicker}, assume that ticker if another is not mentioned.` : ''}

Respond in clean Markdown format.`;

    const messages: any[] = [
        new SystemMessage(systemPrompt),
        new HumanMessage(query)
    ];

    // Bucle de Agente (Máx 10 pasos)
    let iterations = 0;
    let finalResponse = "";
    const steps: Array<{ tool: string, args: any, result: string }> = [];

    while (iterations < 10) {
        let response;
        try {
            response = await modelWithTools.invoke(messages);
        } catch (error: any) {
            console.error("❌ Error invoking model:", error.message);
            finalResponse = "I apologize, but I encountered an error while communicating with the AI model. Please try again later.";
            break;
        }

        messages.push(response);

        // Si no llama herramientas, terminamos
        if (!response.tool_calls || response.tool_calls.length === 0) {
            finalResponse = response.content;
            break;
        }

        console.log(`   ⚡ Executing ${response.tool_calls.length} tools...`);

        // Ejecutar herramientas en paralelo
        const toolPromises = response.tool_calls.map(async (toolCall: any) => {
            const tool = tools.find(t => t.name === toolCall.name);
            if (!tool) return new ToolMessage({ tool_call_id: toolCall.id, content: "Tool not found", name: toolCall.name });
            
            const result = await tool.invoke(toolCall.args);
            
            // Guardar el paso para el frontend
            steps.push({
                tool: toolCall.name,
                args: toolCall.args,
                result: typeof result === 'string' ? result : JSON.stringify(result)
            });

            return new ToolMessage({
                tool_call_id: toolCall.id,
                content: result,
                name: toolCall.name
            });
        });

        const toolOutputs = await Promise.all(toolPromises);
        messages.push(...toolOutputs);
        
        iterations++;
    }

    // Si salimos del bucle por límite de iteraciones y no tenemos respuesta final,
    // hacemos una última llamada para forzar una respuesta con lo que tenga.
    if (!finalResponse && iterations >= 10) {
        console.log("   ⚠️ Max iterations reached. Forcing final answer...");
        try {
            // Quitamos las herramientas para obligarlo a responder texto
            const finalModel = model; 
            messages.push(new HumanMessage("Stop searching. Please summarize the information you have gathered so far and answer my original question. Do not use any more tools."));
            const response = await finalModel.invoke(messages);
            finalResponse = response.content;
        } catch (e: any) {
            finalResponse = "I have gathered a lot of information but reached my processing limit. Here is what I found so far: " + steps.map(s => s.result).join("\n\n");
        }
    }

    return { answer: finalResponse, steps };
}