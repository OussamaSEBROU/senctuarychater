
import React, { useEffect, useState } from 'react';
import { PDFData, Language } from '../types';

interface ManuscriptViewerProps {
  pdf: PDFData;
  lang: Language;
}

const ManuscriptViewer: React.FC<ManuscriptViewerProps> = ({ pdf }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const binaryString = window.atob(pdf.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdf.base64]);

  return (
    <div className="w-full h-full flex flex-col bg-black">
      <div className="flex-1 bg-black relative">
        {blobUrl ? (
          <object
            data={blobUrl}
            type="application/pdf"
            className="w-full h-full"
          >
            <div className="flex flex-col items-center justify-center h-full p-10 text-center">
              <p className="text-white/40 mb-4 uppercase text-xs">PDF Viewer not supported in this browser.</p>
              <a href={blobUrl} target="_blank" className="text-orange-500 font-bold underline">Open Direct Link</a>
            </div>
          </object>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent animate-spin rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManuscriptViewer;
