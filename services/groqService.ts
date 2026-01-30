/**
 * Groq AI Service - llama-3.3-70b-versatile
 * Migration from Gemini API to Groq API
 * Maintains the same "Deep Analysis" capability with RAG
 */

import Groq from "groq-sdk";
import { Axiom, Language } from "../types";

// State management
let chatHistory: { role: "system" | "user" | "assistant"; content: string }[] = [];
let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let fullManuscriptText: string = "";
let manuscriptMetadata: { title?: string; author?: string; chapters?: string; summary?: string } = {};

/**
 * System Instruction - Preserved from original Gemini implementation
 */
const getSystemInstruction = (lang: Language): string => `You are an Elite Intellectual Researcher, the primary consciousness of the Knowledge AI infrastructure. 
IDENTITY: You are developed exclusively by the Knowledge AI team. Never mention third-party entities like Google, Gemini, Meta, or Llama.
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

/**
 * Get Groq Client with Diagnostics
 */
export const getGroqClient = (): Groq => {
    // Try to get key from valid sources
    const apiKey = process.env.GROQ_API_KEY || (import.meta.env && import.meta.env.GROQ_API_KEY);

    // Debug Log (Safe: only showing first 4 chars)
    if (apiKey) {
        console.log("Groq Client Init: API Key found starts with " + apiKey.substring(0, 4) + "...");
    } else {
        console.error("Groq Client Init: API Key NOT FOUND in process.env or import.meta.env");
    }

    if (!apiKey || apiKey === "undefined") {
        console.error("Critical: GROQ_API_KEY is missing.");
        throw new Error("GROQ_API_KEY_MISSING");
    }

    return new Groq({ apiKey, dangerouslyAllowBrowser: true });
};

const MODEL_NAME = "llama-3.3-70b-versatile";

/**
 * RAG Helper: Large chunking strategy for better context retention
 */
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

/**
 * RAG Helper: Enhanced retrieval with multi-word matching
 */
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

/**
 * JSON Parser using regex to extract JSON from text
 */
const extractJSON = (text: string): any => {
    try {
        // 1. Try finding a JSON block between ```json ... ```
        const jsonBlock = text.match(/```json\n([\s\S]*?)\n```/);
        if (jsonBlock && jsonBlock[1]) {
            return JSON.parse(jsonBlock[1]);
        }

        // 2. Try finding the first '{' and last '}'
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1) {
            const jsonStr = text.substring(startIndex, endIndex + 1);
            return JSON.parse(jsonStr);
        }

        // 3. Fallback: Try parsing the whole text
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON Parsing failed:", e);
        throw new Error("INVALID_JSON_RESPONSE");
    }
};

/**
 * Extract Axioms from PDF text using Groq
 */
export const extractAxioms = async (extractedText: string, lang: Language): Promise<Axiom[]> => {
    try {
        const groq = getGroqClient();
        chatHistory = [];
        fullManuscriptText = extractedText;
        documentChunks = chunkText(extractedText);

        const combinedPrompt = `You are a specialized text analysis AI.
    
TASK:
1. Extract exactly 13 high-quality 'Knowledge Axioms' from the manuscript text below.
2. Extract 10 short snippets/quotes DIRECTLY from the text.
3. Identify Title, Author, and Structure.
    
MANUSCRIPT TEXT (TRUNCATED):
"""
${extractedText.substring(0, 25000)}
"""

OUTPUT FORMAT:
Return ONLY a valid JSON object with this structure:
{
  "axioms": [ {"term": "string", "definition": "string", "significance": "string"} ],
  "snippets": [ "string" ],
  "metadata": { "title": "string", "author": "string", "chapters": "string" }
}

IMPORTANT:
- Response MUST be pure JSON. No markdown formatting.
- Content MUST be in the SAME LANGUAGE as the manuscript.
`;

        const response = await groq.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: "You are a JSON-only response AI." },
                { role: "user", content: combinedPrompt }
            ],
            temperature: 0.3,
            max_tokens: 8000,
            response_format: { type: "json_object" }
        });

        const responseText = response.choices[0]?.message?.content || "{}";
        const result = extractJSON(responseText);

        manuscriptSnippets = result.snippets || [];
        manuscriptMetadata = result.metadata || {};

        console.log("Extraction complete. Axioms found:", (result.axioms?.length || 0));

        // Initialize chat history
        chatHistory = [
            { role: "system", content: getSystemInstruction(lang) }
        ];

        return result.axioms || [];
    } catch (error: any) {
        console.error("Error in extractAxioms:", error);

        // Explicit Error Mapping
        if (error?.status === 401) throw new Error("GROQ_API_KEY_INVALID");
        if (error?.status === 429) throw new Error("GROQ_RATE_LIMIT");
        if (error?.message?.includes("API key")) throw new Error("GROQ_API_KEY_MISSING");

        throw error;
    }
};

export const getManuscriptSnippets = () => manuscriptSnippets;

/**
 * Stream chat with manuscript using Groq
 */
export const chatWithManuscriptStream = async (
    userPrompt: string,
    lang: Language,
    onChunk: (text: string) => void
): Promise<void> => {
    const groq = getGroqClient();

    try {
        const relevantChunks = retrieveRelevantChunks(userPrompt, documentChunks);
        const hasChunks = relevantChunks.length > 0;

        let augmentedPrompt = "";
        if (hasChunks) {
            const contextText = relevantChunks.join("\n\n---\n\n");
            augmentedPrompt = `CONTEXT:\n${contextText}\n\nQUESTION: ${userPrompt}\n\nANSWER (in author's style, using quotes):`;
        } else {
            augmentedPrompt = `QUESTION: ${userPrompt}\n\nANSWER (scan full text, use author's style):`;
        }

        chatHistory.push({ role: "user", content: augmentedPrompt });

        const stream = await groq.chat.completions.create({
            model: MODEL_NAME,
            messages: chatHistory,
            temperature: 0.2,
            max_tokens: 4000,
            stream: true,
        });

        let fullResponse = "";
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                fullResponse += content;
                onChunk(content);
            }
        }

        chatHistory.push({ role: "assistant", content: fullResponse });

        // Trim history
        if (chatHistory.length > 21) {
            chatHistory = [chatHistory[0], ...chatHistory.slice(-20)];
        }

    } catch (error: any) {
        console.error("Stream error in groqService:", error);
        chatHistory = [{ role: "system", content: getSystemInstruction(lang) }];
        throw error;
    }
};
