import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, FileText, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '../services/api';
import type { ChatResponse } from '../services/api';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sources?: ChatResponse['sources'];
    steps?: ChatResponse['steps'];
}

interface ChatPanelProps {
    ticker: string;
}

export function ChatPanel({ ticker }: ChatPanelProps) {
    const [chatHistories, setChatHistories] = useState<Record<string, Message[]>>({});
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Obtener mensajes actuales para el ticker o el mensaje inicial
    const currentMessages = chatHistories[ticker] || [
        { role: 'assistant', content: `Hello, I'm Financial Pandora. Ask me anything about ${ticker}'s 10-K reports.` }
    ];

    // Auto-scroll al final
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [currentMessages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input;
        setInput('');
        
        // Actualizar historial localmente con el mensaje del usuario
        const updatedWithUser: Message[] = [...currentMessages, { role: 'user', content: userMsg }];
        setChatHistories(prev => ({
            ...prev,
            [ticker]: updatedWithUser
        }));

        setLoading(true);

        try {
            const result = await api.chat(userMsg, ticker);
            
            const assistantMsg: Message = {
                role: 'assistant',
                content: result.answer,
                sources: result.sources,
                steps: result.steps
            };

            setChatHistories(prev => ({
                ...prev,
                [ticker]: [...(prev[ticker] || updatedWithUser), assistantMsg]
            }));
        } catch (error) {
            setChatHistories(prev => ({
                ...prev,
                [ticker]: [...(prev[ticker] || updatedWithUser), { role: 'assistant', content: "Sorry, there was an error connecting to the AI. Please try again." }]
            }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="h-[600px] flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    AI Assistant (Gemini/DeepSeek)
                </CardTitle>
                <CardDescription>Intelligent analysis of SEC reports</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                <ScrollArea className="flex-1 min-h-0 p-4">
                    <div className="space-y-4">
                        {currentMessages.map((m, i) => (
                            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {m.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <Bot className="w-4 h-4 text-primary" />
                                    </div>
                                )}
                                
                                <div className={`max-w-[85%] space-y-2`}>
                                    {/* SECCIÓN DE PENSAMIENTO (VISIBLE SOLO SI HAY PASOS) */}
                                    {m.steps && m.steps.length > 0 && (
                                        <div className="mb-2 text-xs">
                                            <details className="group">
                                                <summary className="cursor-pointer text-muted-foreground hover:text-primary flex items-center gap-1 font-mono transition-colors select-none">
                                                    <Brain className="w-3 h-3" />
                                                    <span>View thought process ({m.steps.length} steps)</span>
                                                </summary>
                                                <div className="mt-2 pl-2 border-l-2 border-primary/20 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                    {m.steps.map((step, idx) => (
                                                        <div key={idx} className="bg-muted/50 p-2 rounded overflow-hidden">
                                                            <div className="font-bold text-primary mb-1 flex items-center gap-2">
                                                                <span className="bg-primary/10 px-1 rounded text-[10px]">#{idx + 1}</span>
                                                                {step.tool}
                                                            </div>
                                                            <div className="text-[10px] font-mono text-muted-foreground grid gap-1">
                                                                <div className="truncate text-blue-600 dark:text-blue-400">
                                                                    Input: {JSON.stringify(step.args)}
                                                                </div>
                                                                <div className="truncate text-emerald-600 dark:text-emerald-400" title={step.result}>
                                                                    Output: {step.result.slice(0, 150)}{step.result.length > 150 ? '...' : ''}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        </div>
                                    )}

                                    <div className={`p-3 rounded-lg text-sm subpixel-antialiased ${
                                        m.role === 'user' 
                                            ? 'bg-primary text-primary-foreground' 
                                            : 'bg-muted text-foreground shadow-sm'
                                    }`}>
                                        <div className={`prose prose-sm max-w-none break-words
                                            ${m.role === 'user' ? 'prose-invert' : 'dark:prose-invert'}
                                            text-current prose-headings:text-current prose-p:text-current prose-strong:text-current prose-li:text-current
                                            prose-p:m-0 prose-ul:m-0 prose-li:m-0`}
                                        >
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {m.content}
                                            </ReactMarkdown>
                                        </div>
                                    </div>

                                    {/* Mostrar fuentes si existen */}
                                    {m.sources && m.sources.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Sources Consulted:</p>
                                            {m.sources.map((source, idx) => (
                                                <div key={idx} className="bg-card border rounded p-2 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-1 font-semibold mb-1 text-foreground">
                                                        <FileText className="w-3 h-3" />
                                                        {source.metadata.source}
                                                    </div>
                                                    <span className="italic">"...{source.text.slice(0, 150)}..."</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {m.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                                        <User className="w-4 h-4 text-primary-foreground" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {loading && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground ml-10">
                                <span className="animate-spin">⏳</span> Thinking...
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>
                
                <div className="p-4 border-t flex gap-2">
                    <Input 
                        value={input} 
                        onChange={(e) => setInput(e.target.value)} 
                        placeholder="Ask about revenue, risks, strategy..." 
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <Button onClick={handleSend} disabled={loading}>
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}