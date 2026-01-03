
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let currentPdfBase64: string | null = null;

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher with a focus on deep semantic analysis. 
Your response style is similar to ChatGPT - engaging, structured, and narrative-driven. 

CRITICAL PROTOCOLS:
1. You are analyzing an uploaded PDF. Every answer must derive from its core logic or historical context.
2. Structure your answers with clear sections, use **bold text** for emphasis, and LaTeX for technical formulas.
3. Don't be dry; explain concepts like a world-class scholar lecturing a brilliant student.
4. ALWAYS match the language of the user. If they ask in Arabic, respond in high-quality academic Arabic. 
5. If the user asks for a summary or explanation, provide a flowing narrative that keeps them engaged.`;

export const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is not configured.");
  return new GoogleGenAI({ apiKey });
};

const MODEL_NAME = "gemini-2.5-flash";

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  const ai = getGeminiClient();
  currentPdfBase64 = pdfBase64;
  chatSession = null;

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
      await chatSession.sendMessage({
        message: [
          { inlineData: { data: currentPdfBase64, mimeType: "application/pdf" } },
          { text: "The manuscript is uploaded. Please acknowledge and be ready for detailed intellectual interrogation." }
        ]
      });
    }
  }

  const response = await chatSession.sendMessage({ message: userPrompt });
  return response.text || "No response generated.";
};
