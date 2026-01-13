import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let fullManuscriptText: string = "";
let currentPdfBase64: string | null = null;

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher.
IDENTITY: Developed exclusively by the Knowledge AI team.
MANDATORY: 
1. Adopt the author's linguistic style and intellectual depth.
2. Use direct quotes from the manuscript for every answer.
3. Respond in the user's language.
4. BE SUPER FAST. No introductions.`;

export const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") throw new Error("API_KEY_MISSING");
  return new GoogleGenAI({ apiKey });
};

const MODEL_NAME = "gemini-2.5-flash";

const chunkText = (text: string, chunkSize: number = 3000, overlap: number = 600): string[] => {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    if (end === text.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
};

const retrieveRelevantChunks = (query: string, chunks: string[], topK: number = 3): string[] => {
  if (chunks.length === 0) return [];
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const scoredChunks = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    queryWords.forEach(word => { if (chunkLower.includes(word)) score += 1; });
    return { chunk, score };
  });
  return scoredChunks.sort((a, b) => b.score - a.score).filter(i => i.score > 0).slice(0, topK).map(i => i.chunk);
};

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    const ai = getGeminiClient();
    currentPdfBase64 = pdfBase64;
    chatSession = null;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
          { text: `${translations[lang].extractionPrompt(lang)}. Extract 13 axioms and 10 verbatim snippets from the text. Return JSON.` },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            axioms: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { term: { type: Type.STRING }, definition: { type: Type.STRING }, significance: { type: Type.STRING } }, required: ["term", "definition", "significance"] } },
            snippets: { type: Type.ARRAY, items: { type: Type.STRING } },
            fullText: { type: Type.STRING }
          },
          required: ["axioms", "snippets", "fullText"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    manuscriptSnippets = result.snippets || [];
    fullManuscriptText = result.fullText || "";
    documentChunks = chunkText(fullManuscriptText);
    
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
    const relevantChunks = retrieveRelevantChunks(userPrompt, documentChunks);
    const context = relevantChunks.length > 0 ? relevantChunks.join("\n\n") : "";
    
    const prompt = `CONTEXT: ${context}\n\nUSER: ${userPrompt}\n\nINSTRUCTION: Answer using the author's style and direct quotes.`;

    if (!chatSession) {
      chatSession = ai.chats.create({
        model: MODEL_NAME,
        config: { systemInstruction: getSystemInstruction(lang), temperature: 0.2 },
      });
    }

    const result = await chatSession.sendMessageStream({ message: prompt });
    for await (const chunk of result) {
      const chunkText = (chunk as GenerateContentResponse).text;
      if (chunkText) onChunk(chunkText);
    }
  } catch (error: any) {
    console.error("Stream error:", error);
    chatSession = null;
    throw error;
  }
};
