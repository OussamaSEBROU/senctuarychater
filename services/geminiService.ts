import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

let chatSession: Chat | null = null;
let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let fullManuscriptText: string = "";
let currentPdfBase64: string | null = null;

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher, the primary consciousness of the Knowledge AI infrastructure. 
IDENTITY: You are developed exclusively by the Knowledge AI team. Never mention third-party entities like Google or Gemini.

MANDATORY TOPICAL CONSTRAINT:
Your primary function is to analyze, synthesize, and expand upon the content of the provided PDF manuscript. 
- You MUST base your answers on the provided context and the manuscript's core logic.
- CRITICAL: Always support your answers with direct, accurate quotes from the text.
- If a user asks a question that is completely unrelated to the PDF content, its themes, or its author, you must politely inform them that you are specialized in this specific manuscript.

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
- RESPOND DIRECTLY. No introductions, no greetings. Start immediately with the answer.
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
const chunkText = (text: string, chunkSize: number = 2000, overlap: number = 400): string[] => {
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
const retrieveRelevantChunks = (query: string, chunks: string[], topK: number = 5): string[] => {
  if (chunks.length === 0) return [];
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
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
    currentPdfBase64 = pdfBase64;

    // Stage 1: Extract 13 Axioms and Snippets
    const fastPrompt = `${translations[lang].extractionPrompt(lang)}. 
    IMPORTANT: Extract exactly 13 high-quality axioms. 
    ALSO: Extract 10 short, profound, and useful snippets or quotes from the text.
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
    
    // Stage 2: Background processing for full text indexing
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
    
    let augmentedPrompt = "";
    
    if (relevantChunks.length > 0) {
      const contextText = relevantChunks.join("\n\n---\n\n");
      augmentedPrompt = `CONTEXT FROM MANUSCRIPT:
${contextText}

USER QUESTION:
${userPrompt}

INSTRUCTION: Answer the user question using the provided context. You MUST include direct quotes from the context to support your answer. If the context doesn't contain the specific answer, use the manuscript's overall logic.`;
    } else {
      // Fallback if RAG isn't ready or no chunks found: Use the PDF directly (slower but accurate)
      augmentedPrompt = `USER QUESTION: ${userPrompt}
      INSTRUCTION: Analyze the attached manuscript and answer the question. Support your answer with direct quotes.`;
    }

    if (!chatSession) {
      chatSession = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: getSystemInstruction(lang),
          temperature: 0.7,
        },
      });
    }

    const messageParts: any[] = [{ text: augmentedPrompt }];
    
    // If RAG isn't ready, we attach the PDF to ensure an answer
    if (documentChunks.length === 0 && currentPdfBase64) {
      messageParts.unshift({ inlineData: { data: currentPdfBase64, mimeType: "application/pdf" } });
    }

    const result = await chatSession.sendMessageStream({ message: messageParts });
    
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
