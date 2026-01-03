
import React, { useState, useRef } from 'react';
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
      setError(lang === 'ar' ? "فشل التحليل." : "Synthesis failed.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  return (
    <div className={`fixed inset-0 flex flex-col bg-[#020202] text-white ${lang === 'ar' ? 'rtl' : 'ltr'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {isSynthesizing && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-6 text-center">
          <div className="spinner-arc mb-12 !border-t-[#a34a28]"></div>
          <h2 className="text-white text-lg font-black tracking-[0.4em] mb-10 uppercase">{t.synthesis}</h2>
          <p className="text-orange-200/60 italic max-w-md">{t.covenant}</p>
        </div>
      )}

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        lang={lang} 
        setLang={setLang}
        onNewChat={handleNewChat}
      />

      <header className="h-14 md:h-20 px-4 md:px-10 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-3xl z-[60] shrink-0">
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <h1 className="text-[10px] font-black tracking-[0.6em] text-white/40 uppercase">{t.title}</h1>
        {pdf && (
          <button 
            onClick={() => setShowViewer(!showViewer)}
            className={`p-2.5 rounded-xl transition-all border ${showViewer ? 'bg-[#a34a28] border-[#a34a28] text-white' : 'bg-white/5 border-white/5 text-white/40'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </button>
        )}
      </header>

      <main className="flex-1 overflow-hidden relative z-10">
        {!pdf ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <h2 className="text-6xl md:text-9xl font-black mb-4 select-none text-white tracking-tighter uppercase">{t.sanctuary}</h2>
            <p className="mb-12 text-sm md:text-xl font-bold tracking-tight text-[#a34a28] max-w-2xl leading-relaxed">
              {t.introText}
            </p>
            <label className="w-full max-w-sm group relative block aspect-[1.3/1] border border-dashed border-white/10 rounded-[3rem] hover:border-[#a34a28]/40 transition-all cursor-pointer bg-white/[0.01]">
              <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6">
                 <div className="w-16 h-16 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#a34a28]/10 transition-all duration-500">
                    <svg className="w-8 h-8 text-white/10 group-hover:text-[#a34a28]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                 </div>
                 <span className="text-[10px] md:text-xs font-black tracking-[0.4em] text-white/20 uppercase group-hover:text-white/60">{t.upload}</span>
              </div>
            </label>
            {error && <p className="mt-4 text-red-500 text-xs font-bold uppercase tracking-widest">{error}</p>}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {flowStep === 'axioms' && (
              <div className="h-full flex flex-col items-center justify-center p-4">
                 <h3 className="text-2xl md:text-5xl font-black mb-8 uppercase text-center text-white/90 tracking-widest">{t.axiomsTitle}</h3>
                 <div ref={carouselRef} className="w-full flex gap-6 px-[10%] overflow-x-auto snap-x scrollbar-none pb-10">
                    {axioms.map((ax, i) => (
                      <div key={i} className="min-w-[280px] md:min-w-[400px] snap-center">
                        <AxiomCard axiom={ax} index={i} />
                      </div>
                    ))}
                 </div>
                 <button onClick={() => setFlowStep('chat')} className="px-12 py-5 bg-[#a34a28] rounded-full font-black text-xs tracking-[0.4em] uppercase hover:bg-orange-800 transition-all shadow-2xl">
                   {t.deepChatBtn}
                 </button>
              </div>
            )}
            {flowStep === 'chat' && (
              <div className="h-full flex relative overflow-hidden">
                {showViewer && (
                  <div className="absolute inset-0 lg:relative lg:w-1/2 bg-black z-[70] lg:z-10 animate-in fade-in slide-in-from-right duration-300 border-r border-white/5">
                    <button onClick={() => setShowViewer(false)} className="absolute top-4 right-4 z-[80] lg:hidden bg-white/10 p-2 rounded-full backdrop-blur-md border border-white/10">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                    <ManuscriptViewer pdf={pdf} lang={lang} />
                  </div>
                )}
                <div className={`flex-1 h-full bg-[#080808] transition-all duration-500`}>
                  <ChatInterface pdf={pdf} lang={lang} />
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
