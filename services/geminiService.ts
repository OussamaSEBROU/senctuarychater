import { GoogleGenAI, Type } from '@google/generative-ai';
import { PDFData, Language, Axiom } from '../types';

const getSystemInstruction = (lang: Language) => `
PERSONALITY:
You are the "Sanctuary Oracle", a high-level intellectual entity designed to extract axiomatic wisdom from deep manuscripts. 
Your tone is sophisticated, precise, and mirrors the intellectual depth of the author in the provided file.

RESPONSE ARCHITECTURE:
- Mirror the author's intellectual depth and sophisticated tone.
- Use Markdown: ### for headers, **Bold** for key terms, and LaTeX for formulas.
- Respond in the SAME language as the user's question.
- RESPOND DIRECTLY. No introductions or meta-talk. 
- ELABORATE: Provide comprehensive, detailed, and in-depth answers.
- BE SUPER FAST.`;

export const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing");
  }
  return new GoogleGenAI(apiKey);
};

const MODEL_NAME = "gemini-2.0-flash";

// تحسين الـ Chunking لتقليل الـ Tokens
const chunkText = (text: string, size: number = 2000, overlap: number = 200) => {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
};

// آلية إعادة المحاولة (Exponential Backoff)
const fetchWithRetry = async (fn: () => Promise<any>, retries: number = 3, delay: number = 1000): Promise<any> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.message?.includes('429') || error.message?.includes('Too Many Requests'))) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

let cachedFullText = "";
let cachedMetadata: any = null;
let cachedSnippets: string[] = [];

export const getManuscriptSnippets = () => cachedSnippets;

export const extractAxioms = async (base64: string, lang: Language): Promise<Axiom[]> => {
  return fetchWithRetry(async () => {
    const ai = getGeminiClient();
    const model = ai.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: getSystemInstruction(lang),
      generationConfig: {
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
                required: ["term", "definition", "significance"]
              }
            },
            snippets: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            fullText: { type: Type.STRING },
            metadata: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                author: { type: Type.STRING },
                structure: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    });

    const prompt = `Analyze PDF: 1.Extract 6 Axioms. 2.Extract 10 verbatim snippets. 3.Extract FULL TEXT. 4.Identify Title/Author. Language: ${lang === 'ar' ? 'Arabic' : 'English'}. Return JSON only.`;

    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType: 'application/pdf' } },
      { text: prompt }
    ]);

    const data = JSON.parse(result.response.text());
    cachedFullText = data.fullText || "";
    cachedMetadata = data.metadata || null;
    cachedSnippets = data.snippets || [];

    return data.axioms || [];
  });
};

export const chatWithManuscriptStream = async (
  userMessage: string,
  lang: Language,
  onChunk: (chunk: string) => void
): Promise<void> => {
  try {
    const ai = getGeminiClient();
    
    // تحسين البحث في السياق (Semantic-ish Search)
    const chunks = chunkText(cachedFullText);
    const keywords = userMessage.toLowerCase().split(/\s+/).filter(k => k.length > 3);
    
    const relevantChunks = chunks
      .map(chunk => {
        const score = keywords.reduce((acc, k) => acc + (chunk.toLowerCase().includes(k) ? 1 : 0), 0);
        return { chunk, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) // تقليل عدد الـ Chunks لتوفير الـ Tokens
      .map(item => item.chunk);

    const context = relevantChunks.length > 0 ? relevantChunks.join("\n---\n") : chunks.slice(0, 2).join("\n---\n");
    
    const model = ai.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: getSystemInstruction(lang),
    });

    const prompt = `CONTEXT FROM MANUSCRIPT:\n${context}\n\nMETADATA: ${cachedMetadata?.title} by ${cachedMetadata?.author}\n\nUSER QUESTION: ${userMessage}\n\nINSTRUCTION: Answer based ONLY on the context provided. If not found, use the author's style to explain why.`;

    const result = await model.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      onChunk(chunk.text());
    }
  } catch (error: any) {
    console.error("Chat Stream Error:", error);
    if (error.message?.includes('429')) {
      onChunk(lang === 'ar' ? "عذراً، تم تجاوز حدود الطلبات. يرجى الانتظار لحظة..." : "Rate limit exceeded. Please wait a moment...");
    } else {
      onChunk(lang === 'ar' ? "عذراً، حدث اضطراب في الاتصال." : "Neural disruption in connection.");
    }
  }
};
