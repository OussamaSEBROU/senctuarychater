import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, PDFData, Language } from '../types';
// Updated import to use the new Groq service
import { chatWithManuscriptStream, getManuscriptSnippets } from '../services/groqService';
import { translations } from '../translations';

interface ChatInterfaceProps {
  pdf: PDFData;
  lang: Language;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ lang }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [currentSnippet, setCurrentSnippet] = useState("");
  const [usedSnippets, setUsedSnippets] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  // متغير التحكم في سرعة ظهور المقولات (بالثواني)
  const quoteSpeed = 5;

  // مدة التهدئة بين الأسئلة (بالثواني) لضمان عدم تجاوز RPM 15 // Groq has higher limits but we keep it for UX
  const COOLDOWN_DURATION = 2; 

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
      interval = setInterval(updateSnippet, quoteSpeed * 1000);
    }
    return () => clearInterval(interval);
  }, [isLoading, usedSnippets, quoteSpeed]);

  // إدارة عداد التهدئة
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCooldown && cooldownTimer > 0) {
      timer = setInterval(() => {
        setCooldownTimer(prev => prev - 1);
      }, 1000);
    } else if (cooldownTimer === 0) {
      setIsCooldown(false);
    }
    return () => clearInterval(timer);
  }, [isCooldown, cooldownTimer]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || isCooldown) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessage: Message = { role: 'model', content: '' };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      await chatWithManuscriptStream(
        input,
        messages.map(m => ({ role: m.role, content: m.content })),
        lang,
        (chunk) => {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'model') {
              lastMessage.content += chunk;
            }
            return newMessages;
          });
        }
      );
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'model', content: lang === 'ar' ? 'عذراً، حدث خطأ في الاتصال.' : 'Sorry, a connection error occurred.' }
      ]);
    } finally {
      setIsLoading(false);
      setIsCooldown(true);
      setCooldownTimer(COOLDOWN_DURATION);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-lg font-semibold text-white tracking-tight">
            {lang === 'ar' ? 'المحاور المعرفي' : 'Knowledge Interrogator'}
          </h2>
        </div>
        {isCooldown && (
          <div className="text-xs font-medium text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 animate-fade-in">
            {lang === 'ar' ? `انتظر ${cooldownTimer} ثانية...` : `Wait ${cooldownTimer}s...`}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth custom-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10">
              <svg className="w-10 h-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-xl font-medium text-white">
                {lang === 'ar' ? 'ابدأ الحوار المعرفي' : 'Begin the Knowledge Dialogue'}
              </p>
              <p className="text-sm text-slate-400 max-w-xs mx-auto">
                {lang === 'ar' ? 'اسأل عن أي تفاصيل في المخطوطة وسأجيبك بعمق' : 'Ask about any details in the manuscript and I will answer with depth'}
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div 
              key={i} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div className={`max-w-[85%] group relative ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none px-5 py-3 shadow-lg shadow-blue-900/20' 
                  : 'bg-white/5 text-slate-200 rounded-2xl rounded-tl-none px-6 py-4 border border-white/10'
              }`}>
                <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/10">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
                
                {msg.role === 'model' && msg.content && (
                  <button
                    onClick={() => copyToClipboard(msg.content, i)}
                    className="absolute -right-12 top-0 p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:text-white hover:bg-white/10"
                    title="Copy response"
                  >
                    {copiedIndex === i ? (
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2h2a2 2 0 002 2m0 0h2a2 2 0 002 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none px-6 py-4 max-w-[85%]">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {lang === 'ar' ? 'جاري التحليل العميق...' : 'Deep Analysis in Progress...'}
                </span>
              </div>
              {currentSnippet && (
                <p className="text-sm text-slate-400 italic leading-relaxed border-l-2 border-blue-500/30 pl-4 py-1">
                  "{currentSnippet}"
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white/5 border-t border-white/10">
        <div className="relative group">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isCooldown ? (lang === 'ar' ? 'يرجى الانتظار...' : 'Please wait...') : t.placeholder}
            disabled={isLoading || isCooldown}
            className="w-full bg-slate-950/50 text-slate-200 rounded-2xl px-6 py-4 pr-16 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none h-[60px] custom-scrollbar disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isCooldown}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all ${
              !input.trim() || isLoading || isCooldown
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between px-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
            {lang === 'ar' ? 'مدعوم بذكاء اصطناعي فائق' : 'Powered by Advanced AI'}
          </p>
          <p className="text-[10px] text-slate-500">
            Shift + Enter {lang === 'ar' ? 'لسطر جديد' : 'for new line'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
