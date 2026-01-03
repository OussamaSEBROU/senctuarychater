
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
      <div className="flex-1 bg-[#050505] relative">
        {blobUrl ? (
          <iframe
            src={`${blobUrl}#view=FitH&toolbar=0&navpanes=0`}
            className="w-full h-full border-none"
            title="Manuscript Viewer"
            allow="fullscreen"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-2 border-[#a34a28] border-t-transparent animate-spin rounded-full"></div>
            <span className="text-[10px] font-black tracking-widest text-white/20 uppercase">Synchronizing Neural Link...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManuscriptViewer;
