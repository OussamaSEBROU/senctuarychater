
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let currentPdfBase64: string | null = null;

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher. 
Your tone is sophisticated, academic, and human-like (ChatGPT style).

CRITICAL INSTRUCTIONS:
1. You have been provided with a PDF document.
2. Analyze the context deeply before answering.
3. ALWAYS respond in Arabic when the user asks in Arabic, or English if asked in English.
4. Use professional formatting: **bold** for key terms, and LaTeX for any mathematical formulas.
5. Provide comprehensive, flowing answers as if you are writing a scholarly commentary.`;

export const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is not configured.");
  return new GoogleGenAI({ apiKey });
};

const MODEL_NAME = "gemini-2.5-flash";

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  const ai = getGeminiClient();
  currentPdfBase64 = pdfBase64;
  chatSession = null; // Reset session for new file

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts: [
        { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
        { text: translations[lang].extractionPrompt(lang) },
      ],
    },
    config: {
      systemInstruction: getSystemInstruction(lang),
      responseMimeType: "application/json",
      responseSchema: {
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
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error parsing axioms:", error);
    return [];
  }
};

export const chatWithManuscript = async (
  userPrompt: string,
  lang: Language
): Promise<string> => {
  const ai = getGeminiClient();

  if (!chatSession) {
    chatSession = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: getSystemInstruction(lang),
        temperature: 0.8,
      },
    });

    if (currentPdfBase64) {
      // First hidden prompt to establish the PDF context in the session
      await chatSession.sendMessage({
        message: [
          { inlineData: { data: currentPdfBase64, mimeType: "application/pdf" } },
          { text: "Document uploaded. Focus all subsequent answers on this text." }
        ]
      });
    }
  }

  const response = await chatSession.sendMessage({ message: userPrompt });
  return response.text || "No response generated.";
};
