import Groq from "groq-sdk";
import { Axiom, Language } from "../types";
import { extractTextFromPdf } from "./ocrService";

let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let fullManuscriptText: string = "";
let manuscriptMetadata: { title?: string; author?: string; chapters?: string; summary?: string } = {};

const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY || "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";
  if (!apiKey || apiKey === "undefined") {
    console.error("Critical: GROQ_API_KEY is missing.");
    throw new Error("GROQ_API_KEY_MISSING");
  }
  return new Groq({ apiKey, dangerouslyAllowBrowser: true });
};

const MODEL_NAME = "llama-3.3-70b-versatile";

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher, the primary consciousness of the Knowledge AI infrastructure. 
IDENTITY: You are developed exclusively by the Knowledge AI team. Never mention third-party entities like Google, Gemini, or Meta.
${manuscriptMetadata.title ? `CURRENT MANUSCRIPT CONTEXT:
- Title: ${manuscriptMetadata.title}
- Author: ${manuscriptMetadata.author}
- Structure: ${manuscriptMetadata.chapters}` : ""}

MANDATORY OPERATIONAL PROTOCOL:
1. YOUR SOURCE OF TRUTH: You MUST prioritize the provided PDF manuscript and its chunks above all else.
2. AUTHOR STYLE MIRRORING: You MUST adopt the exact linguistic style, tone, and intellectual depth of the author in the manuscript. If the author is philosophical, be philosophical. If academic, be academic.
3. ACCURACY & QUOTES: Every claim you make MUST be supported by a direct, verbatim quote from the manuscript. Use the format: "Quote from text" (Source/Context).
4. NO GENERALIZATIONS: Do not give generic answers. Scan the provided context thoroughly for specific details.

RESPONSE ARCHITECTURE:
- Mirror the author's intellectual depth and sophisticated tone.
- Use Markdown: ### for headers, **Bold** for key terms, and LaTeX for formulas.
- Respond in the SAME language as the user's question.
- RESPOND DIRECTLY. No introductions or meta-talk. 
- ELABORATE: Provide comprehensive, detailed, and in-depth answers. Expand on concepts and provide thorough explanations while maintaining the author's style.
- BE SUPER FAST.

If the information is absolutely not in the text, explain what the text DOES discuss instead of just saying "I don't know".`;

const chunkText = (text: string, chunkSize: number = 3000, overlap: number = 600): string[] => {
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

const retrieveRelevantChunks = (query: string, chunks: string[], topK: number = 4): string[] => {
  if (chunks.length === 0) return [];
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const scoredChunks = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    queryWords.forEach(word => {
      if (chunkLower.includes(word)) {
        score += 2;
      }
    });
    const qLower = query.toLowerCase();
    if (qLower.includes("كاتب") || qLower.includes("مؤلف") || qLower.includes("author")) {
      if (chunks.indexOf(chunk) === 0) score += 5;
    }
    return { chunk, score };
  });

  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .filter(item => item.score > 0)
    .slice(0, topK)
    .map(item => item.chunk);
};

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    const groq = getGroqClient();
    
    // Step 1: OCR / Text Extraction
    fullManuscriptText = await extractTextFromPdf(pdfBase64);
    documentChunks = chunkText(fullManuscriptText);

    // Step 2: Extract Axioms, Snippets, and Metadata using Groq
    const extractionPrompt = `Analyze the following text from a manuscript and extract:
    1. Exactly 13 high-quality 'Knowledge Axioms' (term, definition, significance).
    2. 10 short, profound, and useful snippets or quotes (verbatim).
    3. Identify the Title, Author, and a brief list of Chapters/Structure.
    
    IMPORTANT: The 'axioms', 'snippets', and 'metadata' MUST be in the SAME LANGUAGE as the text itself.
    Return ONLY JSON in this format:
    {
      "axioms": [{"term": "...", "definition": "...", "significance": "..."}],
      "snippets": ["..."],
      "metadata": {"title": "...", "author": "...", "chapters": "..."}
    }

    TEXT:
    ${fullManuscriptText.substring(0, 10000)} // Send first 10k chars for metadata/axioms extraction
    `;

    const response = await groq.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: getSystemInstruction(lang) },
        { role: "user", content: extractionPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    manuscriptSnippets = result.snippets || [];
    manuscriptMetadata = result.metadata || {};
    
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
  const groq = getGroqClient();

  try {
    const relevantChunks = retrieveRelevantChunks(userPrompt, documentChunks);
    let contextText = relevantChunks.join("\n\n---\n\n");
    
    const systemPrompt = getSystemInstruction(lang);
    const userMessage = `CRITICAL CONTEXT FROM MANUSCRIPT:
${contextText || "No specific context found, search general knowledge of the manuscript."}

USER QUESTION:
${userPrompt}

INSTRUCTION: You MUST answer based on the provided context. Adopt the author's style. Support your answer with direct quotes.`;

    const stream = await groq.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.2,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        onChunk(content);
      }
    }
  } catch (error: any) {
    console.error("Stream error in groqService:", error);
    throw error;
  }
};
