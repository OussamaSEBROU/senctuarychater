
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let currentPdfBase64: string | null = null;

const MODEL_NAME = "gemini-2.5-flash";

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher in a neural sanctuary.
Your style is profound, academic, and structured.

PROTOCOLS:
1. You analyze manuscripts with deep axiomatic rigor.
2. Use **bold text** for key concepts and LaTeX for any formulas.
3. Match the user's language (Academic Arabic for Arabic users).
4. Do not repeat the manuscript content; synthesize its essence.
5. The manuscript is provided once at the start of the session.`;

export const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing.");
  return new GoogleGenAI({ apiKey });
};

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  const ai = getGeminiClient();
  currentPdfBase64 = pdfBase64;
  chatSession = null; // Clear previous session for new file context

  try {
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
              term: { type: Type.STRING, description: "The profound term" },
              definition: { type: Type.STRING, description: "Scholarly definition" },
              significance: { type: Type.STRING, description: "Overarching significance" }
            },
            required: ["term", "definition", "significance"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    const parsed = JSON.parse(text.trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Critical Extraction Error:", error);
    throw error;
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
        temperature: 0.7,
      },
    });

    if (currentPdfBase64) {
      const initialResponse = await chatSession.sendMessage({
        message: [
          { inlineData: { data: currentPdfBase64, mimeType: "application/pdf" } },
          { text: `The manuscript is uploaded. Using its full context, answer this first inquiry: ${userPrompt}` }
        ]
      });
      return initialResponse.text || "Connection established.";
    }
  }

  try {
    const response = await chatSession.sendMessage({ message: userPrompt });
    return response.text || "No insights extracted.";
  } catch (error: any) {
    console.error("Chat failure:", error);
    return `Neural failure: ${error.message || 'Unknown'}`;
  }
};
