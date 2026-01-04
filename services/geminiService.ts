
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
  if (!apiKey || apiKey === "undefined") {
    console.error("Critical: API_KEY is missing in the environment.");
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

const MODEL_NAME = "gemini-2.5-flash";

/**
 * استخراج الـ Axioms وتهيئة الجلسة بشكل متوازٍ (Parallel) لتحقيق أقصى سرعة.
 */
export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    const ai = getGeminiClient();
    currentPdfBase64 = pdfBase64;
    chatSession = null;

    // تشغيل العمليتين في نفس الوقت لتقليل وقت الانتظار للنصف
    const [extractionResponse, sessionInit] = await Promise.all([
      // العملية 1: استخراج الـ Axioms
      ai.models.generateContent({
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
      }),
      
      // العملية 2: تهيئة جلسة الدردشة بالملف
      (async () => {
        const session = ai.chats.create({
          model: MODEL_NAME,
          config: {
            systemInstruction: getSystemInstruction(lang),
            temperature: 0.7,
          },
        });
        await session.sendMessage({
          message: [
            { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
            { text: "System: Manuscript uploaded. Analyze and wait for user questions." }
          ]
        });
        return session;
      })()
    ]);

    if (!extractionResponse.text) {
      throw new Error("EMPTY_RESPONSE");
    }

    // حفظ الجلسة الجاهزة
    chatSession = sessionInit;
    
    return JSON.parse(extractionResponse.text);
  } catch (error: any) {
    console.error("Error in extractAxioms:", error);
    throw error;
  }
};

/**
 * الدردشة تعتمد على الجلسة التي تم تجهيزها مسبقاً في مرحلة الرفع.
 */
export const chatWithManuscriptStream = async (
  userPrompt: string,
  lang: Language,
  onChunk: (text: string) => void
): Promise<void> => {
  const ai = getGeminiClient();

  try {
    // إعادة التهيئة فقط في حال فقدان الجلسة
    if (!chatSession) {
      chatSession = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: getSystemInstruction(lang),
          temperature: 0.7,
        },
      });

      if (currentPdfBase64) {
        await chatSession.sendMessage({
          message: [
            { inlineData: { data: currentPdfBase64, mimeType: "application/pdf" } },
            { text: "Context: The manuscript is attached. Analyze it and be ready for my questions." }
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
  } catch (error: any) {
    console.error("Stream error in geminiService:", error);
    chatSession = null; 
    throw error;
  }
};

