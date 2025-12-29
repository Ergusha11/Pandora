import { useEffect, useState } from 'react';
import { api } from './services/api';
import type { ChartData, StockData } from './services/api';
import { StockChart } from './components/StockChart';
import { ChatPanel } from './components/ChatPanel';
import { LayoutDashboard, TrendingUp, Search } from 'lucide-react';

function App() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  
  // Datos
  const [stockInfo, setStockInfo] = useState<StockData | null>(null);
  const [history, setHistory] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Cargar lista de tickers disponibles al inicio
  useEffect(() => {
    api.getAvailableFiles().then(data => {
      // Priorizar AAPL si existe, si no el primero
      const list = data.tickers;
      setTickers(list);
      if (list.length > 0) setSelectedTicker('AAPL'); // Default
    }).catch(console.error);
  }, []);

  // 2. Cargar datos cuando cambia el ticker seleccionado
  useEffect(() => {
    if (!selectedTicker) return;

    setLoading(true);
    api.getStock(selectedTicker)
      .then(data => {
        setStockInfo(data.quote);
        // Formatear datos para Recharts
        const cleanHistory = data.history.map((day: any) => ({
           ...day,
           // Yahoo devuelve date como objeto Date a veces, asegurar string/number
           date: new Date(day.date).toISOString() 
        }));
        setHistory(cleanHistory);
      })
      .catch(err => console.error("Error cargando stock:", err))
      .finally(() => setLoading(false));

  }, [selectedTicker]);

  // 3. Auto-refresh de precio cada 30s (Solo si mercado abierto)
  useEffect(() => {
    if (!selectedTicker || !stockInfo) return;

    // Yahoo devuelve 'REGULAR' cuando está abierto.
    const isMarketOpen = stockInfo.marketState === 'REGULAR';
    if (!isMarketOpen) return;

    const intervalId = setInterval(() => {
        api.getStock(selectedTicker).then(data => {
            setStockInfo(data.quote);
            // Actualizar gráfico también por si hay nuevos puntos intradía
            const cleanHistory = data.history.map((day: any) => ({
                ...day,
                date: new Date(day.date).toISOString() 
            }));
            setHistory(cleanHistory);
        }).catch(err => console.error("Error polling stock:", err));
    }, 30000);

    return () => clearInterval(intervalId);
  }, [selectedTicker, stockInfo?.marketState]);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      
      {/* SIDEBAR */}
      <aside className="w-64 border-r bg-muted/20 hidden md:flex flex-col">
        <div className="p-6 border-b flex items-center gap-2 font-bold text-xl text-primary">
          <LayoutDashboard className="w-6 h-6" />
          Pandora 
        </div>
        
        <div className="p-4 space-y-4">
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                My Stocks
            </div>
            <div className="space-y-1">
                {tickers.map(t => (
                    <button
                        key={t}
                        onClick={() => setSelectedTicker(t)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            selectedTicker === t 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <TrendingUp className="w-4 h-4" />
                        {t}
                    </button>
                ))}
            </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 space-y-8 overflow-y-auto">
        
        {/* HEADER MOVIL / BUSCADOR */}
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">Financial Dashboard</h1>
            {loading ? (
              <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full text-sm text-muted-foreground">
                  <Search className="w-4 h-4" />
                  <span>Fetching data for {selectedTicker}...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  <span>{selectedTicker || 'Select a stock'}</span>
              </div>
            )}
        </div>

        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUMNA IZQUIERDA: GRÁFICO (Ocupa 2 columnas) */}
            <div className="lg:col-span-2 space-y-8">
                <StockChart data={history} info={stockInfo} />
                
                {/* Métricas Extra */}
                <div className="grid grid-cols-3 gap-4">
                     <div className="p-4 border rounded-lg bg-card">
                        <div className="text-sm text-muted-foreground">Market Cap</div>
                        <div className="text-xl font-bold">
                            ${(stockInfo?.marketCap || 0).toLocaleString()}
                        </div>
                     </div>
                     <div className="p-4 border rounded-lg bg-card">
                        <div className="text-sm text-muted-foreground">Currency</div>
                        <div className="text-xl font-bold">{stockInfo?.currency || 'USD'}</div>
                     </div>
                     <div className="p-4 border rounded-lg bg-card">
                        <div className="text-sm text-muted-foreground">Symbol</div>
                        <div className="text-xl font-bold text-primary">{stockInfo?.symbol}</div>
                     </div>
                </div>
            </div>

            {/* COLUMNA DERECHA: CHAT (Ocupa 1 columna) */}
            <div className="lg:col-span-1">
                <ChatPanel ticker={selectedTicker} />
            </div>

        </div>
      </main>
    </div>
  );
}

export default App;