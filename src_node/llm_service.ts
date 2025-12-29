import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar .env desde la raíz
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- CONFIGURACIÓN DE PROVEEDORES ---

// 1. GEMINI
const geminiKey = process.env.GEMINI_API_KEY;
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

// 2. DEEPSEEK (Compatible con OpenAI SDK)
const deepseekKey = process.env.DEEPSEEK_API_KEY;
const deepseek = deepseekKey ? new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: deepseekKey
}) : null;

// Prompt del Sistema para ambos
const SYSTEM_PROMPT = `
You are Financial Pandora, an expert financial analyst.
Respond to the user's question based EXCLUSIVELY on the provided context.
- If the answer is not in the context, say so.
- Cite the source file (e.g., "according to Apple's 10-K...").
- Be concise and professional.
- ALWAYS respond in the SAME LANGUAGE as the user's query.
`;

export async function generateAnswer(query: string, contextDocs: any[]) {
    // Preparar contexto
    const contextText = contextDocs.map(d => 
        `[Fuente: ${d.metadata.source}]\n${d.text}`
    ).join("\n\n---\n\n");

    const fullPrompt = `CONTEXTO:\n${contextText}\n\nPREGUNTA: ${query}`;

    try {
        // --- OPCIÓN A: USAR DEEPSEEK ---
        if (process.env.LLM_PROVIDER === 'deepseek') {
            if (!deepseek) throw new Error("Falta DEEPSEEK_API_KEY");
            console.log("🧠 Usando DeepSeek...");
            
            const completion = await deepseek.chat.completions.create({
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: fullPrompt }
                ],
                model: "deepseek-chat",
                temperature: 0.3
            });
            return completion.choices[0].message.content;
        }

        // --- OPCIÓN B: USAR GEMINI (Default) ---
        if (!genAI) throw new Error("Falta GEMINI_API_KEY (o DEEPSEEK_API_KEY si prefieres usar ese)");
        console.log("✨ Usando Gemini...");
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([
            SYSTEM_PROMPT,
            fullPrompt
        ]);
        return result.response.text();

    } catch (error: any) {
        console.error("Error Generando Respuesta:", error.message);
        return "Lo siento, hubo un error conectando con el cerebro de la IA. Verifica tus API Keys en el archivo .env.";
    }
}
