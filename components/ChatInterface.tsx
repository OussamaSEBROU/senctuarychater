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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    setMessages(prev => [...prev, { role: 'user', content: userText }, { role: 'model', content: '' }]);
    setInput('');
    setIsLoading(true);

    let accumulated = "";
    try {
      await chatWithManuscriptStream(userText, lang, (chunk) => {
        accumulated += chunk;
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'model', content: accumulated };
          return next;
        });
      });
    } catch (error) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'model', content: lang === 'ar' ? "خطأ في الاتصال." : "Connection error." };
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] relative overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-32">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
            <h3 className="text-xl font-black uppercase tracking-[0.3em] mb-2">{t.dialogue}</h3>
            <p className="text-xs max-w-xs mx-auto">{t.dialogueDesc}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
            <div className={`max-w-[85%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-white/5 border border-white/10' : 'bg-transparent'}`}>
              <div className={`prose prose-invert prose-sm md:prose-base ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
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
                        <code className="bg-white/10 px-1 rounded text-orange-500" {...props}>{children}</code>
                      );
                    }
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}

        {isLoading && !messages[messages.length - 1].content && (
          <div className="flex justify-start animate-pulse">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full delay-75"></div>
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full delay-150"></div>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 pr-16 focus:outline-none focus:border-orange-500/50 transition-colors"
          />
          <button type="submit" disabled={isLoading} className="absolute right-2 top-2 bottom-2 px-4 bg-orange-600 hover:bg-orange-500 rounded-xl transition-colors disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
