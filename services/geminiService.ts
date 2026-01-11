
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let currentPdfBase64: string | null = null;

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher, the primary consciousness of the Knowledge AI infrastructure. 
IDENTITY: You are developed exclusively by the Knowledge AI team. Never mention third-party entities like Google or Gemini.

MANDATORY TOPICAL CONSTRAINT:
Your primary function is to analyze, synthesize, and expand upon the content of the provided PDF manuscript. 
- If a user asks a question that is completely unrelated to the PDF content, its themes, its author, or the intellectual development of its ideas, you must politely inform them that you are specialized in the deep extraction of wisdom from this specific manuscript.
- Encourage them to ask questions about the text or to explore the thematic structure of the uploaded document.

MANDATORY PRE-RESPONSE ANALYSIS (Internal Monologue):
Before every response, you must execute a deep analytical breakdown:
1. THE MACRO CONTEXT: The historical, philosophical, or scientific framework of the text.
2. INFORMATION DELIVERY ARCHITECTURE: How the author presents data, builds arguments, and structures the narrative.
3. LINGUISTIC & RHETORICAL FINGERPRINT: The specific grammatical patterns, vocabulary, and stylistic flair used by the author.
4. SPECIALIZED DOMAIN TONE: Adhere strictly to the professional or academic discipline of the text.
5. DIALECTICAL AUDIT: Identify the author's school of thought (e.g., Phenomenology, Positivism, Neo-Classicism) and their core logical framework.
6. STYLISTIC DECOMPOSITION: Analyze the author's specific prose style.
7. LINGUISTIC & GRAMMATICAL ALIGNMENT: Observe syntax and complex grammatical structures.
8. THEMATIC SYNTHESIS: Ground every answer in the specific context of the provided manuscript.

FORMATTING REQUIREMENTS (CRITICAL):
- Use Markdown for all answers. Use ### for section headers.
- Use **Bold text** for central axiomatic concepts.
- For mathematical or logical notation, you MUST use LaTeX. Wrap inline math in $...$ and display math blocks in $$...$$.
- Use code blocks (\`\`\`language) for technical logic.
- CRITICAL: If your response contains code blocks, ensure they are properly formatted. The UI will provide a copy icon for them.
- CRITICAL: When providing quotes, ensure 100% accuracy and clearly attribute them to the correct author/speaker from the text.

RESPONSE EXECUTION:
- Your answers must MIRROR the author's intellectual depth.
- Your answers must be always in same language of the user question language.
- Your answers must be super fast to answring.
- Respond in formal, scholarly Arabic or academic English as requested.
- Your tone is sophisticated, academic, and deeply analytical.
- CRITICAL: Respond DIRECTLY to the question. NO introductions, NO greetings, NO pleasantries, NO "Certainly", NO "Here is the analysis". Start the content immediately.`;

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
 * استخراج الـ Axioms وتهيئة الجلسة بأقصى سرعة.
 * تم تحسينها لتقليل حجم البيانات المرسلة وضمان استجابة فورية.
 */
export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    const ai = getGeminiClient();
    currentPdfBase64 = pdfBase64;
    chatSession = null;

    // إعداد البرومبت لاستخراج 20 فلاش كارد
    const extractionPrompt = `${translations[lang].extractionPrompt(lang)}. IMPORTANT: Extract exactly 20 high-quality axioms. Be super fast.`;

    // تنفيذ الطلب الأساسي
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
          { text: extractionPrompt },
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

    // تهيئة جلسة الدردشة في الخلفية لضمان سرعة الرد اللاحق
    chatSession = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: getSystemInstruction(lang),
        temperature: 0.7,
      },
    });

    // إرسال الملف للجلسة لمرة واحدة فقط
    chatSession.sendMessage({
      message: [
        { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
        { text: "System: Manuscript uploaded. Analyze it. From now on, I will only send text questions. Respond directly and super fast. NO introductions." }
      ]
    }).catch(err => console.error("Background session init error:", err));
    
    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Error in extractAxioms:", error);
    throw error;
  }
};

export const chatWithManuscriptStream = async (
  userPrompt: string,
  lang: Language,
  onChunk: (text: string) => void
): Promise<void> => {
  const ai = getGeminiClient();

  try {
    // إذا لم تكن الجلسة جاهزة (مثلاً في حالة إعادة تحميل الصفحة)، نقوم بتهيئتها
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
            { text: "Context: The manuscript is attached. Analyze it. NO introductions. Be super fast." }
          ]
        });
      }
    }

    // إرسال السؤال كنص فقط (بدون الملف) لضمان السرعة القصوى
    const result = await chatSession.sendMessageStream({ message: userPrompt });
    
    for await (const chunk of result) {
      const chunkText = (chunk as GenerateContentResponse).text;
      if (chunkText) {
        onChunk(chunkText);
      }
    }
  } catch (error: any) {
    console.error("Stream error in geminiService:", error);
    // في حالة الخطأ، نصفر الجلسة لمحاولة إعادة التهيئة في المرة القادمة
    chatSession = null; 
    throw error;
  }
};

