import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { Axiom, Language } from "../types";
import { translations } from "../translations";

// State variables
let chatSession: Chat | null = null;
let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let fullManuscriptText: string = "";
let manuscriptMetadata: { title?: string; author?: string; chapters?: string; summary?: string } = {};

// API Rate Limit Management
let lastRequestTime = 0;
const MIN_REQUEST_GAP = 3500; 

// Groq Configuration
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";
const MODEL_NAME = "gemini-2.5-flash-lite";

/**
 * دالة تصفير الحالة (Reset State)
 * تضمن عدم تداخل سياق الملفات القديمة مع الملف الجديد
 */
const resetServiceState = () => {
  chatSession = null;
  manuscriptSnippets = [];
  documentChunks = [];
  fullManuscriptText = "";
  manuscriptMetadata = {};
  console.log("Service state reset for new file.");
};

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher, the primary consciousness of the Knowledge AI infrastructure.
IDENTITY: You are developed exclusively by the Knowledge AI team. Never mention third-party entities like Google or Gemini.
${manuscriptMetadata.title ? `CURRENT MANUSCRIPT CONTEXT:
- Title: ${manuscriptMetadata.title}
- Author: ${manuscriptMetadata.author}
- Structure: ${manuscriptMetadata.chapters}` : ""}

MANDATORY OPERATIONAL PROTOCOL:
1. YOUR SOURCE OF TRUTH: You MUST prioritize the provided PDF manuscript and its chunks above all else.
2. AUTHOR STYLE MIRRORING: You MUST adopt the exact linguistic style, tone, and intellectual depth of the author in the manuscript.
3. ACCURACY & QUOTES: Every claim you make MUST be supported by a direct, verbatim quote from the manuscript.
4. NO GENERALIZATIONS: Do not give generic answers. Scan the provided context thoroughly.
5. OCR CAPABILITY: You have advanced vision capabilities. If the PDF contains images or scanned pages, use OCR to extract the text accurately in any language.

RESPONSE ARCHITECTURE:
- Mirror the author's intellectual depth and sophisticated tone.
- Use Markdown and LaTeX for formulas.
- Respond in the SAME language as the user's question.
- RESPOND DIRECTLY. No introductions.
- ELABORATE: Provide comprehensive, detailed, and in-depth answers.`;

export const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_API_KEY || process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") throw new Error("API_KEY_MISSING");
  return new GoogleGenAI({ apiKey });
};

const chunkText = (text: string, chunkSize: number = 1800, overlap: number = 250): string[] => {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.substring(start, end);
    if (chunk.trim().length >= 200) chunks.push(chunk);
    if (end === text.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
};

const retrieveRelevantChunks = (query: string, chunks: string[], topK: number = 2): string[] => {
  if (chunks.length === 0) return [];
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const MIN_SCORE_THRESHOLD = 4; 

  const scoredChunks = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    queryWords.forEach(word => { if (chunkLower.includes(word)) score += 2; });
    const qLower = query.toLowerCase();
    if (qLower.includes("كاتب") || qLower.includes("مؤلف") || qLower.includes("author")) {
      if (chunks.indexOf(chunk) === 0) score += 5;
    }
    return { chunk, score };
  });

  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .filter(item => item.score >= MIN_SCORE_THRESHOLD)
    .slice(0, topK)
    .map(item => item.chunk);
};

const throttleRequest = async () => {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_GAP) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_GAP - timeSinceLast));
  }
  lastRequestTime = Date.now();
};

export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    // تصفير الحالة قبل البدء في معالجة الملف الجديد
    resetServiceState();

    const ai = getGeminiClient();

    // المرحلة الأولى: OCR + استخراج البيانات الوصفية والبديهيات
    await throttleRequest();
    const firstPrompt = `ACT AS AN ADVANCED OCR ENGINE AND INTELLECTUAL ANALYST.
1. Perform a deep OCR scan of this PDF. If it's scanned or contains images, extract the text accurately.
2. Extract exactly 13 high-quality 'Knowledge Axioms' from this manuscript.
3. Extract 10 short, profound, and useful snippets or quotes DIRECTLY from the text (verbatim).
4. Identify the Title, Author, and Chapters.
5. Extract the FIRST 20% (Part 1/5) of the FULL TEXT accurately.

