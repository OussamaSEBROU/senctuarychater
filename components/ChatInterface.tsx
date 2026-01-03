
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

const ChatInterface: React.FC<ChatInterfaceProps> = ({ lang }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    const userMessage: Message = { role: 'user', content: userText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithManuscript(userText, lang);
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
        className="flex-1 overflow-y-auto px-4 md:px-10 pt-4 md:pt-8 pb-32 md:pb-40 scrollbar-none"
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
            <div key={i} className={`flex w-full mb-6 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div 
                className={`flex gap-3 max-w-[95%] md:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                dir={ar ? 'rtl' : 'ltr'}
              >
                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-black border ${msg.role === 'user' ? 'bg-indigo-600 border-indigo-500' : 'bg-white/5 border-white/10'}`}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </div>
                
                <div className={`rounded-2xl px-4 py-3 shadow-xl border ${
                  msg.role === 'user' ? 'bg-[#151515] border-white/5' : 'bg-[#0a0a0a] border-white/[0.03]'
                }`}>
                  <div className={`prose prose-invert prose-sm md:prose-base max-w-none ${ar ? 'text-right' : 'text-left'}`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" className="rounded-lg !bg-black text-xs" {...props}>
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className="bg-white/10 px-1 rounded text-indigo-300" {...props}>{children}</code>
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
          );
        })}
        {isLoading && (
          <div className="flex justify-start px-4">
             <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
             </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-center bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
              placeholder={t.placeholder}
              className={`w-full bg-transparent px-5 py-4 focus:outline-none text-white text-sm md:text-base resize-none ${lang === 'ar' ? 'text-right' : ''}`}
            />
            <button type="submit" disabled={isLoading || !input.trim()} className="p-3 text-indigo-400 disabled:opacity-20">
              <svg className={`w-6 h-6 ${lang === 'ar' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9-7-9-7V19z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
