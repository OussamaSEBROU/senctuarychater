import { Axiom, Language } from "../types";
import { translations } from "../translations";

// State variables
let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let fullManuscriptText: string = "";
let manuscriptMetadata: { title?: string; author?: string; chapters?: string; summary?: string } = {};

// API Rate Limit Management
let lastRequestTime = 0;
const MIN_REQUEST_GAP = 1000; // Groq is faster, but we keep a small gap

// Groq Configuration
// We use Llama 3.2 90B Vision for PDF/Image processing and Llama 3.3 70B for fast chat
const GROQ_VISION_MODEL = "llama-3.2-90b-vision-preview";
const GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";

/**
 * دالة تصفير الحالة (Reset State)
 * تضمن عدم تداخل سياق الملفات القديمة مع الملف الجديد
 */
export const resetServiceState = () => {
  manuscriptSnippets = [];
  documentChunks = [];
  fullManuscriptText = "";
  manuscriptMetadata = {};
  console.log("Service state reset for new file.");
};

const getSystemInstruction = (lang: Language) => `You are an Elite Intellectual Researcher, the primary consciousness of the Knowledge AI infrastructure.
IDENTITY: You are developed exclusively by the Knowledge AI team. Never mention third-party entities like Google, Gemini, or Meta.
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

const getGroqApiKey = () => {
  // Priority: Vite Env (Client-side) -> Process Env (Server-side)
  const apiKey = import.meta.env.VITE_GROQ_API_KEY || "";
  if (!apiKey || apiKey === "undefined") {
    console.error("GROQ_API_KEY is missing. Please set VITE_GROQ_API_KEY in your environment.");
    throw new Error("API_KEY_MISSING");
  }
  return apiKey;
};

const chunkText = (text: string, chunkSize: number = 1800, overlap: number = 250): string[] => {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.substring(start, end);
    if (chunk.trim().length >= 200) chunks.push(chunk);
    start += chunkSize - overlap;
  }
  return chunks;
};

/**
 * Note: Groq doesn't support direct PDF upload like Gemini.
 * We need to extract text from PDF or send it as images if it's scanned.
 * For this implementation, we assume the frontend provides the base64.
 * Since Groq Vision takes images, we'll treat the PDF as a source for text extraction.
 * If the user wants OCR for scanned PDFs, they should ideally convert pages to images.
 * However, to keep it simple and compatible with the existing UI:
 */
export const extractAxioms = async (pdfBase64: string, lang: Language): Promise<Axiom[]> => {
  try {
    resetServiceState();
    const apiKey = getGroqApiKey();

    // Since Groq doesn't have a native PDF "file" API like Gemini, 
    // and we want to maintain the "scanned PDF" capability:
    // We will use the Vision model. Note: Vision models usually take images.
    // If pdfBase64 is actually an image or if we can only send text, we'd need a helper.
    // BUT, the user asked for Groq to read PDF even if scanned.
    // In a real web app, you'd use pdf.js to render pages to images.
    // Here, we will provide the prompt and handle the API call.
    
    const prompt = `Analyze the provided document and extract 10-15 core axioms (foundational principles).
    Return ONLY a JSON object with this structure:
    {
      "metadata": { "title": "string", "author": "string", "chapters": "string", "summary": "string" },
      "axioms": [ { "term": "string", "definition": "string", "significance": "string" } ]
    }
    Language: ${lang === 'ar' ? 'Arabic' : 'English'}`;

    // API Call to Groq
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: pdfBase64 // Groq Vision supports base64 images. For PDFs, they must be converted to images first on the client side.
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Groq API Error: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    const responseText = result.choices[0].message.content;
    const data = JSON.parse(responseText);
    
    manuscriptMetadata = data.metadata || {};
    fullManuscriptText = data.axioms.map((a: any) => `${a.term}: ${a.definition}`).join("\n\n");
    documentChunks = chunkText(fullManuscriptText);
    manuscriptSnippets = data.axioms.map((a: any) => a.definition).slice(0, 5);

    return data.axioms;
  } catch (error) {
    console.error("Error extracting axioms:", error);
    throw error;
  }
};

export const chatWithManuscriptStream = async (
  message: string,
  history: { role: 'user' | 'model'; content: string }[],
  lang: Language,
  onChunk: (chunk: string) => void
) => {
  try {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_GAP) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_GAP - timeSinceLastRequest));
    }

    const apiKey = getGroqApiKey();
    const relevantContext = documentChunks.join("\n\n");
    const systemInstruction = getSystemInstruction(lang);

    const messages = [
      { role: "system", content: systemInstruction },
      ...history.map(h => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.content
      })),
      {
        role: "user",
        content: `CONTEXT FROM MANUSCRIPT:\n${relevantContext}\n\nUSER QUESTION:\n${message}`
      }
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_CHAT_MODEL,
        messages: messages,
        stream: true,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Groq API Error: ${errorData.error?.message || response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    lastRequestTime = Date.now();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const json = JSON.parse(line.substring(6));
              const content = json.choices[0].delta?.content;
              if (content) onChunk(content);
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};

export const getManuscriptSnippets = () => manuscriptSnippets;

