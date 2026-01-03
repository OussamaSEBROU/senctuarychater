
import React, { useEffect, useState } from 'react';
import { PDFData, Language } from '../types';

interface ManuscriptViewerProps {
  pdf: PDFData;
  lang: Language;
}

const ManuscriptViewer: React.FC<ManuscriptViewerProps> = ({ pdf }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

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
      return () => URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to generate PDF blob", e);
    }
  }, [pdf.base64]);

  return (
    <div className="w-full h-full flex flex-col bg-black overflow-hidden">
      <div className="flex-1 bg-[#050505] relative overflow-hidden">
        {blobUrl ? (
          <object
            data={`${blobUrl}#view=FitH`}
            type="application/pdf"
            className="w-full h-full"
            aria-label="Manuscript Document Viewer"
          >
            <div className="flex flex-col items-center justify-center h-full p-10 text-center space-y-4">
              <svg className="w-12 h-12 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-white/40 uppercase text-[10px] tracking-widest font-black">Browser PDF viewing is limited</p>
              <a 
                href={blobUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-6 py-3 bg-[#a34a28] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-800 transition-all"
              >
                Open in New Tab
              </a>
            </div>
          </object>
        ) : (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-2 border-[#a34a28] border-t-transparent animate-spin rounded-full"></div>
            <span className="text-[10px] font-black tracking-widest text-white/20 uppercase">Initializing Manuscript...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManuscriptViewer;
