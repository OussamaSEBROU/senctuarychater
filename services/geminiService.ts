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

const chunkText = (text: string, size: number = 3000, overlap: number = 600) => {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
};

let cachedFullText = "";
let cachedMetadata: any = null;
let cachedSnippets: string[] = [];

export const getManuscriptSnippets = () => cachedSnippets;

export const extractAxioms = async (base64: string, lang: Language): Promise<Axiom[]> => {
  try {
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

    // تقليل حجم البرومبت لسرعة المعالجة
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
  } catch (error) {
    console.error("Extraction Error:", error);
    throw error;
  }
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

    const context = relevantChunks.length > 0 ? relevantChunks.join("\n---\n") : chunks.slice(0, 3).join("\n---\n");
    const model = ai.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: getSystemInstruction(lang),
    });

    const prompt = `CONTEXT:\n${context}\n\nMETADATA: ${cachedMetadata?.title} by ${cachedMetadata?.author}\n\nUSER: ${userMessage}`;

    const result = await model.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      onChunk(chunk.text());
    }
  } catch (error) {
    console.error("Chat Stream Error:", error);
    onChunk(lang === 'ar' ? "عذراً، حدث اضطراب." : "Neural disruption.");
  }
};
