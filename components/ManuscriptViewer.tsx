
import React, { useEffect, useRef, useState } from 'react';
import { PDFData, Language } from '../types';
import { translations } from '../translations';

interface ManuscriptViewerProps {
  pdf: PDFData;
  lang: Language;
}

export const ManuscriptViewer: React.FC<ManuscriptViewerProps> = ({ pdf, lang }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const t = translations[lang];

  useEffect(() => {
    if (!pdf.base64) return;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        // @ts-ignore - Importing from URL for high performance and no-install deployment
        const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.10.38');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

        const binaryString = atob(pdf.base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdfDoc = await loadingTask.promise;
        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        setLoading(false);
      } catch (err) {
        console.error("Error loading PDF with pdf.js:", err);
        setError(lang === 'ar' ? "فشل تحميل المحتوى البصري للمخطوط." : "Failed to load manuscript visual core.");
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
      }
    };
  }, [pdf.base64, lang]);

  return (
    <div className="w-full h-full flex flex-col bg-[#050505] overflow-hidden select-none">
      <div className="h-12 bg-black/90 border-b border-white/10 flex items-center justify-between px-6 z-30 shadow-2xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 opacity-60">
            <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0L2 5v14l10 5 10-5V5L12 0zm8 17.4l-8 4-8-4V6.6l8-4 8 4v10.8zM12 5.3L5.3 8.7 12 12l6.7-3.3L12 5.3z"/>
            </svg>
            <span className="text-[10px] font-black tracking-[0.2em] uppercase hidden md:block">Sanctuary Library</span>
          </div>
          <div className="h-4 w-[1px] bg-white/10 hidden md:block"></div>
          <span className="text-[11px] font-medium text-white/50 truncate max-w-[200px] md:max-w-md">
            {pdf.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[9px] font-black text-orange-600/80 uppercase tracking-widest animate-pulse">Neural Sync Active</span>
        </div>
      </div>

      <div 
        ref={containerRef} 
        className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory bg-black flex flex-row items-center gap-6 md:gap-24 px-8 md:px-[20vw] scrollbar-none scroll-smooth relative"
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 z-50 bg-black">
            <div className="spinner-arc w-16 h-16 border-t-orange-600"></div>
            <p className="text-[#a34a28] text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">
              {lang === 'ar' ? 'جاري استحضار الصفحات...' : 'Summoning Manuscript Pages...'}
            </p>
          </div>
        )}

        {error && (
           <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black">
             <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-red-500/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             </div>
             <p className="text-[10px] text-red-500/60 font-black uppercase tracking-widest max-w-xs leading-loose">{error}</p>
           </div>
        )}
        
        {!loading && !error && Array.from({ length: numPages }, (_, i) => (
          <PageRenderer key={i} pdfDoc={pdfDocRef.current} pageNum={i + 1} />
        ))}
      </div>

      {!loading && !error && (
        <div className="h-12 bg-black/95 border-t border-white/5 flex items-center justify-center px-6 gap-8 z-30 shrink-0">
           <div className="flex items-center gap-4">
              <span className="text-[9px] font-black text-white/20 tracking-[0.3em] uppercase">Manuscript Navigation</span>
              <div className="flex items-center bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
                 <span className="text-[10px] font-mono text-orange-500 font-bold">{numPages}</span>
                 <span className="text-[10px] font-mono text-white/20 mx-2">TOTAL PAGES</span>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const PageRenderer: React.FC<{ pdfDoc: any, pageNum: number }> = ({ pdfDoc, pageNum }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '0px 400px 0px 400px'
      }
    );

    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !pdfDoc || !canvasRef.current || isRendered) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: window.devicePixelRatio || 1.5 });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        setIsRendered(true);
      } catch (err) {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    };

    renderPage();
  }, [isVisible, pdfDoc, pageNum, isRendered]);

  return (
    <div className="relative group h-[70vh] md:h-[80vh] flex-shrink-0 snap-center flex items-center justify-center">
      <div className="relative h-full w-auto shadow-[0_40px_100px_rgba(0,0,0,0.9)] rounded-sm overflow-hidden bg-zinc-900 ring-1 ring-white/10 transition-transform duration-700 group-hover:scale-[1.01]">
        {!isRendered && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
             <div className="w-8 h-8 border-2 border-white/5 border-t-white/20 rounded-full animate-spin"></div>
          </div>
        )}
        <canvas 
          ref={canvasRef} 
          className={`h-full w-auto block object-contain transition-opacity duration-1000 ${isRendered ? 'opacity-100' : 'opacity-0'}`} 
          style={{ backgroundColor: '#fff' }}
        />
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl px-5 py-2 rounded-full text-[9px] font-black text-white/40 opacity-0 group-hover:opacity-100 transition-all duration-300 uppercase tracking-[0.3em] border border-white/10 shadow-2xl pointer-events-none">
          Page {pageNum} <span className="mx-1 text-white/10">|</span> {pdfDoc?.numPages || '?'}
        </div>
      </div>
      <div className="absolute -left-12 inset-y-0 w-px bg-gradient-to-b from-transparent via-white/5 to-transparent hidden md:block"></div>
      <div className="absolute -right-12 inset-y-0 w-px bg-gradient-to-b from-transparent via-white/5 to-transparent hidden md:block"></div>
    </div>
  );
};

export default ManuscriptViewer;
