
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, PDFData, Language } from '../types';
import { chatWithManuscript } from '../services/geminiService';
import { translations } from '../translations';

interface ChatInterfaceProps {
  pdf: PDFData;
  lang: Language;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ pdf, lang }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithManuscript(pdf.base64, messages, input, lang);
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', content: lang === 'ar' ? "فشل الاتصال بالمحراب العصبي." : "Neural link failure." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] relative overflow-hidden">
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto px-3 md:px-10 pt-4 md:pt-8 pb-40 md:pb-44 scrollbar-none"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-20">
            <h3 className="text-lg md:text-xl font-black uppercase tracking-widest text-white mb-2">{t.dialogue}</h3>
            <p className="text-[10px] md:text-xs max-w-xs leading-relaxed px-6">{t.dialogueDesc}</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const ar = isArabic(msg.content);
          return (
            <div key={i} className={`flex w-full mb-6 md:mb-10 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div 
                className={`flex gap-3 md:gap-4 w-full md:max-w-[85%] ${msg.role === 'user' ? (lang === 'ar' ? 'flex-row' : 'flex-row-reverse') : (lang === 'ar' ? 'flex-row-reverse' : 'flex-row')}`}
                dir={ar ? 'rtl' : 'ltr'}
              >
                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl shrink-0 flex items-center justify-center text-[10px] font-black border ${msg.role === 'user' ? 'bg-indigo-600 border-indigo-500 shadow-lg' : 'bg-white/5 border-white/10'}`}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </div>
                
                <div className="flex flex-col flex-1 min-w-0">
                  <div className={`rounded-2xl px-4 md:px-6 py-3 md:py-4 shadow-2xl border ${
                    msg.role === 'user' 
                      ? 'bg-[#151515] text-white border-white/5' 
                      : 'bg-[#0a0a0a] text-white/90 border-white/[0.03]'
                  }`}>
                    <div className={`prose prose-invert prose-sm md:prose-base max-w-none ${ar ? 'text-right' : 'text-left'}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          h3({ children }) {
                            return <h3 className={`text-indigo-400 font-black mt-4 mb-2 md:mt-6 md:mb-3 ${ar ? 'border-r-4 pr-3 md:pr-4' : 'border-l-4 pl-3 md:pl-4'} border-indigo-500`}>{children}</h3>
                          },
                          p({ children }) {
                            return <p className="leading-relaxed mb-3 md:mb-4">{children}</p>
                          },
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeStr = String(children).replace(/\n$/, '');
                            const id = `code-${i}`;

                            return !inline && match ? (
                              <div className="relative my-4 rounded-xl overflow-hidden border border-white/10" dir="ltr">
                                <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                                  <span className="text-[9px] font-bold text-white/30 uppercase">{match[1]}</span>
                                  <button onClick={() => handleCopy(codeStr, id)} className="text-[9px] text-white/40 hover:text-white uppercase font-black">
                                    {copiedId === id ? "Copied!" : "Copy"}
                                  </button>
                                </div>
                                <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" className="!m-0 !bg-black !p-4 text-xs" {...props}>
                                  {codeStr}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <code className={`${className} bg-white/10 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs`} {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {isLoading && (
          <div className="flex justify-start mb-10 px-4">
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
             </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 md:p-6 pb-6 md:pb-12 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent z-20">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative flex items-center bg-[#111111]/90 backdrop-blur-2xl border border-white/10 rounded-xl md:rounded-2xl overflow-hidden min-h-[54px] md:min-h-[60px] shadow-2xl">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={t.placeholder}
                className={`w-full bg-transparent px-5 md:px-6 py-4 focus:outline-none text-white text-sm md:text-base placeholder:text-white/10 resize-none ${lang === 'ar' ? 'text-right' : ''}`}
              />
              <button 
                type="submit"
                disabled={isLoading || !input.trim()}
                className={`absolute ${lang === 'ar' ? 'left-2' : 'right-2'} p-2 text-indigo-400 hover:text-white transition-all disabled:opacity-20`}
              >
                <div className="bg-indigo-500/10 p-2 rounded-lg">
                  <svg className={`w-5 h-5 md:w-6 h-6 ${lang === 'ar' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9-7-9-7V19z" />
                  </svg>
                </div>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
