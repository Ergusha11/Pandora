import { runAgentService } from './agent_service.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurar entorno (necesario si se ejecuta directamente)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testComparison() {
    const query = "Can you give a comparision between AVGO and NVIDIA?";
    console.log(`🧪 TEST: Running query: "${query}"`);

    try {
        const result = await runAgentService(query);
        
        console.log("\n✅ RESULT RECEIVED:");
        console.log("---------------------------------------------------");
        console.log(result.answer);
        console.log("---------------------------------------------------");
        
        if (result.steps && result.steps.length > 0) {
            console.log(`\n🛠️ TOOLS EXECUTED (${result.steps.length}):`);
            result.steps.forEach((step: any, i: number) => {
                console.log(`  ${i + 1}. Tool: ${step.tool}`);
                console.log(`     Args: ${JSON.stringify(step.args)}`);
                // Limit output log
                const output = step.result.length > 100 ? step.result.substring(0, 100) + "..." : step.result;
                console.log(`     Result: ${output}`);
            });
        } else {
            console.log("\n⚠️ No tools were executed.");
        }

    } catch (error: any) {
        console.error("\n❌ TEST FAILED:", error.message);
        console.error(error);
    }
}

testComparison();
