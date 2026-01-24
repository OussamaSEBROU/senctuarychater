
import React, { useState, useRef, useEffect } from 'react';
import { Axiom, PDFData, Language } from './types';
import { extractAxioms } from './services/geminiService';
import AxiomCard from './components/AxiomCard';
import ChatInterface from './components/ChatInterface';
import Sidebar from './components/Sidebar';
import ManuscriptViewer from './components/ManuscriptViewer';
import { translations } from './translations';

// مصفوفة المقولات المختارة بعناية من المصادر المحددة
const quotes = {
  en: [
    "The present is theirs; the future, for which I really worked, is mine. — Nikola Tesla",
    "I do not think you can name many great inventions that have been made by married men. — Nikola Tesla",
    "Our virtues and our failings are inseparable, like force and matter. — Nikola Tesla",
    "The scientists of today think deeply instead of clearly. — Nikola Tesla",
    "The gift of mental power comes from God, Divine Being. — Nikola Tesla",
    "Imagination is more important than knowledge. — Albert Einstein",
    "The only real valuable thing is intuition. — Albert Einstein",
    "Science without religion is lame, religion without science is blind. — Albert Einstein",
    "A person who never made a mistake never tried anything new. — Albert Einstein",
    "The important thing is not to stop questioning. — Albert Einstein",
    "Technology is nothing. What's important is that you have a faith in people. — Steve Jobs",
    "Design is not just what it looks like and feels like. Design is how it works. — Steve Jobs",
    "The people who are crazy enough to think they can change the world are the ones who do. — Steve Jobs",
    "Innovation distinguishes between a leader and a follower. — Steve Jobs",
    "Stay hungry, stay foolish. — Steve Jobs",
    "The best way to predict the future is to invent it. — Alan Kay",
    "The computer is the most remarkable tool that we've ever come up with. — Steve Jobs",
    "Simplicity is the ultimate sophistication. — Leonardo da Vinci",
    "Nature is the source of all true knowledge. — Leonardo da Vinci",
    "Learning never exhausts the mind. — Leonardo da Vinci",
    "The unexamined life is not worth living. — Socrates",
    "Turn your wounds into wisdom. — Oprah Winfrey",
    "You must be the change you wish to see in the world. — Mahatma Gandhi",
    "The only way to do great work is to love what you do. — Steve Jobs",
    "Innovation distinguishes between a leader and a follower. — Steve Jobs"
  ],
  ar: [
    "إن الحضارة لا تباع ولا تشترى، وإنما هي نتاج جهد فكري وعملي دؤوب. — مالك بن نبي (شروط النهضة)",
    "الأفكار هي التي تصنع التاريخ، والعمل هو الذي يجسدها. — مالك بن نبي (وجهة العالم الإسلامي)",
    "التكنولوجيا بلا روح هي أداة للتدمير، أما التكنولوجيا الموجهة بالقيم فهي وسيلة للتحرر. — مالك بن نبي",
    "إن مشكلة كل شعب هي في جوهرها مشكلة حضارته. — مالك بن نبي",
    "لا يمكن لعالم أن ينهض إذا كان يستهلك أفكار غيره دون تمحيص. — مالك بن نبي",
    "الحرية ليست مجرد غياب القيود، بل هي القدرة على اختيار الخير. — علي عزت بيجوفيتش (الإسلام بين الشرق والغرب)",
    "الصلاة لا تغير العالم، ولكنها تغير الإنسان الذي سيغير العالم. — علي عزت بيجوفيتش",
    "إن المجتمع الذي لا يقرأ هو مجتمع لا يفكر، والمجتمع الذي لا يفكر لا يمكنه أن يبني حضارة. — علي عزت بيجوفيتش",
    "التكنولوجيا يجب أن تخدم الإنسان، لا أن تستعبده. — علي عزت بيجوفيتش",
    "الإيمان هو الذي يعطي للحياة معنى، والعمل هو الذي يعطي للإيمان قيمة. — علي عزت بيجوفيتش",
    "العلم بلا أخلاق هو دمار للبشرية. — البشير الإبراهيمي",
    "إن الأمة التي تنسى تاريخها لا يمكنها أن نبني مستقبلها. — البشير الإبراهيمي",
    "اللغة هي وعاء الفكر، فإذا فسد الوعاء فسد ما فيه. — البشير الإبراهيمي",
    "العمل هو المقياس الحقيقي لقيمة الإنسان. — البشير الإبراهيمي",
    "الاستعمار الفكري أخطر من الاستعمار العسكري. — البشير الإبراهيمي",
    "الوهم نصف الداء، والاطمئنان نصف الدواء، والصبر أول خطوات الشفاء. — ابن سينا (القانون في الطب)",
    "العقل البشري هو أعظم هبة من الله، وبه ندرك الحقائق. — ابن سينا",
    "العلم هو معرفة الأشياء بحقائقها. — ابن سينا",
    "المعرفة هي القوة التي تمكننا من فهم الكون. — ابن سينا",
    "الطب هو حفظ الصحة وشفاء المرض. — ابن سينا",
    "مقاصد الشريعة هي حفظ مصالح العباد في الدارين. — ابن عاشور (مقاصد الشريعة الإسلامية)",
    "الاجتهاد هو روح الشريعة، وبه تبقى صالحة لكل زمان ومكان. — ابن عاشور",
    "التعليم هو الأساس الذي تبنى عليه الأمم. — ابن عاشور",
    "الحرية هي حق أصيل لكل إنسان، ولا يجوز سلبها إلا بحق. — ابن عاشور",
    "العدل هو ميزان الله في الأرض. — ابن عاشور",
    "العمل هو تجسيد للمنطق، والمنطق هو روح العمل. — طه عبد الرحمن (روح الحداثة)",
    "لا حداثة بلا أخلاق، ولا أخلاق بلا إيمان. — طه عبد الرحمن",
    "التكنولوجيا هي تجلٍ للعقل، ولكن يجب أن تخضع للقيم. — طه عبد الرحمن",
    "الإنسان هو كائن أخلاقي بامتياز، وعمله يجب أن يعكس ذلك. — طه عبد الرحمن",
    "الحوار هو السبيل الوحيد للتفاهم بين الحضارات. — طه عبد الرحمن",
    "إن الإنسان في غاية الحاجة لمركزية 'منطق العمل' كما هو في حاجة لمركزية 'منطق الفكرة'. — طه عبد الرحمن",
    "التقنية ليست مجرد أدوات، بل هي نمط من الوجود يتطلب وعياً أخلاقياً. — طه عبد الرحمن"
  ]
};

