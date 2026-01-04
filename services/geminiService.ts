import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let extractedText: string | null = null;

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher with a focus on deep semantic analysis. 
Your response style is engaging, structured, and narrative-driven. 

CRITICAL PROTOCOLS:
1. You are analyzing a manuscript text that has been pre-extracted. Every answer must derive from this text's core logic or historical context.
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

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    const ai = getGeminiClient();
    chatSession = null;
    extractedText = null;

    // Step 1: Extract text from PDF
    const extractionResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
          { text: "Extract ALL text content from this PDF document. Return ONLY the extracted text, nothing else." },
        ],
      },
    });

    if (!extractionResponse.text) {
      throw new Error("FAILED_TEXT_EXTRACTION");
    }

    extractedText = extractionResponse.text;

    // Step 2: Generate axioms from extracted text
    const axiomsResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { text: `Manuscript Text:\n\n${extractedText}\n\n${translations[lang].extractionPrompt(lang)}` },
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

    if (!axiomsResponse.text) {
      throw new Error("EMPTY_RESPONSE");
    }

    return JSON.parse(axiomsResponse.text);
  } catch (error: any) {
    console.error("Error in extractAxioms:", error);
    extractedText = null;
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
    if (!extractedText) {
      throw new Error("NO_EXTRACTED_TEXT");
    }

    if (!chatSession) {
      chatSession = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: getSystemInstruction(lang),
          temperature: 0.7,
        },
      });

      // Send extracted text once as context
      await chatSession.sendMessage({
        message: `Here is the complete manuscript text for our discussion:\n\n${extractedText}\n\nI'm ready for your questions about this text.`
      });
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
