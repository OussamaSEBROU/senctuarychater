/**
 * OCR Service - Multi-language PDF Text Extraction
 * Simplified & Robust version using PDF.js
 */

import * as pdfjsLib from 'pdfjs-dist';

// Explicitly set worker URL to a reliable CDN matching the version
// Using unpkg which is generally faster/more reliable for this library
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

/**
 * Extract text from PDF using PDF.js
 */
const extractTextFromPDF = async (pdfBase64: string): Promise<string> => {
    try {
        console.log("OCR Service: decoding base64...");
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        console.log("OCR Service: Loading PDF Document...");
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        const numPages = pdf.numPages;
        console.log(`OCR Service: PDF Loaded with ${numPages} pages.`);

        let fullText = "";

        // Limit pages to avoid timeout on large docs (Max 20 pages for demo)
        const maxPages = Math.min(numPages, 30);

        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();

                // Improved text stitching
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ');

                // Add minimal cleanup
                if (pageText.trim().length > 0) {
                    fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`;
                }
            } catch (pageError) {
                console.warn(`OCR Service: Skipped page ${pageNum} due to error`, pageError);
                continue; // Keep going even if one page fails
            }
        }

        return fullText.trim();
    } catch (error) {
        console.error("OCR Service Critical Error:", error);
        // Return empty string to allow handling upstream rather than crashing
        throw new Error("PDF_READ_FAILED: " + (error as any).message);
    }
};

/**
 * Main PDF extraction function with validation
 */
export const extractPDFContent = async (
    pdfBase64: string,
    onProgress?: (status: string, progress: number) => void
): Promise<string> => {
    try {
        onProgress?.("Loading PDF Worker...", 0.1);

        const extractedText = await extractTextFromPDF(pdfBase64);

        if (!extractedText || extractedText.length < 20) {
            console.warn("OCR Service: Text extraction yielded empty result.");
            throw new Error("EMPTY_TEXT_EXTRACTED");
        }

        console.log(`OCR Service: Success! Extracted ${extractedText.length} chars.`);
        onProgress?.("Processing text...", 0.9);

        return extractedText;

    } catch (error) {
        console.error("OCR Workflow Failed:", error);
        throw error;
    }
};