// نصوص الحالة التقنية
const statusMessages = {
  en: [
    "Analyzing manuscript structure...",
    "Deep thinking in progress...",
    "Extracting axiomatic wisdom...",
    "Synthesizing neural connections...",
    "Mapping intellectual framework...",
    "Decoding author's logic...",
    "Finalizing neural sync..."
  ],
  ar: [
    "يتم تحليل بنية المخطوط...",
    "تفكير معمق في الأفكار المركزية...",
    "استخراج الحكمة الأكسيومية...",
    "توليف الروابط العصبية...",
    "رسم الإطار الفكري...",
    "فك شفرة منطق المؤلف...",
    "إتمام المزامنة العصبية..."
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
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  
  const [flowStep, setFlowStep] = useState<'axioms' | 'chat'>('axioms');
  const [showViewer, setShowViewer] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSynthesizing) {
      setCurrentQuoteIndex(Math.floor(Math.random() * quotes[lang].length));
      setCurrentStatusIndex(0);
      
      interval = setInterval(() => {
        setCurrentQuoteIndex(Math.floor(Math.random() * quotes[lang].length));
        setCurrentStatusIndex(prev => (prev + 1) % statusMessages[lang].length);
      }, 5000);
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
      
      // تحسين الذاكرة: تعيين الـ PDF أولاً ثم البدء في التحليل مباشرة
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
          0% { opacity: 0; transform: translateY(15px); filter: blur(8px); }
          15% { opacity: 1; transform: translateY(0); filter: blur(0); }
          85% { opacity: 1; transform: translateY(0); filter: blur(0); }
          100% { opacity: 0; transform: translateY(-15px); filter: blur(8px); }
        }
        .shining-quote {
          animation: shiningText 5s ease-in-out infinite;
          background: linear-gradient(90deg, #fff, #a34a28, #fff);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shiningText 5s ease-in-out infinite, shine 4s linear infinite;
        }
        @keyframes shine {
          to { background-position: 200% center; }
        }
      `}</style>

      {isSynthesizing && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-1000">
          <div className="spinner-arc mb-16 w-24 h-24 border-t-orange-600"></div>
          
          {/* نص الحالة التقنية */}
          <div className="mb-4 h-6">
            <p className="text-orange-500/60 text-[10px] font-black tracking-[0.4em] uppercase animate-pulse">
              {statusMessages[lang][currentStatusIndex]}
            </p>
          </div>

          <h2 className="text-white text-xl font-black tracking-[0.6em] mb-12 uppercase opacity-30">{t.synthesis}</h2>
          
          <div className="h-32 flex items-center justify-center">
            <p key={currentQuoteIndex} className="shining-quote text-xl md:text-3xl font-medium italic max-w-3xl leading-relaxed px-6">
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
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            {t.viewer}
          </button>
        )}
      </header>

      <main className="flex-1 relative flex flex-col min-h-0">
        {!pdf ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-12 animate-in zoom-in duration-1000">
              <h2 className="text-4xl md:text-7xl font-black tracking-[0.2em] mb-6 uppercase text-white">{translations.en.sanctuary}</h2>
              <p className="text-[10px] md:text-xs font-black tracking-[0.4em] text-orange-500/60 uppercase max-w-md mx-auto leading-loose">{t.introText}</p>
            </div>

            <label className="group relative cursor-pointer">
              <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
              <div className="w-64 h-64 md:w-80 md:h-80 rounded-3xl border border-white/5 bg-white/[0.02] flex flex-col items-center justify-center gap-6 transition-all group-hover:bg-white/[0.05] group-hover:border-white/10 group-active:scale-95">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
                  <svg className="w-6 h-6 text-white/20 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black tracking-[0.3em] uppercase text-white/40 mb-2">{t.upload}</p>
                  <p className="text-[8px] font-black tracking-[0.2em] uppercase text-white/10">{t.uploadDesc}</p>
                </div>
              </div>
            </label>

            {error && (
              <div className="mt-12 animate-in slide-in-from-bottom duration-500">
                <div className="px-6 py-3 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black tracking-widest uppercase">
                  {error}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 relative">
            {showViewer && (
              <div className="absolute inset-0 z-50 bg-black animate-in fade-in duration-500">
                <ManuscriptViewer pdf={pdf} lang={lang} />
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-0">
              <div className="h-14 md:h-16 px-4 md:px-8 flex items-center justify-between border-b border-white/5 shrink-0">
                <div className="flex gap-4 md:gap-8">
                  <button 
                    onClick={() => setFlowStep('axioms')}
                    className={`text-[10px] font-black tracking-[0.3em] uppercase transition-all ${flowStep === 'axioms' ? 'text-orange-500' : 'text-white/20 hover:text-white'}`}
                  >
                    {t.axiomsTitle}
                  </button>
                  <button 
                    onClick={() => setFlowStep('chat')}
                    className={`text-[10px] font-black tracking-[0.3em] uppercase transition-all ${flowStep === 'chat' ? 'text-orange-500' : 'text-white/20 hover:text-white'}`}
                  >
                    {t.dialogue}
                  </button>
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                  <span className="text-[8px] font-black tracking-widest text-white/20 uppercase">{pdf.name}</span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative">
                {flowStep === 'axioms' ? (
                  <div ref={carouselRef} className="h-full overflow-x-auto overflow-y-hidden flex items-center px-4 md:px-12 gap-4 md:gap-8 snap-x snap-mandatory no-scrollbar">
                    {axioms.map((axiom, i) => (
                      <div key={i} className="snap-center shrink-0 w-[85vw] md:w-[400px]">
                        <AxiomCard axiom={axiom} index={i} lang={lang} />
                      </div>
                    ))}
                    <div className="snap-center shrink-0 w-[85vw] md:w-[400px] h-[450px] md:h-[550px] flex flex-col items-center justify-center p-8 md:p-12 rounded-[2.5rem] border border-white/5 bg-white/[0.02] text-center">
                      <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-8">
                        <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      </div>
                      <h3 className="text-xl font-black text-white mb-4 uppercase tracking-widest">{t.dialogue}</h3>
                      <p className="text-[10px] text-white/40 leading-relaxed mb-10 uppercase tracking-widest">{t.dialogueDesc}</p>
                      <button 
                        onClick={() => setFlowStep('chat')}
                        className="w-full py-4 rounded-2xl bg-white text-black text-[10px] font-black tracking-[0.3em] uppercase hover:bg-orange-500 hover:text-white transition-all"
                      >
                        {t.deepChatBtn}
                      </button>
                    </div>
                  </div>
                ) : (
                  <ChatInterface pdf={pdf} lang={lang} />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="h-10 md:h-12 px-4 md:px-8 flex items-center justify-center border-t border-white/5 bg-black/40 backdrop-blur-3xl shrink-0">
        <p className="text-[8px] font-black tracking-[0.3em] text-white/10 uppercase text-center">{t.covenant}</p>
      </footer>
    </div>
  );
};

export default App;
