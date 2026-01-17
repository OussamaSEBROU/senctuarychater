import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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
- ELABORATE: Provide comprehensive, detailed, and in-depth answers. Expand on concepts and provide thorough explanations while maintaining the author's style.
- BE SUPER FAST.

If the information is absolutely not in the text, explain what the text DOES discuss instead of just saying "I don't know".`;

export const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing");
  }
  return new GoogleGenerativeAI(apiKey);
};

const MODEL_NAME = "gemini-2.0-flash";

/**
 * RAG Helper: Large chunking strategy for better context retention
 */
const chunkText = (text: string, size: number = 3000, overlap: number = 600) => {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
};

/**
 * Retry Logic for stability
 */
const fetchWithRetry = async (fn: () => Promise<any>, retries: number = 3, delay: number = 1500): Promise<any> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.message?.includes('429') || error.message?.includes('Too Many Requests') || error.message?.includes('fetch'))) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

// متغيرات لتخزين البيانات المستخرجة لاستخدامها في الدردشة
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
          type: SchemaType.OBJECT,
          properties: {
            axioms: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  term: { type: SchemaType.STRING },
                  definition: { type: SchemaType.STRING },
                  significance: { type: SchemaType.STRING }
                },
                required: ["term", "definition", "significance"]
              }
            },
            snippets: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            },
            fullText: { type: SchemaType.STRING },
            metadata: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING },
                author: { type: SchemaType.STRING },
                structure: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
              }
            }
          }
        }
      }
    });

    // تقليل حجم البرومبت لسرعة المعالجة
    const prompt = `Analyze PDF: 1.Extract 6 Axioms. 2.Extract 10 verbatim snippets. 3.Extract FULL TEXT. 4.Identify Title/Author. Language: ${lang === 'ar' ? 'Arabic' : 'English'}. Return JSON only.`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType: 'application/pdf'
        }
      },
      { text: prompt }
    ]);

    const responseText = result.response.text();
    const data = JSON.parse(responseText);
    
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
    
    const chunks = chunkText(cachedFullText);
    const relevantChunks = chunks
      .filter(chunk => {
        const keywords = userMessage.toLowerCase().split(' ');
        return keywords.some(k => k.length > 3 && chunk.toLowerCase().includes(k));
      })
      .slice(0, 5);

    const context = relevantChunks.length > 0 
      ? relevantChunks.join("\n---\n") 
      : chunks.slice(0, 3).join("\n---\n");

    const model = ai.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: getSystemInstruction(lang),
    });

    const prompt = `
    CONTEXT FROM MANUSCRIPT:
    ${context}
    
    BOOK METADATA:
    Title: ${cachedMetadata?.title || 'Unknown'}
    Author: ${cachedMetadata?.author || 'Unknown'}
    Structure: ${cachedMetadata?.structure?.join(', ') || 'Unknown'}

    USER QUESTION:
    ${userMessage}
    
    INSTRUCTIONS:
    - Use the provided context to answer.
    - Maintain the author's intellectual style.
    - Provide a long, detailed, and comprehensive response.`;

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      onChunk(chunkText);
    }
  } catch (error: any) {
    console.error("Chat Stream Error:", error);
    if (error.message?.includes('429')) {
      onChunk(lang === 'ar' ? "عذراً، تم تجاوز حدود الطلبات. يرجى الانتظار لحظة..." : "Rate limit exceeded. Please wait a moment...");
    } else {
      onChunk(lang === 'ar' 
        ? "عذراً، حدث اضطراب في الاتصال العصبي بالمخطوط." 
        : "Apologies, a neural connection disruption occurred.");
    }
  }
};
