import React, { useState, useRef, useEffect } from 'react';
import { Axiom, PDFData, Language } from './types';
// Updated import to use the new Groq service
import { extractAxioms } from './services/groqService';
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
    "إن الأمة التي تنسى تاريخها لا يمكنها أن تبني مستقبلها. — البشير الإبراهيمي",
    "اللغة هي وعاء الفكر، فإذا فسد الوعاء فسد ما فيه. — البشير الإبراهيمي",
    "العمل هو المقياس الحقيقي لقيمة الإنسان. — البشير الإبراهيمي",
    "الاستعمار الفكري أخطر من الاستعمار العسكري. — البشير الإبراهيمي",
    "الوهم نصف الداء، والاطمئنان نصف الدواء، والصبر أول خطوات الشفاء. — ابن سينا (القانون في الطب)",
    "العقل البشري هو أعظم هبة من الله، وبه ندرك الحقائق. — ابن سينا",
    "العلم هو مصباح العقل ودليل الروح. — ابن سينا",
    "من أراد أن يتعلم فليقرأ، ومن أراد أن يفهم فليتأمل. — ابن سينا",
    "الحقيقة لا تدرك إلا بالبحث والتمحيص. — ابن سينا",
    "الرياضيات هي لغة الكون، وبها نفهم أسرار الطبيعة. — الخوارزمي",
    "العلم كنز لا يفنى، والعمل به هو مفتاح النجاح. — الخوارزمي",
    "التنظيم هو أساس كل عمل عظيم. — الخوارزمي",
    "الابتكار هو القدرة على رؤية ما لا يراه الآخرون. — الخوارزمي",
    "الدقة في العمل هي سمة العلماء. — الخوارزمي"
  ]
};

function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [pdf, setPdf] = useState<PDFData | null>(null);
  const [axioms, setAxioms] = useState<Axiom[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuote, setCurrentQuote] = useState('');
  const t = translations[lang];

  useEffect(() => {
    const updateQuote = () => {
      const langQuotes = quotes[lang];
      const randomQuote = langQuotes[Math.floor(Math.random() * langQuotes.length)];
      setCurrentQuote(randomQuote);
    };
    updateQuote();
    const interval = setInterval(updateQuote, 10000);
    return () => clearInterval(interval);
  }, [lang]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError(lang === 'ar' ? 'يرجى رفع ملف PDF فقط' : 'Please upload PDF files only');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setPdf({ base64, name: file.name });
      setIsExtracting(true);
      setError(null);

      try {
        const extractedAxioms = await extractAxioms(base64, lang);
        setAxioms(extractedAxioms);
      } catch (err: any) {
        console.error(err);
        setError(lang === 'ar' ? 'فشل استخراج الأفكار. تأكد من مفتاح API.' : 'Failed to extract axioms. Check your API key.');
      } finally {
        setIsExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <div className="relative flex h-screen overflow-hidden">
        <Sidebar lang={lang} setLang={setLang} />

        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-20 border-b border-white/5 bg-slate-950/50 backdrop-blur-md flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">{t.title}</h1>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">{t.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden lg:block max-w-md text-right">
                <p className="text-sm text-slate-400 italic line-clamp-1 animate-fade-in" key={currentQuote}>
                  {currentQuote}
                </p>
              </div>
              {!pdf && (
                <label className="group relative flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-lg shadow-blue-900/20 active:scale-95">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="font-semibold text-sm">{t.uploadBtn}</span>
                  <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden p-8">
            {!pdf ? (
              <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-12">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
                  <div className="relative w-32 h-32 rounded-3xl bg-slate-900 border border-white/10 flex items-center justify-center shadow-2xl">
                    <svg className="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-bold text-white tracking-tight">
                    {lang === 'ar' ? 'حول مخطوطاتك إلى معرفة حية' : 'Transform Manuscripts into Living Knowledge'}
                  </h2>
                  <p className="text-lg text-slate-400 leading-relaxed">
                    {lang === 'ar' 
                      ? 'ارفع ملف PDF الخاص بك وسيقوم نظامنا بتحليله واستخراج الأفكار الجوهرية منه لتبدأ حواراً معرفياً عميقاً.' 
                      : 'Upload your PDF and our system will analyze it, extracting core axioms for a deep intellectual dialogue.'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-8 w-full pt-8">
                  {[
                    { label: lang === 'ar' ? 'تحليل عميق' : 'Deep Analysis', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                    { label: lang === 'ar' ? 'استخراج الأفكار' : 'Axiom Extraction', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                    { label: lang === 'ar' ? 'حوار تفاعلي' : 'Interactive Chat', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' }
                  ].map((item, i) => (
                    <div key={i} className="space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-blue-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex gap-8 animate-fade-in">
                {/* Left Side: Axioms & Viewer */}
                <div className="flex-1 flex flex-col gap-8 min-w-0">
                  {isExtracting ? (
                    <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl space-y-8">
                      <div className="relative">
                        <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 bg-blue-500/10 rounded-full animate-pulse" />
                        </div>
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold text-white">{t.extracting}</h3>
                        <p className="text-sm text-slate-400">{lang === 'ar' ? 'جاري استخراج الأفكار الجوهرية...' : 'Extracting core intellectual axioms...'}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-2 custom-scrollbar max-h-[40%] shrink-0">
                        {axioms.map((axiom, i) => (
                          <AxiomCard key={i} axiom={axiom} index={i} />
                        ))}
                      </div>
                      <div className="flex-1 min-h-0">
                        <ManuscriptViewer pdf={pdf} />
                      </div>
                    </>
                  )}
                </div>

                {/* Right Side: Chat Interface */}
                <div className="w-[450px] shrink-0">
                  <ChatInterface pdf={pdf} lang={lang} />
                </div>
              </div>
            )}
          </div>

          {/* Error Toast */}
          {error && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/20 backdrop-blur-xl text-red-400 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl animate-bounce">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{error}</span>
              <button onClick={() => setError(null)} className="hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
