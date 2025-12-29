import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

export interface StockData {
    symbol: string;
    regularMarketPrice: number;
    currency: string;
    regularMarketChangePercent: number;
    marketCap: number;
    marketState?: string;
    longBusinessSummary?: string;
}

export interface ChartData {
    date: string;
    close: number;
    high: number;
    low: number;
    open: number;
    volume: number;
}

export interface ChatResponse {
    answer: string;
    steps?: {
        tool: string;
        args: any;
        result: string;
    }[];
    sources: {
        text: string;
        metadata: {
            source: string;
            ticker: string;
            type: string;
        }
    }[];
}

export const api = {
    // ... (otros métodos igual)
    getStock: async (ticker: string) => {
        const response = await axios.get(`${API_URL}/stock/${ticker}`);
        return response.data as { quote: StockData, history: ChartData[] };
    },

    getAvailableFiles: async () => {
        const response = await axios.get(`${API_URL}/files`);
        return response.data as { tickers: string[], files: any[] };
    },

    // Chatear con el RAG
    chat: async (query: string, ticker?: string) => {
        const response = await axios.post(`${API_URL}/chat`, { query, ticker });
        return response.data as ChatResponse;
    }
};
