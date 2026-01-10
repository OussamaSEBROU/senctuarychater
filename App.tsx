
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
    "The only true wisdom is in knowing you know nothing. — Socrates",
    "Reading is to the mind what exercise is to the body. — Joseph Addison",
    "Knowledge is power. — Francis Bacon",
    "The mind is not a vessel to be filled, but a fire to be kindled. — Plutarch",
    "A room without books is like a body without a soul. — Cicero",
    "I think, therefore I am. — René Descartes",
    "The unexamined life is not worth living. — Socrates",
    "Happiness depends upon ourselves. — Aristotle",
    "Man is born free, and everywhere he is in chains. — Jean-Jacques Rousseau",
    "He who has a why to live can bear almost any how. — Friedrich Nietzsche",
    "The only thing I know is that I know nothing. — Socrates",
    "To be is to be perceived. — George Berkeley",
    "God is dead. — Friedrich Nietzsche",
    "Hell is other people. — Jean-Paul Sartre",
    "One cannot step twice in the same river. — Heraclitus",
    "The life of man is solitary, poor, nasty, brutish, and short. — Thomas Hobbes",
    "Whereof one cannot speak, thereof one must be silent. — Ludwig Wittgenstein",
    "Entities should not be multiplied unnecessarily. — William of Ockham",
    "The brave man is he who overcomes not only his enemies but his pleasures. — Democritus",
    "Freedom is what you do with what's been done to you. — Jean-Paul Sartre",
    "The world is the best of all possible worlds. — Gottfried Wilhelm Leibniz",
    "I can control my passions and emotions if I can understand their nature. — Baruch Spinoza",
    "There is only one good, knowledge, and one evil, ignorance. — Socrates",
    "We are what we repeatedly do. Excellence, then, is not an act, but a habit. — Aristotle",
    "The foundation of every state is the education of its youth. — Diogenes",
    "The journey of a thousand miles begins with one step. — Lao Tzu",
    "Life is really simple, but we insist on making it complicated. — Confucius",
    "The only way to do great work is to love what you do. — Steve Jobs",
    "Innovation distinguishes between a leader and a follower. — Steve Jobs",
    "Stay hungry, stay foolish. — Steve Jobs",
    "The greatest glory in living lies not in never falling, but in rising every time we fall. — Nelson Mandela",
    "The way to get started is to quit talking and begin doing. — Walt Disney",
    "Your time is limited, so don't waste it living someone else's life. — Steve Jobs",
    "If life were predictable it would cease to be life, and be without flavor. — Eleanor Roosevelt",
    "If you look at what you have in life, you'll always have more. — Oprah Winfrey",
    "If you set your goals ridiculously high and it's a failure, you will fail above everyone else's success. — James Cameron",
    "Life is what happens when you're making other plans. — John Lennon",
    "Spread love everywhere you go. Let no one ever come to you without leaving happier. — Mother Teresa",
    "When you reach the end of your rope, tie a knot in it and hang on. — Franklin D. Roosevelt",
    "Always remember that you are absolutely unique. Just like everyone else. — Margaret Mead",
    "Don't judge each day by the harvest you reap but by the seeds that you plant. — Robert Louis Stevenson",
    "The future belongs to those who believe in the beauty of their dreams. — Eleanor Roosevelt",
    "Tell me and I forget. Teach me and I remember. Involve me and I learn. — Benjamin Franklin",
    "The best and most beautiful things in the world cannot be seen or even touched — they must be felt with the heart. — Helen Keller",
    "It is during our darkest moments that we must focus to see the light. — Aristotle"
  ],
  ar: [
    "العلم في الصغر كالنقش على الحجر.",
    "خير جليس في الزمان كتاب. — المتنبي",
    "القراءة تمد العقل فقط بمواد المعرفة، أما التفكير فهو الذي يجعل ما نقرأه ملكاً لنا. — جون لوك",
    "الكتب هي الآثار الأكثر بقاءً للزمن. — صمويل سميث",
    "من لم يذق مر التعلم ساعة، تجرع ذل الجهل طول حياته. — الشافعي",
    "العدل أساس الملك. — ابن خلدون",
    "الوقت كالسيف إن لم تقطعه قطعك.",
    "اطلبوا العلم من المهد إلى اللحد.",
    "العقل السليم في الجسم السليم.",
    "ليس اليتيم من انتهى أبواه، إن اليتيم يتيم العلم والأدب. — أحمد شوقي",
    "ما استحق أن يولد من عاش لنفسه فقط.",
    "الجمال ليس بأثواب تزيننا، إن الجمال جمال العلم والأدب. — علي بن أبي طالب",
    "رأس الحكمة مخافة الله.",
    "من جد وجد ومن زرع حصد.",
    "لا تؤجل عمل اليوم إلى الغد.",
    "العلم نور والجهل ظلام.",
    "من علمني حرفاً كنت له عبداً.",
    "الكلمة الطيبة صدقة.",
    "القناعة كنز لا يفنى.",
    "الصبر مفتاح الفرج.",
    "اتق شر من أحسنت إليه.",
    "في التأني السلامة وفي العجلة الندامة.",
    "لسانك حصانك إن صنته صانك وإن هنته هانك.",
    "من حفر حفرة لأخيه وقع فيها.",
    "الطيور على أشكالها تقع.",
    "رب أخ لم تلده أمك.",
    "مصائب قوم عند قوم فوائد.",
    "إذا تم العقل نقص الكلام.",
    "العلم بلا عمل كالشجر بلا ثمر.",
    "من كثر كلامه كثر سقطه.",
    "أعز مكان في الدنا سرج سابح، وخير جليس في الزمان كتاب. — المتنبي",
    "إنما الأمم الأخلاق ما بقيت، فإن هم ذهبت أخلاقهم ذهبوا. — أحمد شوقي",
    "على قدر أهل العزم تأتي العزائم. — المتنبي",
    "ما كل ما يتمنى المرء يدركه، تجري الرياح بما لا تشتهي السفن. — المتنبي",
    "إذا رأيت نيوب الليث بارزة، فلا تظنن أن الليث يبتسم. — المتنبي",
    "الخيل والليل والبيداء تعرفني، والسيف والرمح والقرطاس والقلم. — المتنبي",
    "أنا الذي نظر الأعمى إلى أدبي، وأسمعت كلماتي من به صمم. — المتنبي",
    "لا تحسبن المجد تمراً أنت آكله، لن تبلغ المجد حتى تلعق الصبرا.",
    "وإذا كانت النفوس كباراً، تعبت في مرادها الأجسام. — المتنبي",
    "ذو العقل يشقى في النعيم بعقله، وأخو الجهالة في الشقاوة ينعم. — المتنبي",
    "ولم أر في عيوب الناس شيئاً، كنقص القادرين على التمام. — المتنبي",
    "بقدر الكد تكتسب المعالي، ومن طلب العلا سهر الليالي. — الشافعي",
    "أحب الصالحين ولست منهم، لعلي أن أنال بهم شفاعة. — الشافعي",
    "يخاطبني السفيه بكل قبح، فأكره أن أكون له مجيباً. — الشافعي",
    "إذا نطق السفيه فلا تجبه، فخير من إجابته السكوت. — الشافعي"
  ]
};

