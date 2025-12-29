#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as logic from './logic.js';

// --- DEFINICIÓN DEL SERVIDOR MCP ---
const server = new Server(
  {
    name: "financial-advisor-node",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// --- LISTA DE HERRAMIENTAS ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_stock_price",
        description: "Gets current price and metrics for a stock.",
        inputSchema: {
          type: "object",
          properties: {
            ticker: { type: "string" },
          },
          required: ["ticker"],
        },
      },
      {
        name: "search_financial_docs",
        description: "Searches qualitative info in memory (RAG) from reports.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            n_results: { type: "number" },
            ticker: { type: "string", description: "Optional: Filter by company" }
          },
          required: ["query"],
        },
      },
      {
        name: "get_processed_files_info",
        description: "Lists analyzed files.",
        inputSchema: {
          type: "object",
          properties: {}, 
        },
      }
    ],
  };
});

// --- EJECUCIÓN DE HERRAMIENTAS ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_stock_price") {
      const ticker = String(args?.ticker).toUpperCase();
      const data = await logic.getStockPrice(ticker);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            symbol: data.symbol,
            price: data.regularMarketPrice,
            change_percent: data.regularMarketChangePercent?.toFixed(2) + "%",
            market_cap: data.marketCap,
            pe_ratio: data.trailingPE
          }, null, 2)
        }],
      };
    }

    if (name === "search_financial_docs") {
      const query = String(args?.query);
      const n = Number(args?.n_results) || 3;
      const ticker = args?.ticker ? String(args?.ticker) : undefined;

      const results = await logic.searchFinancialDocs(query, n, ticker);
      
      let responseText = `Found ${results.length} fragments:\n\n`;
      results.forEach((item) => {
        responseText += `--- SOURCE: ${item.metadata?.source} (Ticker: ${item.metadata?.ticker}) ---\n\"${item.text}\"\n\n`;
      });

      return { content: [{ type: "text", text: responseText }] };
    }

    if (name === "get_processed_files_info") {
      const rows = logic.getProcessedFiles();
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }

    throw new Error(`Unknown tool: ${name}`);

  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
