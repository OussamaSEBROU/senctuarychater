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
  
  // Cumulative Reading Time Logic
  const [readingTime, setReadingTime] = useState<number>(0);
  const [showAchievement, setShowAchievement] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const t = translations[lang];

  // Load cumulative time from localStorage on mount or when PDF changes
  useEffect(() => {
    if (pdf.title) {
      const savedTime = localStorage.getItem(`reading_time_${pdf.title}`);
      setReadingTime(savedTime ? parseInt(savedTime, 10) : 0);
    }
  }, [pdf.title]);

  // Save cumulative time to localStorage every 5 seconds or on unmount
  useEffect(() => {
    const timer = setInterval(() => {
      setReadingTime(prev => {
        const newTime = prev + 1;
        if (pdf.title) {
          localStorage.setItem(`reading_time_${pdf.title}`, newTime.toString());
        }
        return newTime;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [pdf.title]);

  const getStars = (seconds: number) => {
    const mins = seconds / 60;
    if (mins >= 120) return 6;
    if (mins >= 90) return 5;
    if (mins >= 60) return 4;
    if (mins >= 40) return 3;
    if (mins >= 15) return 2;
    if (mins >= 5) return 1;
    return 0;
  };

  const stars = getStars(readingTime);

  useEffect(() => {
    if (stars > 0) {
      setShowAchievement(`🌟 ${stars} ${lang === 'ar' ? 'نجوم' : 'Stars'}`);
      const timeout = setTimeout(() => setShowAchievement(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [stars, lang]);

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
        setError(lang === 'ar' ? "فشل تحميل المخطوط" : "Failed to load manuscript.");
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

  const renderPage = async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 * zoom });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', err);
      }
    }
  };

  useEffect(() => {
    renderPage(currentPage);
  }, [currentPage, zoom, loading]);

  const handleGoToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPage);
    if (pageNum >= 1 && pageNum <= numPages) {
      setCurrentPage(pageNum);
      setJumpPage('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {lang === 'ar' ? 'الصفحة' : 'Page'} {currentPage} / {numPages}
          </span>
          <form onSubmit={handleGoToPage} className="flex items-center gap-2">
            <input
              type="number"
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              placeholder={lang === 'ar' ? 'اذهب إلى...' : 'Go to...'}
              className="w-16 px-2 py-1 text-sm bg-zinc-700 border border-zinc-600 rounded focus:outline-none focus:border-blue-500"
            />
            <button type="submit" className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors">
              {lang === 'ar' ? 'انتقال' : 'Go'}
            </button>
          </form>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-700 px-3 py-1 rounded-full">
            <span className="text-xs text-zinc-400">{lang === 'ar' ? 'وقت المطالعة:' : 'Reading Time:'}</span>
            <span className="text-sm font-bold text-blue-400">{Math.floor(readingTime / 60)}m {readingTime % 60}s</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))} className="p-1 hover:bg-zinc-700 rounded">-</button>
            <span className="text-sm">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(prev => Math.min(3, prev + 0.1))} className="p-1 hover:bg-zinc-700 rounded">+</button>
          </div>
        </div>
      </div>

      {/* PDF Viewer Area */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4 flex justify-center items-start bg-zinc-950">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 mt-10">{error}</div>
        ) : (
          <div className="relative shadow-2xl">
            <canvas ref={canvasRef} className="max-w-full h-auto" />
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="p-4 bg-zinc-800 border-t border-zinc-700 flex justify-center gap-4">
        <button
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage(prev => prev - 1)}
          className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded-lg transition-colors"
        >
          {lang === 'ar' ? 'السابق' : 'Previous'}
        </button>
        <button
          disabled={currentPage >= numPages}
          onClick={() => setCurrentPage(prev => prev + 1)}
          className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded-lg transition-colors"
        >
          {lang === 'ar' ? 'التالي' : 'Next'}
        </button>
      </div>

      {/* Achievement Toast */}
      {showAchievement && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg animate-bounce z-50">
          {showAchievement}
        </div>
      )}
    </div>
  );
};

export default ManuscriptViewer;
