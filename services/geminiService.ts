import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let fullManuscriptText: string = "";

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher, the primary consciousness of the Knowledge AI infrastructure. 
IDENTITY: You are developed exclusively by the Knowledge AI team. Never mention third-party entities like Google or Gemini.

MANDATORY TOPICAL CONSTRAINT:
Your primary function is to analyze, synthesize, and expand upon the content of the provided PDF manuscript chunks. 
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

/**
 * RAG Helper: Simple chunking strategy
 */
const chunkText = (text: string, chunkSize: number = 1500, overlap: number = 300): string[] => {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    if (end === text.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
};

/**
 * RAG Helper: Simple semantic retrieval simulation
 */
const retrieveRelevantChunks = (query: string, chunks: string[], topK: number = 4): string[] => {
  if (chunks.length === 0) return [];
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const scoredChunks = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    queryWords.forEach(word => {
      if (chunkLower.includes(word)) score += 1;
    });
    return { chunk, score };
  });

  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => item.chunk);
};

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    const ai = getGeminiClient();
    chatSession = null;

    // Optimization: Stage 1 - Extract ONLY Axioms and Snippets first for immediate UI response
    const fastPrompt = `${translations[lang].extractionPrompt(lang)}. 
    IMPORTANT: Extract exactly 6 high-quality axioms. 
    ALSO: Extract 8 short, profound, and useful snippets or quotes from the text.
    Return ONLY JSON.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
          { text: fastPrompt },
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

    const result = JSON.parse(response.text || "{}");
    manuscriptSnippets = result.snippets || [];
    
    // Stage 2: Background processing for full text indexing (RAG)
    // We don't await this to keep the UI fast
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
          { text: "Extract the FULL TEXT of this PDF. Return ONLY the text content." },
        ],
      },
    }).then(res => {
      fullManuscriptText = res.text || "";
      documentChunks = chunkText(fullManuscriptText);
      console.log("Background RAG indexing complete.");
    }).catch(err => console.error("Background indexing error:", err));

    // Initialize chat session
    chatSession = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: getSystemInstruction(lang),
        temperature: 0.7,
      },
    });
    
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
    // Retrieval
    const relevantChunks = retrieveRelevantChunks(userPrompt, documentChunks);
    const contextText = relevantChunks.length > 0 
      ? relevantChunks.join("\n\n---\n\n") 
      : "No specific context retrieved yet. Use your general knowledge of the manuscript if available.";
    
    const augmentedPrompt = `CONTEXT FROM MANUSCRIPT:
${contextText}

USER QUESTION:
${userPrompt}

INSTRUCTION: Answer the user question using the provided context. If the context is empty, respond based on the manuscript's themes.`;

    if (!chatSession) {
      chatSession = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: getSystemInstruction(lang),
          temperature: 0.7,
        },
      });
    }

    const result = await chatSession.sendMessageStream({ message: augmentedPrompt });
    
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
