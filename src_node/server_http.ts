import express from 'express';
import cors from 'cors';
import * as logic from './logic.js';
import { runAgentService } from './agent_service.js';

const app = express();
const PORT = 3000;

app.use(cors()); 
app.use(express.json());

// 1. Endpoint: Datos de una acción (Precio + Histórico para Gráficas)
app.get('/api/stock/:ticker', async (req, res) => {
    try {
        const ticker = req.params.ticker.toUpperCase();
        
        // Ejecutamos en paralelo para rapidez
        const [quote, history] = await Promise.all([
            logic.getStockPrice(ticker),
            logic.getStockHistory(ticker)
        ]);
        
        res.json({ quote, history });
    } catch (error: any) {
        console.error(`Error en /api/stock/${req.params.ticker}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. Endpoint: Chat INTELIGENTE (Agente)
app.post('/api/chat', async (req, res) => {
    try {
        const { query, ticker } = req.body;
        if (!query) return res.status(400).json({ error: "Falta 'query'" });

        console.log(`🤖 Agente consultado: "${query}" (Contexto: ${ticker || 'General'})`);

        // Ejecutamos el agente completo
        const { answer, steps } = await runAgentService(query, ticker);

        // Devolvemos respuesta. 
        res.json({ 
            answer,
            steps,
            sources: [] // El agente ya cita las fuentes en su texto, pero mantenemos compatibilidad
        });
    } catch (error: any) {
        console.error("Error en agente:", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Endpoint: Lista de Tickers disponibles
app.get('/api/files', (req, res) => {
    try {
        const files = logic.getProcessedFiles();
        // Extraemos tickers únicos
        const tickers = [...new Set(files.map((f: any) => f.ticker))];
        res.json({ files, tickers });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ API Web corriendo en http://localhost:${PORT}`);
    console.log(`   - GET /api/stock/:ticker`);
    console.log(`   - POST /api/chat`);
    console.log(`   - GET /api/files`);
});