const App: React.FC = () => {
  const [pdf, setPdf] = useState<PDFData | null>(null);
  const [axioms, setAxioms] = useState<Axiom[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  
  const [flowStep, setFlowStep] = useState<'axioms' | 'chat'>('axioms');
  const [showViewer, setShowViewer] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSynthesizing) {
      interval = setInterval(() => {
        setCurrentQuoteIndex((prev) => (prev + 1) % quotes[lang].length);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isSynthesizing, lang]);

  useEffect(() => {
    if (axioms.length > 0 && carouselRef.current) {
      carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [axioms]);

  const handleSynthesis = async (base64: string, currentLang: Language) => {
    setIsSynthesizing(true);
    setError(null);
    setAxioms([]);
    setFlowStep('axioms');

    try {
      const extracted = await extractAxioms(base64, currentLang);
      if (extracted && extracted.length > 0) {
        setAxioms(extracted);
      } else {
        throw new Error("EMPTY_RESULT");
      }
    } catch (err: any) {
      console.error("Synthesis error:", err);
      let errorMsg = currentLang === 'ar' ? "فشل التحليل العصبي للمخطوط." : "Synthesis failed.";
      setError(errorMsg);
      setPdf(null);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError(lang === 'ar' ? "يرجى رفع ملف PDF فقط." : "Please upload a PDF file only.");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const base64 = result.substring(result.indexOf(',') + 1);
      setPdf({ base64, name: file.name });
      handleSynthesis(base64, lang);
    };
    reader.readAsDataURL(file);
  };

  const handleNewChat = () => {
    setPdf(null);
    setAxioms([]);
    setFlowStep('axioms');
    setShowViewer(false);
    setError(null);
  };

  return (
    <div className={`fixed inset-0 flex flex-col bg-[#020202] text-white overflow-hidden ${lang === 'ar' ? 'rtl font-academic' : 'ltr font-sans'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <style>{`
        @keyframes shiningText {
          0% { opacity: 0; transform: translateY(10px); filter: blur(5px); }
          20% { opacity: 1; transform: translateY(0); filter: blur(0); }
          80% { opacity: 1; transform: translateY(0); filter: blur(0); }
          100% { opacity: 0; transform: translateY(-10px); filter: blur(5px); }
        }
        .shining-quote {
          animation: shiningText 4s ease-in-out infinite;
          background: linear-gradient(90deg, #fff, #a34a28, #fff);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shiningText 4s ease-in-out infinite, shine 3s linear infinite;
        }
        @keyframes shine {
          to { background-position: 200% center; }
        }
      `}</style>

      {isSynthesizing && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-1000">
          <div className="spinner-arc mb-16 w-20 h-20 border-t-orange-600"></div>
          <h2 className="text-white text-xl font-black tracking-[0.5em] mb-12 uppercase opacity-40">{t.synthesis}</h2>
          <div className="h-24 flex items-center justify-center">
            <p key={currentQuoteIndex} className="shining-quote text-lg md:text-2xl font-medium italic max-w-2xl leading-relaxed px-4">
              {quotes[lang][currentQuoteIndex]}
            </p>
          </div>
        </div>
      )}

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        lang={lang} 
        setLang={setLang}
        onNewChat={handleNewChat}
      />

      <header className="h-14 md:h-16 px-4 md:px-8 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-3xl z-[60] shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="text-[10px] font-black tracking-[0.4em] text-white/40 uppercase hidden sm:block">{translations.en.title}</h1>
        </div>
        
        {pdf && (
          <button 
            onClick={() => setShowViewer(!showViewer)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border text-[10px] font-black tracking-widest uppercase ${showViewer ? 'bg-white border-white text-black' : 'bg-white/5 border-white/5 text-white/40 hover:text-white'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <span className="hidden md:inline">{showViewer ? (lang === 'ar' ? 'إغلاق العارض' : 'Close Viewer') : (lang === 'ar' ? 'فتح المخطوط' : 'Open Manuscript')}</span>
          </button>
        )}
      </header>

      <main className="flex-1 overflow-hidden relative z-10 flex flex-col">
        {!pdf ? (
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-center touch-auto" dir="ltr">
            <h2 className="text-6xl md:text-9xl font-black mb-4 select-none text-white tracking-tighter uppercase font-sans">
              {translations.en.sanctuary}
            </h2>
            <p className="mb-12 text-sm md:text-2xl font-black tracking-tight text-glow-orange max-w-2xl leading-tight font-sans">
              {lang === 'ar' ? translations.ar.introText : translations.en.introText}
            </p>
            <label className="w-full max-w-sm group relative block aspect-[1.3/1] border border-dashed border-white/10 rounded-[3rem] hover:border-[#a34a28]/40 transition-all cursor-pointer bg-white/[0.01]">
              <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6">
                 <div className="w-16 h-16 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#a34a28]/10 transition-all duration-500 shadow-[0_0_20px_rgba(163,74,40,0)] group-hover:shadow-[0_0_20px_rgba(163,74,40,0.2)]">
                    <svg className="w-8 h-8 text-white/10 group-hover:text-[#a34a28] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                 </div>
                 <span className="text-[10px] md:text-xs font-black tracking-[0.4em] text-white/20 uppercase group-hover:text-white/60">
                   {translations.en.upload}
                 </span>
              </div>
            </label>
            {error && (
              <div className="mt-8 max-w-md mx-auto">
                <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.3em] bg-red-500/10 px-6 py-2 rounded-full border border-red-500/20 shadow-lg">
                  {error}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
            <div className={`flex-1 flex flex-col transition-all duration-700 ease-in-out overflow-hidden ${showViewer ? 'lg:w-1/2 opacity-100' : 'lg:w-full'}`}>
              {flowStep === 'axioms' && (
                <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-4 touch-auto">
                   <h3 className="text-2xl md:text-5xl font-black mb-8 uppercase text-center text-white/90 tracking-widest">{t.axiomsTitle}</h3>
                   <div ref={carouselRef} className="w-full flex gap-6 px-4 md:px-[5%] overflow-x-auto snap-x scrollbar-none pb-10 touch-pan-x">
                      {axioms.length > 0 ? axioms.map((ax, i) => (
                        <div key={i} className="min-w-[280px] md:min-w-[400px] snap-center">
                          <AxiomCard axiom={ax} index={i} />
                        </div>
                      )) : (
                        <div className="w-full flex justify-center py-20 opacity-20">
                           <div className="w-10 h-10 border-2 border-white/10 border-t-white/40 rounded-full animate-spin"></div>
                        </div>
                      )}
                   </div>
                   <button 
                    onClick={() => { setFlowStep('chat'); if(window.innerWidth > 1024) setShowViewer(true); }} 
                    className="px-12 py-5 bg-[#a34a28] rounded-full font-black text-xs tracking-[0.4em] uppercase hover:bg-orange-800 transition-all shadow-[0_0_30px_rgba(163,74,40,0.3)] mt-4 active:scale-95"
                   >
                     {t.deepChatBtn}
                   </button>
                </div>
              )}
              {flowStep === 'chat' && (
                <div className="flex-1 bg-[#080808] overflow-hidden">
                  <ChatInterface pdf={pdf} lang={lang} />
                </div>
              )}
            </div>

            {showViewer && (
              <div className={`fixed inset-0 lg:relative lg:inset-auto lg:w-1/2 bg-black z-[70] lg:z-10 animate-in slide-in-from-right duration-500 border-l border-white/10 flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.8)] overflow-hidden`}>
                <div className="flex lg:hidden items-center justify-between p-4 bg-[#1a1a1a] border-b border-white/10">
                   <h4 className="text-[10px] font-black tracking-widest uppercase text-white/40">{t.viewer}</h4>
                   <button onClick={() => setShowViewer(false)} className="p-2 bg-white/5 rounded-full text-white/60">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5" strokeLinecap="round"/></svg>
                   </button>
                </div>
                <ManuscriptViewer pdf={pdf} lang={lang} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
