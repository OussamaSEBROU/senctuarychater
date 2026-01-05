
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

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    const ai = getGeminiClient();
    currentPdfBase64 = pdfBase64;
    chatSession = null;

    const [extractionResponse, sessionInit] = await Promise.all([
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
            { text: "System: Manuscript uploaded. Analyze and wait for user questions. Remember: NO introductions in your future responses." }
          ]
        });
        return session;
      })()
    ]);

    if (!extractionResponse.text) {
      throw new Error("EMPTY_RESPONSE");
    }

    chatSession = sessionInit;
    return JSON.parse(extractionResponse.text);
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
            { text: "Context: The manuscript is attached. Analyze it and be ready for my questions. NO introductions." }
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
