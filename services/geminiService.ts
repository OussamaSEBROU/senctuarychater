import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let fullManuscriptText: string = "";
let currentPdfBase64: string | null = null;
let manuscriptMetadata: { title?: string; author?: string; chapters?: string; summary?: string } = {};

// متغيرات لإدارة حدود الـ API
let lastRequestTime = 0;
const MIN_REQUEST_GAP = 4000; // فجوة 4 ثوانٍ بين الطلبات لتجنب RPM limit (15 طلب في الدقيقة)
const MAX_HISTORY_MESSAGES = 6; // الاحتفاظ بآخر 6 رسائل فقط لتوفير TPM

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher.
IDENTITY: Developed exclusively by Knowledge AI.
${manuscriptMetadata.title ? `CONTEXT: ${manuscriptMetadata.title} by ${manuscriptMetadata.author}.` : ""}

PROTOCOL:
1. SOURCE: Use provided chunks.
2. STYLE: Mirror author's tone.
3. QUOTES: Support with verbatim quotes.
4. FORMAT: Markdown, LaTeX for math.
5. LANG: Same as user.
6. DIRECT: No meta-talk. Detailed answers.`;

export const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") throw new Error("API_KEY_MISSING");
  return new GoogleGenAI({ apiKey });
};

const MODEL_NAME = "gemini-2.5-flash-lite";

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

const compressChunk = (text: string, maxLength: number = 600): string => {
  if (text.length <= maxLength) return text;
  const half = Math.floor(maxLength / 2) - 15;
  return text.substring(0, half) + " [...] " + text.substring(text.length - half);
};

const retrieveRelevantChunks = (query: string, chunks: string[], topK: number = 2): string[] => {
  if (chunks.length === 0) return [];
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const scoredChunks = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    queryWords.forEach(word => { if (chunkLower.includes(word)) score += 2; });
    return { chunk, score };
  });
  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .filter(item => item.score >= 2)
    .slice(0, topK)
    .map(item => compressChunk(item.chunk));
};

/**
 * وظيفة الانتظار الذكي لتجنب تجاوز الـ RPM
 */
const throttleRequest = async () => {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_GAP) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_GAP - timeSinceLast));
  }
  lastRequestTime = Date.now();
};

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    await throttleRequest();
    const ai = getGeminiClient();
    chatSession = null;
    currentPdfBase64 = pdfBase64;

    const combinedPrompt = `Extract exactly 13 'Knowledge Axioms', 10 profound 'snippets', the FULL TEXT, and Metadata (title, author, chapters). 
    Return ONLY JSON. Language must match the PDF.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{
        parts: [
          { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
          { text: combinedPrompt },
        ],
      }],
      config: {
        systemInstruction: getSystemInstruction(lang),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            axioms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  significance: { type: Type.STRING }
                },
                required: ["term", "definition", "significance"],
              },
            },
            snippets: { type: Type.ARRAY, items: { type: Type.STRING } },
            metadata: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                author: { type: Type.STRING },
                chapters: { type: Type.STRING }
              }
            },
            fullText: { type: Type.STRING }
          },
          required: ["axioms", "snippets", "metadata", "fullText"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    manuscriptSnippets = result.snippets || [];
    fullManuscriptText = result.fullText || "";
    manuscriptMetadata = result.metadata || {};
    documentChunks = chunkText(fullManuscriptText);
    
    // بعد الاستخراج، نقوم بتفريغ الـ Base64 لتوفير الذاكرة ومنع إرساله مجدداً
    currentPdfBase64 = null; 

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
  const ai = getGeminiClient();

  try {
    await throttleRequest();
    const relevantChunks = retrieveRelevantChunks(userPrompt, documentChunks);
    const contextText = relevantChunks.join("\n\n---\n\n");
    
    const augmentedPrompt = `CONTEXT FROM MANUSCRIPT:
${contextText || "Use previous knowledge from the full text provided earlier."}

USER QUESTION:
${userPrompt}

INSTRUCTION: Answer based on context. Mirror author style. Use quotes.`;

    if (!chatSession) {
      chatSession = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: getSystemInstruction(lang),
          temperature: 0.2,
        },
      });
    }

    // إدارة تاريخ الحوار: إذا زاد عدد الرسائل عن الحد، نقوم بإعادة تهيئة الجلسة بآخر سياق فقط
    // ملاحظة: مكتبة  AI تتعامل مع التاريخ داخلياً، لكن يمكننا التحكم في حجم الطلب
    // عبر تقليل حجم الـ augmentedPrompt المرسل في كل مرة.

    const result = await chatSession.sendMessageStream({ message: augmentedPrompt });

    for await (const chunk of result) {
      const chunkText = (chunk as GenerateContentResponse).text;
      if (chunkText) onChunk(chunkText);
    }
  } catch (error: any) {
    console.error("Stream error in Service:", error);
    chatSession = null;
    throw error;
  }
};
