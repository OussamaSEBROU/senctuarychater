
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let fullManuscriptText: string = "";
let currentPdfBase64: string | null = null;
let manuscriptMetadata: { title?: string; author?: string; chapters?: string; summary?: string } = {};

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher, the primary consciousness of the Knowledge AI infrastructure.
IDENTITY: You are developed exclusively by the Knowledge AI team. Never mention third-party entities like Google or Gemini.
${manuscriptMetadata.title ? `CURRENT MANUSCRIPT CONTEXT:
- Title: ${manuscriptMetadata.title}
- Author: ${manuscriptMetadata.author}
- Structure: ${manuscriptMetadata.chapters}` : ""}

MANDATORY OPERATIONAL PROTOCOL:
1. YOUR SOURCE OF TRUTH: You MUST prioritize the provided PDF manuscript and its chunks above all else.
2. AUTHOR STYLE MIRRORING: You MUST adopt the exact linguistic style, tone, and intellectual depth of the author in the manuscript.
3. ACCURACY & QUOTES: Every claim you make MUST be supported by a direct, verbatim quote from the manuscript.
4. NO GENERALIZATIONS: Do not give generic answers. Scan the provided context thoroughly for specific details.

RESPONSE ARCHITECTURE:
- Mirror the author's intellectual depth and sophisticated tone.
- Use Markdown: ### for headers, **Bold** for key terms, and LaTeX for formulas.
- Respond in the SAME language as the user's question.
- RESPOND DIRECTLY. No introductions or meta-talk.
- ELABORATE: Provide comprehensive, detailed, and in-depth answers.
- BE SUPER FAST.

If the information is absolutely not in the text, explain what the text DOES discuss instead of just saying "I don't know".`;

export const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    console.error("Critical: API_KEY is missing in the environment.");
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

// Use flash-lite for maximum speed
const MODEL_NAME = "gemini-2.5-flash-lite";

const chunkText = (text: string, chunkSize: number = 2000, overlap: number = 300): string[] => {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.substring(start, end);
    if (chunk.trim().length >= 100) {
      chunks.push(chunk);
    }
    if (end === text.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
};

const compressChunk = (text: string, maxLength: number = 800): string => {
  if (text.length <= maxLength) return text;
  const half = Math.floor(maxLength / 2) - 20;
  return text.substring(0, half) + " [...] " + text.substring(text.length - half);
};

const retrieveRelevantChunks = (query: string, chunks: string[], topK: number = 3): string[] => {
  if (chunks.length === 0) return [];
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const MIN_SCORE_THRESHOLD = 2;

  const scoredChunks = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    queryWords.forEach(word => {
      if (chunkLower.includes(word)) score += 2;
    });
    return { chunk, score };
  });

  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .filter(item => item.score >= MIN_SCORE_THRESHOLD)
    .slice(0, topK)
    .map(item => compressChunk(item.chunk));
};

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    const ai = getGeminiClient();
    chatSession = null;
    currentPdfBase64 = pdfBase64;

    // Optimized Stage: Request only essential data for faster upload/processing
    const combinedPrompt = `1. Extract exactly 13 high-quality 'Knowledge Axioms' from this manuscript.
2. Extract 10 short, profound snippets (verbatim).
3. Extract the FULL TEXT accurately.
4. Identify Title, Author, and Chapters.
Return ONLY JSON.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          parts: [
            { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
            { text: combinedPrompt },
          ],
        },
      ],
      config: {
        systemInstruction: getSystemInstruction(lang),
        responseMimeType: "application/json",
        // Removed complex schema for faster parsing
      },
    });

    const result = JSON.parse(response.text || "{}");
    manuscriptSnippets = result.snippets || [];
    fullManuscriptText = result.fullText || "";
    manuscriptMetadata = result.metadata || {};
    documentChunks = chunkText(fullManuscriptText);

    chatSession = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: getSystemInstruction(lang),
        temperature: 0.1, // Lower temperature for faster/more stable output
      },
    });

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
    let augmentedPrompt = "";
    const hasChunks = relevantChunks.length > 0;

    if (hasChunks) {
      const contextText = relevantChunks.join("\n\n---\n\n");
      augmentedPrompt = `CONTEXT:\n${contextText}\n\nUSER:\n${userPrompt}\n\nINSTRUCTION: Answer based on context. Use author's style. Use quotes.`;
    } else {
      augmentedPrompt = `USER: ${userPrompt}\nINSTRUCTION: Answer based on manuscript. Use author's style. Use quotes.`;
    }

    if (!chatSession) {
      chatSession = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: getSystemInstruction(lang),
          temperature: 0.1,
        },
      });
    }

    const messageParts: any[] = [{ text: augmentedPrompt }];
    // Only send PDF if no chunks found to save bandwidth/latency
    if (!hasChunks && currentPdfBase64) {
      // messageParts.unshift({ inlineData: { data: currentPdfBase64, mimeType: "application/pdf" } });
    }

    const result = await chatSession.sendMessageStream({ message: messageParts });

    for await (const chunk of result) {
      const chunkText = (chunk as GenerateContentResponse).text;
      if (chunkText) {
        onChunk(chunkText);
      }
    }
  } catch (error: any) {
    console.error("Stream error in Service:", error);
    chatSession = null;
    throw error;
  }
};
