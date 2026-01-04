
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
 * يتم استدعاء هذه الدالة عند رفع الملف.
 * تقوم باستخراج الـ Axioms وفي نفس الوقت تهيئة جلسة الدردشة بالملف.
 */
export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    const ai = getGeminiClient();
    
    // حفظ الملف وتصفير الجلسة القديمة
    currentPdfBase64 = pdfBase64;
    chatSession = null;

    // 1. استخراج الـ Axioms (المعالجة الأساسية)
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

    if (!response.text) {
      throw new Error("EMPTY_RESPONSE");
    }

    // 2. تهيئة جلسة الدردشة فوراً بالملف ليكون جاهزاً للأسئلة اللاحقة
    // نستخدم sendMessage لتعريف الملف في سياق الجلسة
    chatSession = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: getSystemInstruction(lang),
        temperature: 0.7,
      },
    });

    // إرسال الملف كخلفية للجلسة (Background Context)
    // لا ننتظر الرد هنا لضمان سرعة واجهة المستخدم، أو يمكن انتظاره لضمان الجاهزية
    await chatSession.sendMessage([
      { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
      { text: "System: The user has uploaded this manuscript. Analyze it thoroughly. Do not respond to this message, just acknowledge internally and wait for user questions." }
    ]);
    
    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Error in extractAxioms:", error);
    throw error;
  }
};

/**
 * الدردشة الآن تعتمد كلياً على الجلسة المهيأة مسبقاً.
 * لا يتم إرسال الملف هنا نهائياً.
 */
export const chatWithManuscriptStream = async (
  userPrompt: string,
  lang: Language,
  onChunk: (text: string) => void
): Promise<void> => {
  const ai = getGeminiClient();

  try {
    // إذا لم تكن الجلسة موجودة (حالة نادرة)، نقوم بإنشائها
    if (!chatSession) {
      chatSession = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: getSystemInstruction(lang),
          temperature: 0.7,
        },
      });

      if (currentPdfBase64) {
        await chatSession.sendMessage([
          { inlineData: { data: currentPdfBase64, mimeType: "application/pdf" } },
          { text: "Context: The manuscript is attached. Analyze it and be ready for my questions." }
        ]);
      }
    }

    // إرسال السؤال فقط بدون الملف
    const result = await chatSession.sendMessageStream({ message: userPrompt });
    
    for await (const chunk of result) {
      const chunkText = (chunk as GenerateContentResponse).text;
      if (chunkText) {
        onChunk(chunkText);
      }
    }
  } catch (error: any) {
    console.error("Stream error in geminiService:", error);
    // في حال حدوث خطأ في الجلسة، نصفرها لإعادة التهيئة في المحاولة القادمة
    chatSession = null; 
    throw error;
  }
};
