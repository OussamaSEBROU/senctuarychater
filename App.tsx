import React, { useState, useRef, useEffect } from 'react';
import { Axiom, PDFData, Language } from './types';
import { extractAxioms } from './services/geminiService';
import AxiomCard from './components/AxiomCard';
import ChatInterface from './components/ChatInterface';
import Sidebar from './components/Sidebar';
import ManuscriptViewer from './components/ManuscriptViewer';
import { translations } from './translations';

const quotes = {
  en: [
    "The present is theirs; the future, for which I really worked, is mine. — Nikola Tesla",
    "Our virtues and our failings are inseparable, like force and matter. — Nikola Tesla",
    "Imagination is more important than knowledge. — Albert Einstein",
    "The only real valuable thing is intuition. — Albert Einstein",
    "Design is not just what it looks like and feels like. Design is how it works. — Steve Jobs",
    "The people who are crazy enough to think they can change the world are the ones who do. — Steve Jobs",
    "Stay hungry, stay foolish. — Steve Jobs",
    "Simplicity is the ultimate sophistication. — Leonardo da Vinci",
    "Learning never exhausts the mind. — Leonardo da Vinci",
    "The unexamined life is not worth living. — Socrates"
  ],
  ar: [
    "إن الحضارة لا تباع ولا تشترى، وإنما هي نتاج جهد فكري وعملي دؤوب. — مالك بن نبي",
    "الأفكار هي التي تصنع التاريخ، والعمل هو الذي يجسدها. — مالك بن نبي",
    "التكنولوجيا بلا روح هي أداة للتدمير، أما التكنولوجيا الموجهة بالقيم فهي وسيلة للتحرر. — مالك بن نبي",
    "الحرية ليست مجرد غياب القيود، بل هي القدرة على اختيار الخير. — علي عزت بيجوفيتش",
    "الصلاة لا تغير العالم، ولكنها تغير الإنسان الذي سيغير العالم. — علي عزت بيجوفيتش",
    "العلم بلا أخلاق هو دمار للبشرية. — البشير الإبراهيمي",
    "اللغة هي وعاء الفكر، فإذا فسد الوعاء فسد ما فيه. — البشير الإبراهيمي",
    "الوهم نصف الداء، والاطمئنان نصف الدواء، والصبر أول خطوات الشفاء. — ابن سينا",
    "العقل البشري هو أعظم هبة من الله، وبه ندرك الحقائق. — ابن سينا",
    "العمل هو تجسيد للمنطق، والمنطق هو روح العمل. — طه عبد الرحمن"
  ]
};

const statusMessages = {
  en: ["Analyzing manuscript...", "Deep thinking...", "Extracting wisdom...", "Synthesizing connections...", "Finalizing sync..."],
  ar: ["يتم تحليل المخطوط...", "تفكير معمق...", "استخراج الحكمة...", "توليف الروابط...", "إتمام المزامنة..."]
};

const App: React.FC = () => {
  const [pdf, setPdf] = useState<PDFData | null>(null);
  const [axioms, setAxioms] = useState<Axiom[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [flowStep, setFlowStep] = useState<'axioms' | 'chat'>('axioms');
  const [showViewer, setShowViewer] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSynthesizing) {
      setCurrentQuoteIndex(Math.floor(Math.random() * quotes[lang].length));
      interval = setInterval(() => {
        setCurrentQuoteIndex(Math.floor(Math.random() * quotes[lang].length));
        setCurrentStatusIndex(prev => (prev + 1) % statusMessages[lang].length);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isSynthesizing, lang]);

  const handleSynthesis = async (base64: string, currentLang: Language) => {
    setIsSynthesizing(true);
    setError(null);
    setAxioms([]);
    setFlowStep('axioms');
    try {
      const extracted = await extractAxioms(base64, currentLang);
      if (extracted && extracted.length > 0) setAxioms(extracted);
      else throw new Error("EMPTY");
    } catch (err) {
      setError(currentLang === 'ar' ? "فشل التحليل." : "Synthesis failed.");
      setPdf(null);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.substring(result.indexOf(',') + 1);
      setPdf({ base64, name: file.name });
      handleSynthesis(base64, lang);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`fixed inset-0 flex flex-col bg-[#020202] text-white overflow-hidden ${lang === 'ar' ? 'rtl font-academic' : 'ltr font-sans'}`}>
      <style>{`
        @keyframes cinematic {
          0% { opacity: 0; transform: perspective(1000px) rotateX(20deg) translateY(30px) scale(0.9); filter: blur(15px); }
          20% { opacity: 1; transform: perspective(1000px) rotateX(0deg) translateY(0) scale(1); filter: blur(0); }
          80% { opacity: 1; transform: perspective(1000px) rotateX(0deg) translateY(0) scale(1); filter: blur(0); }
          100% { opacity: 0; transform: perspective(1000px) rotateX(-20deg) translateY(-30px) scale(1.1); filter: blur(15px); }
        }
        .cinematic-quote {
          animation: cinematic 4s ease-in-out infinite;
          background: linear-gradient(90deg, #fff, #a34a28, #fff);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 30px rgba(163,74,40,0.3);
          font-weight: 500;
          letter-spacing: 0.02em;
        }
      `}</style>

      {isSynthesizing && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-6 text-center">
          <div className="mb-8 animate-pulse text-orange-500/40 text-[10px] font-black tracking-[0.5em] uppercase">
            {statusMessages[lang][currentStatusIndex]}
          </div>
          <div className="h-48 flex items-center justify-center">
            <p key={currentQuoteIndex} className="cinematic-quote text-2xl md:text-4xl italic max-w-4xl leading-relaxed px-8">
              {quotes[lang][currentQuoteIndex]}
            </p>
          </div>
        </div>
      )}

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} lang={lang} setLang={setLang} onNewChat={() => setPdf(null)} />

      <header className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-3xl z-50">
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <h1 className="text-[10px] font-black tracking-[0.4em] text-white/40 uppercase">{t.title}</h1>
        {pdf && <button onClick={() => setShowViewer(!showViewer)} className="px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase">{showViewer ? 'Close' : 'View'}</button>}
      </header>

      <main className="flex-1 relative overflow-hidden">
        {!pdf ? (
          <div className="h-full flex flex-col items-center justify-center p-6">
            <div className="max-w-2xl w-full text-center space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-glow-white">{t.sanctuary}</h2>
                <p className="text-white/40 text-sm md:text-base max-w-md mx-auto leading-relaxed">{t.introText}</p>
              </div>
              <label className="group relative block cursor-pointer">
                <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                <div className="p-12 rounded-[2.5rem] border-2 border-dashed border-white/10 group-hover:border-orange-500/50 transition-all bg-white/[0.02] group-hover:bg-orange-500/[0.02]">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-white/20 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t.upload}</h3>
                  <p className="text-xs text-white/30 uppercase tracking-widest">{t.uploadDesc}</p>
                </div>
              </label>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {flowStep === 'axioms' ? (
              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto space-y-12">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black uppercase tracking-widest text-orange-500">{t.axiomsTitle}</h2>
                    <button onClick={() => setFlowStep('chat')} className="px-6 py-3 bg-white text-black rounded-full font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform">{t.deepChatBtn}</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {axioms.map((ax, i) => <AxiomCard key={i} axiom={ax} index={i} />)}
                  </div>
                </div>
              </div>
            ) : (
              <ChatInterface pdf={pdf} lang={lang} />
            )}
          </div>
        )}
        {showViewer && pdf && <ManuscriptViewer pdf={pdf} lang={lang} onClose={() => setShowViewer(false)} />}
      </main>
    </div>
  );
};

export default App;
