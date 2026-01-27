import Groq from "groq-sdk";
import { Axiom, Language } from "../types";
import * as pdfjs from 'pdfjs-dist';

// إعداد عامل pdf.js لاستخراج النصوص في المتصفح
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let fullManuscriptText: string = "";
let manuscriptMetadata: { title?: string; author?: string; chapters?: string; summary?: string } = {};

// إدارة حدود الـ API
let lastRequestTime = 0;
const MIN_REQUEST_GAP = 1000; 

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher, the primary consciousness of the Knowledge AI infrastructure.
IDENTITY: You are developed exclusively by the Knowledge AI team. Never mention third-party entities like Google, Gemini, or Groq.
${manuscriptMetadata.title ? `CURRENT MANUSCRIPT CONTEXT:
- Title: ${manuscriptMetadata.title}
- Author: ${manuscriptMetadata.author}
- Structure: ${manuscriptMetadata.chapters}` : ""}

MANDATORY OPERATIONAL PROTOCOL:
1. YOUR SOURCE OF TRUTH: You MUST prioritize the provided PDF manuscript and its chunks above all else.
2. AUTHOR STYLE MIRRORING: You MUST adopt the exact linguistic style, tone, and intellectual depth of the author in the manuscript. If the author is philosophical, be philosophical. If academic, be academic.
3. ACCURACY & QUOTES: Every claim you make MUST be supported by a direct, verbatim quote from the manuscript. Use the format: "Quote from text" (Source/Context).
4. NO GENERALIZATIONS: Do not give generic answers. Scan the provided context thoroughly for specific details.

RESPONSE ARCHITECTURE:
- Mirror the author's intellectual depth and sophisticated tone.
- Use Markdown: ### for headers, **Bold** for key terms, and LaTeX for formulas.
- Respond in the SAME language as the user's question.
- RESPOND DIRECTLY. No introductions or meta-talk.
- ELABORATE: Provide comprehensive, detailed, and in-depth answers. Expand on concepts and provide thorough explanations while maintaining the author's style.
- BE SUPER FAST.

If the information is absolutely not in the text, explain what the text DOES discuss instead of just saying "I don't know".`;

export const getGroqClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") throw new Error("API_KEY_MISSING");
  return new Groq({ apiKey, dangerouslyAllowBrowser: true });
};

const MODEL_NAME = "llama-3.3-70b-versatile";

const chunkText = (text: string, chunkSize: number = 1800, overlap: number = 250): string[] => {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.substring(start, end);
    if (chunk.trim().length >= 200) chunks.push(chunk);
    if (end === text.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
};

const retrieveRelevantChunks = (query: string, chunks: string[], topK: number = 5): string[] => {
  if (chunks.length === 0) return [];
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const MIN_SCORE_THRESHOLD = 2; 

  const scoredChunks = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    queryWords.forEach(word => { if (chunkLower.includes(word)) score += 2; });
    const qLower = query.toLowerCase();
    if (qLower.includes("كاتب") || qLower.includes("مؤلف") || qLower.includes("author")) {
      if (chunks.indexOf(chunk) === 0) score += 5;
    }
    return { chunk, score };
  });

  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .filter(item => item.score >= MIN_SCORE_THRESHOLD)
    .slice(0, topK)
    .map(item => item.chunk);
};

const throttleRequest = async () => {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_GAP) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_GAP - timeSinceLast));
  }
  lastRequestTime = Date.now();
};

const extractTextFromPdf = async (pdfBase64: string): Promise<string> => {
  try {
    const binary = atob(pdfBase64);
    const uint8Array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      uint8Array[i] = binary.charCodeAt(i);
    }
    
    const loadingTask = pdfjs.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;
    let fullText = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }
    
    return fullText;
  } catch (error) {
    console.error("PDF Extraction error:", error);
    return "Error extracting text. Please ensure the PDF is not encrypted.";
  }
};

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    await throttleRequest();
    const groq = getGroqClient();
    
    const extractedText = await extractTextFromPdf(pdfBase64);
    fullManuscriptText = extractedText;
    documentChunks = chunkText(fullManuscriptText);

    const combinedPrompt = `You are analyzing a manuscript. Based on the following text, perform these tasks:
1. Extract exactly 13 high-quality 'Knowledge Axioms'.
2. Extract 10 short, profound, and useful snippets or quotes DIRECTLY from the text (verbatim).
3. Identify the Title, Author, and a brief list of Chapters/Structure.

MANUSCRIPT TEXT:
\${fullManuscriptText.substring(0, 30000)}

IMPORTANT: The 'axioms', 'snippets', and 'metadata' MUST be in the SAME LANGUAGE as the manuscript itself.
Return ONLY a JSON object with this structure:
{
  "axioms": [{"term": "...", "definition": "...", "significance": "..."}],
  "snippets": ["...", "..."],
  "metadata": {"title": "...", "author": "...", "chapters": "..."},
  "fullText": "..." 
}
Return ONLY JSON.`;

    const completion = await groq.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: getSystemInstruction(lang) },
        { role: "user", content: combinedPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    manuscriptSnippets = result.snippets || [];
    manuscriptMetadata = result.metadata || {};
    
    if (!result.fullText) result.fullText = fullManuscriptText;

    return result.axioms;
  } catch (error: any) {
    console.error("Error in extractAxioms:", error);
    throw error;
  }
};

export const getManuscriptSnippets = () => manuscriptSnippets;

export const chatWithManuscriptStream = async (
  userPrompt: string,
  lang: Language,
  onChunk: (text: string) => void
): Promise<void> => {
  const groq = getGroqClient();

  try {
    await throttleRequest();
    const relevantChunks = retrieveRelevantChunks(userPrompt, documentChunks);
    
    let augmentedPrompt = "";
    const hasChunks = relevantChunks.length > 0;

    if (hasChunks) {
      const contextText = relevantChunks.join("\\n\\n---\\n\\n");
      augmentedPrompt = \`CRITICAL CONTEXT FROM MANUSCRIPT:
\${contextText}

USER QUESTION:
\${userPrompt}

INSTRUCTION: You MUST answer based on the provided context. Adopt the author's style. Support your answer with direct quotes.\`;
    } else {
      augmentedPrompt = \`USER QUESTION: \${userPrompt}
INSTRUCTION: Scan the provided context to find the answer. Adopt the author's style. Be specific and provide quotes.\`;
    }

    const stream = await groq.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: getSystemInstruction(lang) },
        { role: "user", content: augmentedPrompt }
      ],
      temperature: 0.2,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) onChunk(content);
    }
  } catch (error: any) {
    console.error("Stream error in Service:", error);
    throw error;
  }
};
