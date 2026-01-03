
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let currentPdfBase64: string | null = null;

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher with a focus on deep semantic analysis. 
Your response style is engaging, structured, and narrative-driven. 

CRITICAL PROTOCOLS:
1. You are analyzing an uploaded PDF. Every answer must derive from its core logic or historical context.
2. Structure your answers with clear sections, use **bold text** for emphasis, and LaTeX for technical formulas.
3. Don't be dry; explain concepts like a world-class scholar lecturing a brilliant student.
4. ALWAYS match the language of the user. If they ask in Arabic, respond in high-quality academic Arabic. 
5. Provide a flowing narrative that keeps the user engaged.`;

export const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is not configured.");
  return new GoogleGenAI({ apiKey });
};

// استخدام Gemini 3 Flash لسرعة استجابة فائقة وقدرة معالجة PDF متطورة
const MODEL_NAME ="gemini-2.5-flash";

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  const ai = getGeminiClient();
  currentPdfBase64 = pdfBase64;
  chatSession = null; // إعادة ضبط الجلسة عند رفع ملف جديد

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

export const chatWithManuscriptStream = async (
  userPrompt: string,
  lang: Language,
  onChunk: (text: string) => void
): Promise<void> => {
  const ai = getGeminiClient();

  try {
    if (!chatSession) {
      chatSession = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: getSystemInstruction(lang),
          temperature: 0.7,
        },
      });

      // إرسال الملف في أول رسالة لربط السياق
      if (currentPdfBase64) {
        await chatSession.sendMessage({
          message: [
            { inlineData: { data: currentPdfBase64, mimeType: "application/pdf" } },
            { text: "This is the manuscript we will discuss. Acknowledge its presence briefly then focus on my future queries." }
          ]
        });
      }
    }

    const result = await chatSession.sendMessageStream({ message: userPrompt });
    
    for await (const chunk of result) {
      const chunkText = (chunk as GenerateContentResponse).text;
      if (chunkText) {
        onChunk(chunkText);
      }
    }
  } catch (error) {
    chatSession = null; // تنظيف الجلسة في حال حدوث خطأ للسماح بإعادة المحاولة
    throw error;
  }
};
