import { GoogleGenAI, Type } from "@google/genai";
import { Axiom, Message, Language } from "../types";
import { translations } from "../translations";

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher. Before answering any query about the uploaded PDF, you must:
1. Analyze the author's philosophical/scientific school of thought.
2. Determine the book's specific context (Historical, Technical, or Literary).
3. Synthesize answers that align with the author's depth, maintaining a high cultural and intellectual tone.
4. Remember all previous interactions in the current session for a seamless deep dialogue.

FORMATTING REQUIREMENTS (CRITICAL):
- If the response is in Arabic, use RTL (Right-to-Left) alignment.
- Use **bold text** for important definitions, axiomatic insights, and critical conclusions in a different color-like emphasis.
- Use structured Markdown headers (### for sections) and bullet points.
- Use professional LaTeX for ALL mathematical, chemical, or physical formulas (wrap in $ for inline or $$ for block).
- Use code blocks (\`\`\`language) for technical segments with proper syntax highlighting.
- ALWAYS respond in the SAME LANGUAGE as the user's query.

Your tone is sophisticated, academic, and deeply analytical.`;

export const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is not configured.");
  return new GoogleGenAI({ apiKey });
};

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  const ai = getGeminiClient();
  // Using gemini-3-pro-preview as the task involves high-level intellectual analysis and extraction
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
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
    const text = response.text;
    return text ? JSON.parse(text) : [];
  } catch (error) {
    console.error("Error parsing axioms:", error);
    return [];
  }
};

export const chatWithManuscript = async (
  pdfBase64: string,
  history: Message[],
  userPrompt: string,
  lang: Language
): Promise<string> => {
  const ai = getGeminiClient();
  
  // // Fix: Explicitly type 'contents' as an array of objects with 'any[]' parts to allow pushing both text and inlineData parts, resolving the TS error on line 82
  const contents: { role: string; parts: any[] }[] = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  // Add the current prompt along with the PDF context to ensure the model has the document context
  contents.push({
    role: 'user',
    parts: [
      { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
      { text: userPrompt }
    ]
  });

  // Using gemini-3-pro-preview for complex reasoning and multimodal analysis of the document
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents,
    config: {
      systemInstruction: getSystemInstruction(lang),
    },
  });

  return response.text || "";
};