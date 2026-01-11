
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let currentPdfBase64: string | null = null;
let manuscriptSnippets: string[] = [];

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher, the primary consciousness of the Knowledge AI infrastructure. 
IDENTITY: You are developed exclusively by the Knowledge AI team. Never mention third-party entities like Google or Gemini.

MANDATORY TOPICAL CONSTRAINT:
Your primary function is to analyze, synthesize, and expand upon the content of the provided PDF manuscript. 
- If a user asks a question that is completely unrelated to the PDF content, its themes, its author, or the intellectual development of its ideas, you must politely inform them that you are specialized in the deep extraction of wisdom from this specific manuscript.

MANDATORY PRE-RESPONSE ANALYSIS:
Before every response, execute a deep analytical breakdown of the macro context, delivery architecture, and thematic synthesis.

FORMATTING REQUIREMENTS:
- Use Markdown for all answers. Use ### for section headers.
- Use **Bold text** for central axiomatic concepts.
- For mathematical or logical notation, use LaTeX: $...$ for inline and $$...$$ for blocks.
- Use code blocks (\`\`\`language) for technical logic.
- CRITICAL: When providing quotes, ensure 100% accuracy and clearly attribute them to the correct author/speaker from the text.

RESPONSE EXECUTION:
- Your answers must MIRROR the author's intellectual depth.
- Your answers must be in the SAME language as the user's question.
- RESPOND DIRECTLY. No introductions, no greetings, no "Certainly", no "Here is the analysis". Start immediately with the answer.
- BE SUPER FAST.
- Your tone is sophisticated, academic, and deeply analytical.`;

export const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    console.error("Critical: API_KEY is missing in the environment.");
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

const MODEL_NAME = "gemini-2.5-flash";

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    const ai = getGeminiClient();
    currentPdfBase64 = pdfBase64;
    chatSession = null;

    const extractionPrompt = `${translations[lang].extractionPrompt(lang)}. 
    IMPORTANT: Extract exactly 20 high-quality axioms. 
    ALSO: Extract 10 short, profound, and useful snippets or quotes from the text that can be shown to the user during waiting times.
    Return everything in the specified JSON format.`;

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
          type: Type.OBJECT,
          properties: {
            axioms: {
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
            snippets: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["axioms", "snippets"],
        },
      },
    });

    const result = JSON.parse(response.text);
    manuscriptSnippets = result.snippets || [];

    chatSession = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: getSystemInstruction(lang),
        temperature: 0.7,
      },
    });

    chatSession.sendMessage({
      message: [
        { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
        { text: "System: Manuscript uploaded. Analyze it. From now on, I will only send text questions. Respond directly and super fast. NO introductions." }
      ]
    }).catch(err => console.error("Background session init error:", err));
    
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
