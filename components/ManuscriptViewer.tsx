
import React, { useEffect, useState, useRef } from 'react';
import { PDFData, Language } from '../types';
import { translations } from '../translations';

interface ManuscriptViewerProps {
  pdf: PDFData;
  lang: Language;
}

const ManuscriptViewer: React.FC<ManuscriptViewerProps> = ({ pdf, lang }) => {
  const t = translations[lang];
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const binaryString = window.atob(pdf.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    } catch (error) {
      console.error("Reader initialization error:", error);
    }
  }, [pdf.base64]);

  return (
    <div className="w-full h-full flex flex-col bg-[#111] overflow-hidden relative border border-white/10 rounded-2xl shadow-2xl font-sans" ref={containerRef}>
      {/* Archive Style Header */}
      <div className="h-12 bg-[#1a1a1a] border-b border-white/10 flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/40"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/40"></div>
          </div>
          <div className="h-6 w-[1px] bg-white/10 mx-2"></div>
          <span className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-black truncate max-w-[200px]">
            {pdf.name}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-white/30 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </button>
        </div>
      </div>

      {/* Reader Viewport */}
      <div className="flex-1 bg-[#222] p-2 md:p-6 flex items-center justify-center relative overflow-hidden">
        <div className="w-full h-full bg-[#333] shadow-2xl rounded border border-white/5 overflow-hidden flex items-center justify-center">
          {blobUrl ? (
            <iframe
              src={`${blobUrl}#view=FitH&toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full border-none bg-white"
              title="Manuscript Digital Display"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-[10px] text-white/20 uppercase tracking-[0.5em] animate-pulse">Neural Decryption...</p>
            </div>
          )}
        </div>
      </div>

      {/* Archive Style Controls */}
      <div className="h-14 bg-[#1a1a1a] border-t border-white/10 flex items-center justify-between px-8 shrink-0 z-20">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-6">
            <button className="text-white/20 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg></button>
            <div className="flex items-center gap-3">
               <span className="text-[10px] text-white/40 uppercase font-black">Archive Link: Enabled</span>
            </div>
            <button className="text-white/20 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg></button>
          </div>
        </div>

        <div className="hidden md:flex items-center bg-black/40 rounded-full px-6 py-2 border border-white/5 gap-6">
           <button className="text-white/40 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></button>
           <button className="text-indigo-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg></button>
           <button className="text-white/20 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg></button>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex gap-1.5">
             {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-1 h-1 rounded-full bg-white/10"></div>)}
           </div>
        </div>
      </div>
    </div>
  );
};

export default ManuscriptViewer;
