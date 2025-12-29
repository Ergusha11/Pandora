import { useMemo } from 'react';
import { 
  Area, 
  AreaChart, 
  CartesianGrid, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ChartData, StockData } from '../services/api';

interface StockChartProps {
    data: ChartData[];
    info: StockData | null;
}

export function StockChart({ data, info }: StockChartProps) {
    // Calcular color de tendencia (Verde/Rojo)
    const isPositive = useMemo(() => {
        if (!data || data.length < 2) return true;
        return data[data.length - 1].close >= data[0].close;
    }, [data]);

    const color = isPositive ? "#22c55e" : "#ef4444"; // Tailwind green-500 / red-500

    if (!data || data.length === 0) return <div className="text-center p-10 text-muted-foreground">Loading chart...</div>;

    return (
        <Card className="col-span-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle className="text-2xl font-bold">
                        {info?.symbol || "TICKER"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        {info?.longBusinessSummary ? info.longBusinessSummary.slice(0, 150) + "..." : "Loading info..."}
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold">${info?.regularMarketPrice?.toFixed(2)}</div>
                    <div className="flex items-center justify-end gap-2">
                        {info?.marketState && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                {info.marketState}
                            </Badge>
                        )}
                        {info?.regularMarketChangePercent !== undefined && (
                            <Badge variant={info.regularMarketChangePercent >= 0 ? "default" : "destructive"}>
                                {info.regularMarketChangePercent > 0 ? "+" : ""}
                                {(info.regularMarketChangePercent * 100).toFixed(2)}%
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis 
                                dataKey="date" 
                                tickFormatter={(str) => new Date(str).toLocaleDateString()}
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                minTickGap={30}
                            />
                            <YAxis 
                                domain={['auto', 'auto']} 
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickFormatter={(val) => `$${val}`}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: "hsl(var(--card))", 
                                    borderColor: "hsl(var(--border))",
                                    color: "hsl(var(--card-foreground))"
                                }}
                                itemStyle={{ color: "hsl(var(--foreground))" }}
                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                formatter={(value: number | undefined) => [value ? `$${value.toFixed(2)}` : '', "Price"]}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="close" 
                                stroke={color} 
                                fillOpacity={1} 
                                fill="url(#colorPrice)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
