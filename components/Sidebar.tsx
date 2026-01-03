
import React from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  setLang: (l: Language) => void;
  activePanel: 'chat' | 'viewer' | 'axioms';
  setActivePanel: (p: 'chat' | 'viewer' | 'axioms') => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, lang, setLang, onNewChat }) => {
  const t = translations[lang];

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/90 backdrop-blur-md z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <aside className={`fixed top-0 bottom-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-[320px] bg-[#050505] border-${lang === 'ar' ? 'l' : 'r'} border-white/5 z-[70] transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform ${isOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')} p-10 flex flex-col shadow-2xl`}>
        <div className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>
             <h2 className="text-glow font-black tracking-[0.5em] text-[10px] uppercase text-white/80">{t.title}</h2>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white transition-colors text-xl">✕</button>
        </div>

        <nav className="flex-1 space-y-12">
          <section>
            <button 
              onClick={() => {
                onNewChat();
                onClose();
              }}
              className="w-full group flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-indigo-500/40 transition-all hover:bg-white/[0.08]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-[10px] font-black tracking-[0.3em] uppercase text-white/80 group-hover:text-white transition-colors">
                  {t.newSanctuary}
                </span>
              </div>
            </button>
          </section>

          <section>
            <p className="text-[9px] font-black tracking-[0.4em] text-white/20 uppercase mb-6">{t.language}</p>
            <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-2xl border border-white/5">
              <button 
                onClick={() => setLang('en')}
                className={`py-3 text-[9px] font-black rounded-xl transition-all tracking-widest ${lang === 'en' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/30 hover:text-white'}`}
              >
                ENGLISH
              </button>
              <button 
                onClick={() => setLang('ar')}
                className={`py-3 text-[9px] font-black rounded-xl transition-all tracking-widest ${lang === 'ar' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/30 hover:text-white'}`}
              >
                العربية
              </button>
            </div>
          </section>

          <div className="space-y-10">
            <section>
              <p className="text-[9px] font-black tracking-[0.4em] text-white/20 uppercase mb-3">{t.about}</p>
              <p className="text-[11px] text-white/40 leading-relaxed font-serif italic">{t.aboutText}</p>
            </section>
            
            <section>
              <p className="text-[9px] font-black tracking-[0.4em] text-white/20 uppercase mb-3">{t.help}</p>
              <p className="text-[11px] text-white/40 leading-relaxed">{t.helpText}</p>
            </section>
          </div>
        </nav>

        <div className="pt-8 border-t border-white/5">
           <div className="flex flex-col gap-2">
              <span className="text-[8px] text-white/10 font-black tracking-[0.3em] uppercase">Security Status: Encrypted</span>
              <span className="text-[8px] text-white/10 font-black tracking-[0.3em] uppercase">Knowledge AI Core: V3.2 Neural</span>
           </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
