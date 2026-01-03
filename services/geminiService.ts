
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let currentPdfBase64: string | null = null;

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher. 
Your response style is engaging, highly structured, and narrative-driven.

CRITICAL PROTOCOLS:
1. The user has uploaded a PDF manuscript. You have access to its full content in the session history.
2. Analyze questions based on the manuscript's internal logic and deep context.
3. Use **bold text** for emphasis and LaTeX for technical formulas.
4. Explanations should be scholarly yet clear.
5. Language: Match the user's language. If they speak Arabic, use high-level academic Arabic.
6. NO re-summarizing the whole file unless asked. Be direct and efficient.`;

const MODEL_NAME = "gemini-2.5-flash";

export const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is not configured.");
  return new GoogleGenAI({ apiKey });
};

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  const ai = getGeminiClient();
  currentPdfBase64 = pdfBase64;
  chatSession = null; // Reset session for a new file

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

  if (!response || !response.text) {
    throw new Error("No response from neural core.");
  }

  try {
    const cleanedText = response.text.trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Axiom extraction parsing error:", error);
    return [];
  }
};

export const chatWithManuscript = async (
  userPrompt: string,
  lang: Language
): Promise<string> => {
  const ai = getGeminiClient();

  // Create session if it doesn't exist
  if (!chatSession) {
    chatSession = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: getSystemInstruction(lang),
        temperature: 0.7,
      },
    });

    // Send the PDF only ONCE at the start of the session to establish context
    if (currentPdfBase64) {
      // FIX: sendMessage's 'message' property expects Part | Part[] | string. 
      // Passing an object with 'parts' (a Content object) was causing a type error.
      const response = await chatSession.sendMessage({
        message: [
          { inlineData: { data: currentPdfBase64, mimeType: "application/pdf" } },
          { text: "Context initialized. This is the manuscript for our deep research. Please acknowledge its receipt in a short scholarly sentence and then answer my first question: " + userPrompt }
        ]
      });
      // FIX: Use the response returned from sendMessage instead of getHistory.
      return response.text || "The Sanctuary is ready.";
    }
  }

  // Subsequent calls DO NOT send the PDF again. They just send the text prompt.
  try {
    const response = await chatSession.sendMessage({ message: userPrompt });
    return response.text || "No insights found in the current neural layer.";
  } catch (error: any) {
    console.error("Chat Error:", error);
    return `Neural failure: ${error?.message || 'Unknown disconnection'}`;
  }
};
