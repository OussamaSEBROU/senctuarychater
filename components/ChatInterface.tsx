
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, PDFData, Language } from '../types';
import { chatWithManuscriptStream } from '../services/geminiService';
import { translations } from '../translations';

interface ChatInterfaceProps {
  pdf: PDFData;
  lang: Language;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ lang }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  // التمرير التلقائي للأسفل عند إضافة رسائل جديدة أو أثناء الـ Streaming
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

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
      {/* حاوية الرسائل مع دعم التمرير اليدوي الكامل واللمس */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto overflow-x-hidden pt-4 md:pt-6 pb-40 scroll-smooth touch-pan-y"
        style={{ WebkitOverflowScrolling: 'touch' }} // تحسين التمرير في iOS
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
                  className={`flex gap-3 w-full ${isUser ? 'max-w-[92%] flex-row-reverse' : 'max-w-full flex-row'}`}
                  dir={ar ? 'rtl' : 'ltr'}
                >
                  <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full shrink-0 flex items-center justify-center text-[8px] font-black border mt-1 ${isUser ? 'bg-indigo-600 border-indigo-500' : 'bg-[#a34a28] border-orange-900 shadow-[0_0_10px_rgba(163,74,40,0.3)]'}`}>
                    {isUser ? 'U' : 'AI'}
                  </div>
                  
                  <div className={`flex-1 min-w-0 ${isUser ? 'bg-[#1a1a1a] rounded-2xl px-4 py-3 border border-white/5' : ''}`}>
                    <div className={`prose prose-invert prose-sm md:prose-base max-w-none ${ar ? 'text-right font-academic' : 'text-left'} ${isStreaming ? 'after:content-["_▋"] after:animate-pulse after:text-orange-500' : ''}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" className="rounded-lg !bg-black text-xs !m-2" {...props}>
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
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
          {/* عنصر مرجعي للتمرير التلقائي */}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent z-20">
        <div className="max-w-5xl mx-auto">
          <form 
            onSubmit={handleSubmit} 
            className="group relative flex items-end bg-[#1a1a1a]/80 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden focus-within:border-white/20 transition-all duration-300 shadow-2xl"
          >
            <textarea
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
              placeholder={t.placeholder}
              className={`w-full bg-transparent px-5 py-4 md:py-5 focus:outline-none text-white text-sm md:text-base resize-none max-h-48 scrollbar-none ${lang === 'ar' ? 'text-right font-academic' : ''}`}
            />
            <div className="p-2 md:p-3">
              <button 
                type="submit" 
                disabled={isLoading || !input.trim()} 
                className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-white text-black rounded-xl md:rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-10"
              >
                <svg className={`w-5 h-5 md:w-6 md:h-6 ${lang === 'ar' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </form>
          <p className="mt-3 text-center text-[8px] md:text-[10px] text-white/10 uppercase tracking-widest font-black">
            Powered by Gemini 3.0 • Real-Time Stream Logic
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
