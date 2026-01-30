/**
 * OCR Service - Hybrid Text Extraction
 * 1. Tries native PDF text extraction first (Fast)
 * 2. Falls back to Tesseract.js OCR for scanned docs (Slower but robust)
 * Supports Arabic ('ara') and English ('eng')
 */

import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

/**
 * 1. Native Extraction (Fast)
 */
const extractNativeText = async (pdfProxy: any, maxPages: number): Promise<string> => {
    let fullText = "";
    for (let pageNum = 1; pageNum <= Math.min(pdfProxy.numPages, maxPages); pageNum++) {
        const page = await pdfProxy.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        if (pageText.trim().length > 0) {
            fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`;
        }
    }
    return fullText;
};

/**
 * 2. OCR Extraction using Tesseract (For scanned docs)
 */
const performOCR = async (
    pdfProxy: any,
    maxPages: number,
    onProgress?: (status: string, progress: number) => void
): Promise<string> => {
    console.log("OCR Service: Starting Tesseract engine...");
    onProgress?.("Initializing OCR Engine...", 0.1);

    const worker = await createWorker('eng+ara'); // Supports English & Arabic

    let fullText = "";
    const pagesToScan = Math.min(pdfProxy.numPages, maxPages);

    for (let pageNum = 1; pageNum <= pagesToScan; pageNum++) {
        onProgress?.(`Scanning Page ${pageNum}/${pagesToScan}...`, 0.2 + (pageNum / pagesToScan) * 0.7);

        const page = await pdfProxy.getPage(pageNum);

        // Render page to canvas for OCR
        const viewport = page.getViewport({ scale: 1.5 }); // 1.5x scale for better accuracy
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) continue;

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        // Convert canvas to image blob
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve));
        if (!blob) continue;

        // Recognize text
        const { data: { text } } = await worker.recognize(blob);

        if (text.trim().length > 0) {
            fullText += `--- Page ${pageNum} (OCR) ---\n${text}\n\n`;
        }
    }

    await worker.terminate();
    return fullText;
};

/**
 * Main Extraction Function
 */
export const extractPDFContent = async (
    pdfBase64: string,
    onProgress?: (status: string, progress: number) => void
): Promise<string> => {
    try {
        onProgress?.("Loading Document...", 0.1);

        // Decode PDF
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        console.log(`OCR Service: Document loaded with ${pdf.numPages} pages.`);

        // Try Fast Native Extraction first
        const nativeText = await extractNativeText(pdf, 200);

        // Heuristic: If we extracted less than 200 characters from first 200 pages, it's likely scanned.
        if (nativeText.replace(/\s/g, '').length > 200) {
            console.log("OCR Service: Native text found. Skipping OCR.");
            onProgress?.("Processing Text...", 1.0);
            return nativeText;
        }

        // Fallback to OCR
        console.log("OCR Service: Minimal text found. Switching to OCR mode...");
        onProgress?.("Scanned Document Detected. Starting OCR...", 0.2);

        const ocrText = await performOCR(pdf, 50, onProgress);

        if (!ocrText || ocrText.trim().length < 20) {
            throw new Error("EMPTY_TEXT_AFTER_OCR");
        }

        onProgress?.("OCR Complete", 1.0);
        return ocrText;

    } catch (error) {
        console.error("OCR Workflow Failed:", error);
        if ((error as any).message === "EMPTY_TEXT_AFTER_OCR") {
            throw new Error("EMPTY_TEXT"); // Map back to App's expected error
        }
        throw error;
    }
};
