
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, PDFData, Language } from '../types';
import { chatWithManuscriptStream, getManuscriptSnippets } from '../services/geminiService';
import { translations } from '../translations';

interface ChatInterfaceProps {
  pdf: PDFData;
  lang: Language;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ lang }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [currentSnippet, setCurrentSnippet] = useState("");
  const [usedSnippets, setUsedSnippets] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      const snippets = getManuscriptSnippets();
      const updateSnippet = () => {
        if (snippets.length > 0) {
          const available = snippets.filter(s => !usedSnippets.has(s));
          const source = available.length > 0 ? available : snippets;
          const random = source[Math.floor(Math.random() * source.length)];
          setCurrentSnippet(random);
          setUsedSnippets(prev => new Set(prev).add(random));
        }
      };
      
      updateSnippet();
      interval = setInterval(updateSnippet, 6000);
    }
    return () => clearInterval(interval);
  }, [isLoading, usedSnippets]);

  const handleAutoScroll = () => {
    if (scrollRef.current) {
      const { scrollHeight, clientHeight } = scrollRef.current;
      scrollRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'auto' // Changed to 'auto' for faster scrolling during streaming
      });
    }
  };

  // تفعيل التمرير التلقائي السريع أثناء توليد النص
  useEffect(() => {
    if (isLoading) {
      handleAutoScroll();
    }
  }, [messages, isLoading]);

  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    const userMessage: Message = { role: 'user', content: userText };
    
    setMessages(prev => [...prev, userMessage, { role: 'model', content: '' }]);
    setInput('');
    setIsLoading(true);

    let accumulatedResponse = "";

    try {
      await chatWithManuscriptStream(userText, lang, (chunk) => {
        accumulatedResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { 
            role: 'model', 
            content: accumulatedResponse 
          };
          return newMessages;
        });
      });
    } catch (error) {
      console.error("Stream error:", error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { 
          role: 'model', 
          content: lang === 'ar' ? "عذراً، انقطع الاتصال بالمحراب." : "Neural link failure." 
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] relative overflow-hidden">
      <style>{`
        @keyframes cinematicFade {
          0% { opacity: 0; filter: blur(12px); transform: translateY(20px) scale(0.95); }
          15% { opacity: 1; filter: blur(0); transform: translateY(0) scale(1); }
          85% { opacity: 1; filter: blur(0); transform: translateY(0) scale(1); }
          100% { opacity: 0; filter: blur(12px); transform: translateY(-20px) scale(1.05); }
        }
        .cinematic-quote-container {
          perspective: 1200px;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 120px;
          padding: 0 20px;
        }
        .cinematic-quote {
          animation: cinematicFade 6s ease-in-out infinite;
          background: linear-gradient(to right, #fff, #a34a28, #fff);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 40px rgba(163,74,40,0.4);
          letter-spacing: 0.03em;
          text-align: center;
          font-style: italic;
          font-weight: 600;
          line-height: 1.8;
          max-width: 800px;
        }
      `}</style>

      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto overflow-x-hidden pt-4 md:pt-6 pb-40 touch-auto"
        style={{ scrollBehavior: 'auto', WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-5xl mx-auto w-full px-3 md:px-6 space-y-8">
          {messages.length === 0 && (
            <div className="py-20 text-center opacity-20">
              <h3 className="text-xl font-black uppercase tracking-[0.3em] text-white mb-2">{t.dialogue}</h3>
              <p className="text-xs max-w-xs mx-auto leading-relaxed">{t.dialogueDesc}</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const ar = isArabic(msg.content);
            const isUser = msg.role === 'user';
            const isStreaming = i === messages.length - 1 && msg.role === 'model' && isLoading;

            return (
              <div key={i} className={`flex w-full animate-in fade-in duration-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`flex gap-3 w-full group/msg ${isUser ? 'max-w-[92%] flex-row-reverse' : 'max-w-full flex-row'}`}
                  dir={ar ? 'rtl' : 'ltr'}
                >
                  <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full shrink-0 flex items-center justify-center text-[8px] font-black border mt-1 ${isUser ? 'bg-indigo-600 border-indigo-500' : 'bg-[#a34a28] border-orange-900 shadow-[0_0_10px_rgba(163,74,40,0.3)]'}`}>
                    {isUser ? 'U' : 'AI'}
                  </div>
                  
                  <div className={`flex-1 min-w-0 relative ${isUser ? 'bg-[#1a1a1a] rounded-2xl px-4 py-3 border border-white/5' : ''}`}>
                    {!isUser && msg.content && (
                      <button 
                        onClick={() => copyToClipboard(msg.content, i)}
                        className="absolute top-0 right-0 md:-right-10 p-2 text-white/20 hover:text-orange-500 transition-colors opacity-0 group-hover/msg:opacity-100"
                        title="Copy Response"
                      >
                        {copiedIndex === i ? (
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        )}
                      </button>
                    )}
                    <div className={`prose prose-invert prose-sm md:prose-base max-w-none ${ar ? 'text-right font-academic' : 'text-left'} ${isStreaming ? 'after:content-["_▋"] after:animate-pulse after:text-orange-500' : ''}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeContent = String(children).replace(/\n$/, '');
                            return !inline && match ? (
                              <div className="relative group/code">
                                <button 
                                  onClick={() => navigator.clipboard.writeText(codeContent)}
                                  className="absolute top-2 right-2 p-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white/40 hover:text-white transition-all opacity-0 group-hover/code:opacity-100 z-10"
                                  title="Copy Code"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                </button>
                                <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" className="rounded-lg !bg-black text-xs !m-2" {...props}>
                                  {codeContent}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <code className="bg-white/10 px-1.5 py-0.5 rounded text-glow-orange font-mono text-xs" {...props}>{children}</code>
                            );
                          },
                          p({children}) { return <p className="mb-3 last:mb-0 leading-relaxed text-white/90">{children}</p> },
                          strong({children}) { return <strong className="text-glow-orange font-bold">{children}</strong> }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="flex flex-col gap-2 w-full max-w-4xl mx-auto">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-orange-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-orange-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-orange-600 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-orange-500/60 animate-pulse">
                    {lang === 'ar' ? 'يتم الآن استحضار جوهر المخطوط...' : 'Summoning the manuscript essence...'}
                  </span>
                </div>
                <div className="cinematic-quote-container">
                  <p key={currentSnippet} className="cinematic-quote text-base md:text-xl">
                    {currentSnippet}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent z-20">
        <div className="max-w-5xl mx-auto">
          <form 
            onSubmit={handleSubmit} 
            className="group relative flex items-end bg-[#1a1a1a]/80 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden focus-within:border-white/20 transition-all duration-300 shadow-2xl"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={t.askPlaceholder}
              className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-white/20 py-4 md:py-6 px-6 md:px-8 text-sm md:text-base resize-none max-h-32 md:max-h-48 scrollbar-none"
              rows={1}
            />
            <div className="p-2 md:p-3">
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={`p-3 md:p-4 rounded-xl md:rounded-2xl transition-all duration-500 ${
                  input.trim() && !isLoading 
                    ? 'bg-orange-600 text-white shadow-[0_0_20px_rgba(234,88,12,0.4)] hover:scale-105 active:scale-95' 
                    : 'bg-white/5 text-white/10'
                }`}
              >
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </form>
          <p className="mt-3 text-center text-[8px] md:text-[10px] text-white/10 font-black tracking-[0.2em] uppercase">
            {t.footerNote}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
