
import React, { useEffect, useRef, useState } from 'react';
import { PDFData, Language } from '../types';
import { translations } from '../translations';

interface ManuscriptViewerProps {
  pdf: PDFData;
  lang: Language;
}

export const ManuscriptViewer: React.FC<ManuscriptViewerProps> = ({ pdf, lang }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jumpPage, setJumpPage] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1.0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const t = translations[lang];

  useEffect(() => {
    if (!pdf.base64) return;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        // @ts-ignore
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
        console.error("Error loading PDF:", err);
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

  // مراقبة الصفحة الحالية عند التمرير
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const width = container.clientWidth;
      const page = Math.round(scrollLeft / width) + 1;
      if (page !== currentPage && page > 0 && page <= numPages) {
        setCurrentPage(page);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentPage, numPages]);

  const goToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPage);
    if (pageNum > 0 && pageNum <= numPages && containerRef.current) {
      const width = containerRef.current.clientWidth;
      containerRef.current.scrollTo({
        left: (pageNum - 1) * width,
        behavior: 'smooth'
      });
      setJumpPage('');
    }
  };

  const handleZoom = (delta: number) => {
    setZoom(prev => {
      const newZoom = Math.min(Math.max(prev + delta, 0.5), 3.0);
      return parseFloat(newZoom.toFixed(1));
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#050505] overflow-hidden select-none">
      {/* شريط الأدوات العلوي */}
      <div className="h-12 bg-black/90 border-b border-white/10 flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-medium text-white/40 truncate max-w-[100px] md:max-w-xs">
            {pdf.name}
          </span>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
          {/* أدوات الزوم */}
          <div className="flex items-center bg-white/5 rounded-lg border border-white/10 overflow-hidden">
            <button 
              type="button"
              onClick={() => handleZoom(-0.2)} 
              className="p-2 hover:bg-white/10 text-white/60 active:text-orange-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>
            </button>
            <span className="text-[10px] font-mono text-white/40 px-2 min-w-[45px] text-center">{Math.round(zoom * 100)}%</span>
            <button 
              type="button"
              onClick={() => handleZoom(0.2)} 
              className="p-2 hover:bg-white/10 text-white/60 active:text-orange-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          {/* الانتقال لصفحة */}
          {!loading && !error && (
            <form onSubmit={goToPage} className="flex items-center gap-2">
              <input 
                type="number" 
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value)}
                placeholder={currentPage.toString()}
                className="w-12 bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] text-white text-center focus:outline-none focus:border-orange-500 transition-colors"
              />
              <span className="text-[10px] text-white/20 uppercase font-black tracking-tighter">/ {numPages}</span>
            </form>
          )}
        </div>
      </div>

      {/* منطقة عرض الصفحات */}
      <div 
        ref={containerRef} 
        className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory bg-black flex flex-row items-center scrollbar-none scroll-smooth relative"
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 z-50 bg-black">
            <div className="spinner-arc w-12 h-12 border-t-orange-600"></div>
            <p className="text-[#a34a28] text-[9px] font-black uppercase tracking-[0.3em] animate-pulse">
              {lang === 'ar' ? 'جاري الاستحضار...' : 'Summoning...'}
            </p>
          </div>
        )}

        {error && (
           <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black">
             <p className="text-[10px] text-red-500/60 font-black uppercase tracking-widest">{error}</p>
           </div>
        )}
        
        {!loading && !error && Array.from({ length: numPages }, (_, i) => (
          <div key={i} className="w-full h-full flex-shrink-0 flex items-center justify-center snap-center overflow-auto scrollbar-none">
            <PageRenderer pdfDoc={pdfDocRef.current} pageNum={i + 1} zoom={zoom} />
          </div>
        ))}
      </div>
    </div>
  );
};

const PageRenderer: React.FC<{ pdfDoc: any, pageNum: number, zoom: number }> = ({ pdfDoc, pageNum, zoom }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      },
      { threshold: 0.1, rootMargin: '0px 400px 0px 400px' }
    );
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !pdfDoc || !canvasRef.current) return;
    
    const renderPage = async () => {
      try {
        // إلغاء أي عملية رندر سابقة لنفس الصفحة لتجنب التعارض عند تغيير الزوم بسرعة
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 * zoom });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = { canvasContext: context, viewport };
        renderTaskRef.current = page.render(renderContext);
        
        await renderTaskRef.current.promise;
        setIsRendered(true);
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
      }
    };
    renderPage();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [isVisible, pdfDoc, pageNum, zoom]);

  return (
    <div className="relative flex items-center justify-center min-h-full min-w-full p-2 md:p-4">
      <div className="relative shadow-2xl bg-white transition-transform duration-300">
        {!isRendered && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
             <div className="w-6 h-6 border-2 border-white/5 border-t-white/20 rounded-full animate-spin"></div>
          </div>
        )}
        <canvas 
          ref={canvasRef} 
          className={`block object-contain transition-opacity duration-500 ${isRendered ? 'opacity-100' : 'opacity-0'}`}
          style={{ 
            width: 'auto', 
            height: zoom > 1.2 ? 'auto' : 'calc(100vh - 80px)',
            maxWidth: '100%',
            maxHeight: zoom > 1.2 ? 'none' : 'calc(100vh - 80px)'
          }}
        />
      </div>
    </div>
  );
};

export default ManuscriptViewer;

