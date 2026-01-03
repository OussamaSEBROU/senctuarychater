
import React, { useState, useEffect, useRef } from 'react';
import { Axiom, PDFData, Language } from './types';
import { extractAxioms } from './services/geminiService';
import AxiomCard from './components/AxiomCard';
import ChatInterface from './components/ChatInterface';
import Sidebar from './components/Sidebar';
import ManuscriptViewer from './components/ManuscriptViewer';
import { translations } from './translations';

const App: React.FC = () => {
  const [pdf, setPdf] = useState<PDFData | null>(null);
  const [axioms, setAxioms] = useState<Axiom[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [flowStep, setFlowStep] = useState<'axioms' | 'chat'>('axioms');
  const [showViewer, setShowViewer] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];

  const handleSynthesis = async (base64: string) => {
    setIsSynthesizing(true);
    setError(null);
    setFlowStep('axioms');
    try {
      const extracted = await extractAxioms(base64, lang);
      setAxioms(extracted);
    } catch (err) {
      console.error(err);
      setError(lang === 'ar' ? "فشل التركيب العصبي." : "Neural synthesis failed.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError(t.uploadDesc);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const base64 = result.substring(result.indexOf(',') + 1);
      setPdf({ base64, name: file.name });
      handleSynthesis(base64);
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

  if (isSynthesizing) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-6 text-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="spinner-arc mb-12 box-glow"></div>
        <h2 className="text-white text-lg font-black tracking-[0.4em] mb-10 text-glow uppercase">
          {t.synthesis}
        </h2>
        <div className="max-w-md w-full glass rounded-3xl p-8 border border-white/10 shadow-2xl">
          <p className="text-indigo-200/80 italic font-serif leading-relaxed text-sm md:text-base">
            {t.covenant}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 flex flex-col bg-[#020202] text-white ${lang === 'ar' ? 'rtl' : 'ltr'} overflow-hidden transition-colors duration-500`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-900/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-violet-900/10 blur-[150px] rounded-full"></div>
      </div>

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        lang={lang} 
        setLang={setLang}
        activePanel={flowStep === 'axioms' ? 'axioms' : 'chat'}
        setActivePanel={() => {}}
        onNewChat={handleNewChat}
      />

      <header className="h-14 md:h-20 px-4 md:px-10 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-3xl z-[60] shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 md:p-3 hover:bg-white/5 rounded-xl md:rounded-2xl transition-all border border-transparent hover:border-white/10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="hidden md:block text-[10px] font-black tracking-[0.6em] text-glow uppercase ml-2 text-white/80">
            {t.title}
          </h1>
        </div>

        <div className="md:absolute md:left-1/2 md:-translate-x-1/2 flex items-center gap-2 md:gap-3">
           <div className={`w-1.5 h-1.5 rounded-full ${pdf ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.7)]' : 'bg-white/10'}`}></div>
           <h2 className="text-[9px] md:text-[10px] font-black tracking-[0.2em] md:tracking-[0.3em] text-white/60 uppercase truncate max-w-[120px] md:max-w-none">
             {pdf ? pdf.name : t.sanctuary}
           </h2>
        </div>

        <div className="flex items-center gap-3">
           {pdf && (
             <button 
               onClick={() => setShowViewer(!showViewer)}
               className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl transition-all flex items-center gap-2 border ${showViewer ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/5 text-white/40 hover:text-white'}`}
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
               </svg>
               <span className="hidden md:inline text-[9px] font-black tracking-widest uppercase">{t.viewer}</span>
             </button>
           )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative z-10">
        {!pdf ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-1000">
            <h2 className="text-5xl md:text-9xl font-black sanctuary-3d mb-4 leading-none select-none">
              {t.sanctuary}
            </h2>
            <p className="mb-12 text-[8px] md:text-xs font-black tracking-[0.3em] md:tracking-[0.4em] uppercase text-white/30 text-glow-indigo-400">
              {t.introText}
            </p>
            <label className="w-full max-w-sm group relative block aspect-[1.4/1] border border-dashed border-white/10 rounded-[2.5rem] md:rounded-[4rem] hover:border-indigo-500/40 transition-all cursor-pointer bg-white/[0.01] hover:bg-white/[0.03] shadow-inner-xl">
              <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 md:space-y-6">
                 <div className="w-16 h-16 md:w-20 md:h-20 rounded-[2rem] md:rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-indigo-500/10 group-hover:scale-110 transition-all duration-500">
                    <svg className="w-8 h-8 md:w-10 md:h-10 text-white/10 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                 </div>
                 <span className="text-[9px] md:text-[10px] font-black tracking-[0.4em] md:tracking-[0.5em] text-white/20 uppercase group-hover:text-white/50 transition-colors">{t.upload}</span>
              </div>
            </label>
            {error && <p className="mt-8 text-red-500 text-[9px] tracking-[0.4em] uppercase font-black">{error}</p>}
          </div>
        ) : (
          <div className="h-full flex flex-col relative">
            {flowStep === 'axioms' && (
              <div className="h-full flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden animate-in fade-in zoom-in-95 duration-700">
                <div className="max-w-7xl mx-auto w-full flex flex-col gap-6 md:gap-12">
                   <div className="text-center px-4">
                      <h3 className="text-2xl md:text-6xl font-black text-white text-glow mb-2 md:mb-4 tracking-tighter uppercase">{t.axiomsTitle}</h3>
                      <p className="text-white/30 font-serif italic text-xs md:text-xl">{lang === 'ar' ? 'بديهيات تم استخلاصها من جوهر النص' : 'Fundamental axioms extracted from the core of the text'}</p>
                   </div>
                   
                   <div className="relative w-full">
                     <div className="absolute inset-y-0 left-0 w-8 md:w-32 bg-gradient-to-r from-[#020202] to-transparent z-10 pointer-events-none"></div>
                     <div className="absolute inset-y-0 right-0 w-8 md:w-32 bg-gradient-to-l from-[#020202] to-transparent z-10 pointer-events-none"></div>
                     
                     <div 
                        ref={carouselRef}
                        className="w-full flex gap-4 md:gap-12 pb-6 pt-6 md:pt-10 px-[10%] md:px-[35%] overflow-x-auto snap-x snap-mandatory scrollbar-none scroll-smooth"
                     >
                        {axioms.map((axiom, i) => (
                          <div key={i} className="min-w-[260px] md:min-w-[420px] snap-center transform transition-all duration-700 hover:scale-105">
                            <AxiomCard axiom={axiom} index={i} />
                          </div>
                        ))}
                     </div>
                   </div>

                   <div className="flex justify-center -mt-2">
                     <button 
                        onClick={() => setFlowStep('chat')}
                        className="group relative px-10 md:px-20 py-4 md:py-7 bg-white/5 border border-white/10 rounded-full overflow-hidden hover:border-indigo-500/40 transition-all active:scale-95 shadow-2xl flex items-center justify-center min-w-[200px]"
                     >
                       <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       <span className="relative text-[9px] md:text-xs font-black tracking-[0.4em] md:tracking-[0.6em] text-white/90 uppercase">
                         {t.deepChatBtn}
                       </span>
                     </button>
                   </div>
                </div>
              </div>
            )}

            {flowStep === 'chat' && (
              <div className="h-full flex gap-0 md:gap-8 p-0 md:p-10 animate-in slide-in-from-bottom-12 duration-700 relative overflow-hidden">
                 {/* مستعرض المخطوطة في الهاتف (Overlay) */}
                 {showViewer && (
                   <div className="absolute inset-0 lg:relative lg:block lg:w-1/2 h-full z-[100] lg:z-10 animate-in fade-in lg:slide-in-from-left duration-300 rounded-none lg:rounded-[3rem] overflow-hidden shadow-2xl lg:border border-white/10">
                     <div className="absolute top-4 right-4 z-[110] lg:hidden">
                       <button onClick={() => setShowViewer(false)} className="bg-black/60 p-2 rounded-full text-white backdrop-blur-md border border-white/20">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                       </button>
                     </div>
                     <ManuscriptViewer pdf={pdf} lang={lang} />
                   </div>
                 )}
                 
                 <div className={`flex-1 h-full flex flex-col max-w-full lg:max-w-5xl mx-auto w-full relative z-10`}>
                    <div className="hidden md:flex mb-6 justify-between items-center px-8">
                       <button 
                         onClick={() => setFlowStep('axioms')}
                         className="text-[10px] font-black tracking-[0.5em] text-white/20 hover:text-white transition-colors flex items-center gap-3 group uppercase"
                       >
                         <span className={`${lang === 'ar' ? 'group-hover:translate-x-1' : 'group-hover:-translate-x-1'} transition-transform`}>←</span> {t.axiomsTitle}
                       </button>
                       <div className="text-[9px] text-white/10 uppercase tracking-[0.5em] font-black">Neural Link Synchronized</div>
                    </div>
                    {/* منطقة الدردشة الموسعة */}
                    <div className="flex-1 min-h-0 bg-[#080808] md:rounded-[3rem] overflow-hidden md:border border-white/5 shadow-inner-2xl">
                       <ChatInterface pdf={pdf} lang={lang} />
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
