
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Axiom, Message, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let currentPdfBase64: string | null = null;

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher. Before answering any query about the uploaded PDF, you must:
1. Analyze the author's philosophical/scientific school of thought.
2. Determine the book's specific context (Historical, Technical, or Literary).
3. Synthesize answers that align with the author's depth, maintaining a high cultural and intellectual tone.

FORMATTING REQUIREMENTS (CRITICAL):
- If the response is in Arabic, use RTL (Right-to-Left) alignment.
- Use **bold text** for important definitions.
- Use professional LaTeX for formulas (wrap in $ for inline or $$ for block).
- ALWAYS respond in the language of the user's prompt (usually Arabic if they ask in Arabic).

Your tone is sophisticated and academic.`;

export const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is not configured.");
  return new GoogleGenAI({ apiKey });
};

const MODEL_NAME = "gemini-2.5-flash";

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  const ai = getGeminiClient();
  currentPdfBase64 = pdfBase64;
  
  // تصفير الجلسة السابقة عند رفع ملف جديد
  chatSession = null;

  // Use the correct format for contents with multiple parts as defined in @google/genai.
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
            recipeName: { // Note: The schema properties here should match the return type Axiom
              type: Type.STRING,
            },
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
    // إنشاء الجلسة لأول مرة مع الملف
    chatSession = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: getSystemInstruction(lang),
        temperature: 0.7,
      },
    });

    // إرسال الملف في أول رسالة مخفية لتثبيت السياق
    // Fix: chat.sendMessage 'message' parameter expects Part | Part[] | string. 
    // It does not accept a Content object with a 'parts' property directly.
    if (currentPdfBase64) {
      await chatSession.sendMessage({
        message: [
          { inlineData: { data: currentPdfBase64, mimeType: "application/pdf" } },
          { text: "Please analyze this document. I will now start asking questions about it." }
        ]
      });
    }
  }

  // إرسال سؤال المستخدم (بدون الملف، لأنه مخزن في الجلسة)
  const response = await chatSession.sendMessage({ message: userPrompt });
  return response.text || "No response generated.";
};
