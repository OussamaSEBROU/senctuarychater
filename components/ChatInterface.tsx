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
      interval = setInterval(updateSnippet, 5000);
    }
    return () => clearInterval(interval);
  }, [isLoading, usedSnippets]);

  const handleAutoScroll = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  useEffect(() => { handleAutoScroll(); }, [messages, isLoading]);

  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userText = input;
    setMessages(prev => [...prev, { role: 'user', content: userText }, { role: 'model', content: '' }]);
    setInput('');
    setIsLoading(true);
    let accumulatedResponse = "";
    try {
      await chatWithManuscriptStream(userText, lang, (chunk) => {
        accumulatedResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'model', content: accumulatedResponse };
          return newMessages;
        });
      });
    } catch (error) {
      console.error("Stream error:", error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: 'model', content: lang === 'ar' ? "عذراً، انقطع الاتصال بالمحراب." : "Neural link failure." };
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
          0% { opacity: 0; filter: blur(10px); transform: translateY(10px); }
          20% { opacity: 1; filter: blur(0); transform: translateY(0); }
          80% { opacity: 1; filter: blur(0); transform: translateY(0); }
          100% { opacity: 0; filter: blur(10px); transform: translateY(-10px); }
        }
        .cinematic-quote {
          animation: cinematicFade 5s ease-in-out infinite;
          color: #fff;
          text-shadow: 0 0 20px rgba(163,74,40,0.5);
          text-align: center;
          font-style: italic;
          font-size: 1.1rem;
          line-height: 1.6;
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          display: block;
        }
      `}</style>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pt-4 pb-40 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {messages.length === 0 && (
            <div className="py-20 text-center opacity-20">
              <h3 className="text-xl font-black uppercase tracking-[0.3em] text-white">{t.dialogue}</h3>
              <p className="text-xs mt-2">{t.dialogueDesc}</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-[#1a1a1a] border border-white/5' : 'bg-transparent'}`}>
                <div className={`prose prose-invert prose-sm ${isArabic(msg.content) ? 'text-right' : 'text-left'}`}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="w-full py-10 flex flex-col items-center justify-center space-y-6">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
              <div className="w-full px-6">
                <p key={currentSnippet} className="cinematic-quote">
                  {currentSnippet}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#050505] to-transparent">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-center bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
              placeholder={t.placeholder}
              className="w-full bg-transparent p-4 text-white focus:outline-none resize-none"
            />
            <button type="submit" disabled={isLoading || !input.trim()} className="p-4 text-white hover:text-orange-500 disabled:opacity-20">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