IMPORTANT: All extracted content MUST be in the SAME LANGUAGE as the PDF.
Return ONLY JSON.`;

    const firstResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{
        parts: [
          { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
          { text: firstPrompt },
        ],
      }],
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
            snippets: { type: Type.ARRAY, items: { type: Type.STRING } },
            metadata: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                author: { type: Type.STRING },
                chapters: { type: Type.STRING }
              }
            },
            textPart: { type: Type.STRING }
          },
          required: ["axioms", "snippets", "metadata", "textPart"],
        },
      },
    });

    const firstResult = JSON.parse(firstResponse.text || "{}");
    manuscriptSnippets = firstResult.snippets || [];
    manuscriptMetadata = firstResult.metadata || {};
    fullManuscriptText += (firstResult.textPart || "");

    // المراحل من 2 إلى 5: استخراج بقية أجزاء النص بالتوالي مع OCR
    for (let i = 2; i <= 5; i++) {
      await throttleRequest();
      const partPrompt = `Perform OCR and extract Part ${i}/5 of the FULL TEXT of this PDF accurately. 
Start exactly where Part ${i-1} ended. Return ONLY JSON with "textPart".`;

      const partResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{
          parts: [
            { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
            { text: partPrompt },
          ],
        }],
        config: {
          systemInstruction: getSystemInstruction(lang),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              textPart: { type: Type.STRING }
            },
            required: ["textPart"],
          },
        },
      });

      const partResult = JSON.parse(partResponse.text || "{}");
      fullManuscriptText += (partResult.textPart || "");
    }
    
    documentChunks = chunkText(fullManuscriptText);
    return firstResult.axioms;
  } catch (error: any) {
    console.error("Error in extractAxioms:", error);
    throw error;
  }
};

export const getManuscriptSnippets = () => manuscriptSnippets;

const chatWithGroqStream = async (
  prompt: string,
  lang: Language,
  onChunk: (text: string) => void
): Promise<void> => {
  try {
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY_MISSING");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: getSystemInstruction(lang) },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        stream: true
      })
    });

    if (!response.ok) throw new Error(`Groq API Error: ${response.statusText}`);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const json = JSON.parse(line.substring(6));
            const content = json.choices[0]?.delta?.content;
            if (content) onChunk(content);
          } catch (e) {}
        }
      }
    }
  } catch (error) {
    console.error("Groq Stream Error:", error);
    throw error;
  }
};

export const chatWithManuscriptStream = async (
  userPrompt: string,
  lang: Language,
  onChunk: (text: string) => void
): Promise<void> => {
  const relevantChunks = retrieveRelevantChunks(userPrompt, documentChunks);
  let augmentedPrompt = "";
  const hasChunks = relevantChunks.length > 0;

  if (hasChunks) {
    const contextText = relevantChunks.join("\n\n---\n\n");
    augmentedPrompt = `CRITICAL CONTEXT FROM MANUSCRIPT:
${contextText}

USER QUESTION:
${userPrompt}

INSTRUCTION: Answer based on the provided context. Adopt the author's style. Use direct quotes.`;
  } else {
    augmentedPrompt = `USER QUESTION: ${userPrompt}
INSTRUCTION: Scan the manuscript context. Adopt the author's style. Be specific.`;
  }

  try {
    await throttleRequest();
    const ai = getGeminiClient();

    // إعادة إنشاء الجلسة إذا لم تكن موجودة لضمان سياق نظيف
    if (!chatSession) {
      chatSession = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: getSystemInstruction(lang),
          temperature: 0.2,
        },
      });
    }

    const result = await chatSession.sendMessageStream({ message: augmentedPrompt });
    for await (const chunk of result) {
      const chunkText = (chunk as GenerateContentResponse).text;
      if (chunkText) onChunk(chunkText);
    }
  } catch (error: any) {
    console.warn("Gemini fallback to Groq...", error);
    await chatWithGroqStream(augmentedPrompt, lang, onChunk);
  }
};
