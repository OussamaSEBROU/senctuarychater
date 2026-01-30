/**
 * OCR Service - Multi-language PDF Text Extraction
 * Supports Arabic, English, and other languages
 * Uses PDF.js for text extraction and Tesseract.js for OCR on scanned documents
 */

import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

/**
 * Check if text is mostly empty/whitespace (indicates scanned PDF)
 */
const isTextEmpty = (text: string): boolean => {
    const cleanText = text.replace(/\s+/g, '').trim();
    return cleanText.length < 100; // Less than 100 characters suggests scanned PDF
};

/**
 * Detect if document needs OCR based on text content
 */
const needsOCR = (extractedText: string): boolean => {
    // If very little text extracted, likely a scanned document
    if (isTextEmpty(extractedText)) return true;

    // Check for gibberish patterns that indicate failed text extraction
    const gibberishPattern = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
    const gibberishMatches = extractedText.match(gibberishPattern);
    if (gibberishMatches && gibberishMatches.length > extractedText.length * 0.1) {
        return true;
    }

    return false;
};

/**
 * Extract text from PDF using PDF.js
 */
const extractTextFromPDF = async (pdfBase64: string): Promise<string> => {
    try {
        // Convert base64 to Uint8Array
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Load PDF document
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const numPages = pdf.numPages;
        let fullText = "";

        console.log(`PDF loaded: ${numPages} pages`);

        // Extract text from each page
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            // Combine text items with proper spacing
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');

            fullText += pageText + "\n\n";
        }

        return fullText.trim();
    } catch (error) {
        console.error("Error extracting text from PDF:", error);
        throw error;
    }
};

/**
 * Perform OCR on PDF pages using Tesseract.js
 * Dynamically imports Tesseract for better performance
 */
const performOCROnPDF = async (
    pdfBase64: string,
    onProgress?: (progress: number) => void
): Promise<string> => {
    try {
        // Dynamic import for Tesseract
        const Tesseract = await import('tesseract.js');

        // Convert base64 to Uint8Array
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Load PDF document
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const numPages = Math.min(pdf.numPages, 50); // Limit pages for performance
        let fullText = "";

        console.log(`Starting OCR on ${numPages} pages...`);

        // Create worker for OCR
        const worker = await Tesseract.createWorker('ara+eng+fra+deu+spa+ita+por+rus+chi_sim+jpn+kor', 1, {
            logger: (m) => {
                if (m.status === 'recognizing text' && onProgress) {
                    onProgress(m.progress);
                }
            }
        });

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const scale = 2.0; // Higher scale for better OCR accuracy
                const viewport = page.getViewport({ scale });

                // Create canvas for rendering
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) continue;

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                // Render page to canvas
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                // Convert canvas to image data
                const imageData = canvas.toDataURL('image/png');

                // Perform OCR on the image
                const { data: { text } } = await worker.recognize(imageData);
                fullText += text + "\n\n";

                console.log(`OCR completed for page ${pageNum}/${numPages}`);

                if (onProgress) {
                    onProgress(pageNum / numPages);
                }
            } catch (pageError) {
                console.error(`Error processing page ${pageNum}:`, pageError);
                continue;
            }
        }

        await worker.terminate();
        return fullText.trim();
    } catch (error) {
        console.error("Error performing OCR:", error);
        throw error;
    }
};

/**
 * Main PDF extraction function
 * Automatically detects if OCR is needed and applies it
 */
export const extractPDFContent = async (
    pdfBase64: string,
    onProgress?: (status: string, progress: number) => void
): Promise<string> => {
    try {
        onProgress?.("Extracting text from PDF...", 0.1);

        // First, try native text extraction (fastest)
        const nativeText = await extractTextFromPDF(pdfBase64);

        // Check if we got meaningful text
        if (!needsOCR(nativeText)) {
            console.log("Native text extraction successful");
            onProgress?.("Text extraction complete", 1.0);
            return nativeText;
        }

        console.log("Native extraction yielded little text, attempting OCR...");
        onProgress?.("Scanned document detected, starting OCR...", 0.2);

        // If native extraction failed, use OCR
        const ocrText = await performOCROnPDF(pdfBase64, (progress) => {
            onProgress?.("Performing OCR...", 0.2 + progress * 0.8);
        });

        // Combine both results if native had some text
        const combinedText = nativeText.length > 0
            ? `${nativeText}\n\n--- OCR EXTRACTED TEXT ---\n\n${ocrText}`
            : ocrText;

        onProgress?.("OCR complete", 1.0);
        return combinedText;

    } catch (error) {
        console.error("Error in PDF content extraction:", error);
        throw error;
    }
};

/**
 * Quick text extraction without OCR (for fast initial processing)
 */
export const quickExtractPDF = async (pdfBase64: string): Promise<string> => {
    return extractTextFromPDF(pdfBase64);
};

/**
 * Check if PDF needs OCR processing
 */
export const checkPDFNeedsOCR = async (pdfBase64: string): Promise<boolean> => {
    const text = await extractTextFromPDF(pdfBase64);
    return needsOCR(text);
};
