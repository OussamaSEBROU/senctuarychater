import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const extractTextFromPdf = async (pdfBase64: string): Promise<string> => {
  const binaryString = atob(pdfBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    
    // Try to extract text directly first
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    
    if (pageText.trim().length < 100) {
      // If very little text, it might be an image-based PDF, use OCR
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        // Fix: Added 'canvas' property to RenderParameters
        await page.render({ 
          canvasContext: context, 
          viewport,
          canvas: canvas 
        }).promise;
        const imageData = canvas.toDataURL('image/png');
        
        // Use Tesseract for OCR (supporting Arabic and English)
        const { data: { text } } = await Tesseract.recognize(
          imageData,
          'ara+eng'
        );
        fullText += text + '\n';
      }
    } else {
      fullText += pageText + '\n';
    }
  }

  return fullText;
};
