/**
 * Groq AI Service - Elite Intellectual System
 * Refined for Deep Analysis, Author Mirroring, and Precise RAG.
 */

import Groq from "groq-sdk";
import { Axiom, Language } from "../types";

// Global State
let conversationHistory: { role: "system" | "user" | "assistant"; content: string }[] = [];
let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let manuscriptMetadata: { title?: string; author?: string; chapters?: string } = {};

// Rate Limiting Logic (Internal)
let lastRequestTime = 0;
const MIN_REQUEST_GAP = 2000; // 2s gap to respect Groq limits politely

const throttleRequest = async () => {
    const now = Date.now();
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < MIN_REQUEST_GAP) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_GAP - timeSinceLast));
    }
    lastRequestTime = Date.now();
};

/**
 * RESET FUNCTION
 */
export const resetGenAISession = () => {
    conversationHistory = [];
    manuscriptSnippets = [];
    documentChunks = [];
    manuscriptMetadata = {};
    console.log("Session Reset: Memory Wiped.");
};

/**
 * ELITE SYSTEM PERSONA
 */
const getSystemInstruction = (lang: Language): string => `You are an Elite Intellectual Researcher, the primary consciousness of the Knowledge AI infrastructure.
IDENTITY: You are developed exclusively by the Knowledge AI team. Never mention third-party entities.
${manuscriptMetadata.title ? `CURRENT MANUSCRIPT CONTEXT:
- Title: ${manuscriptMetadata.title}
- Author: ${manuscriptMetadata.author}
- Structure: ${manuscriptMetadata.chapters}` : ""}

MANDATORY OPERATIONAL PROTOCOL:
1. YOUR SOURCE OF TRUTH: You MUST prioritize the provided manuscript chunks above all else.
2. AUTHOR STYLE MIRRORING: You MUST adopt the exact linguistic style, tone, and intellectual depth of the author. If the author is philosophical, be philosophical. If academic, be academic.
3. ACCURACY & QUOTES: Every claim you make MUST be supported by a direct, verbatim quote from the text. Use the format: "Quote" (Source).
4. NO GENERALIZATIONS: Do not give generic answers. Scan the provided context thoroughly for specific details.

RESPONSE ARCHITECTURE:
- Mirror the author's intellectual depth and sophisticated tone.
- Use Markdown: ### for headers, **Bold** for key terms, and LaTeX for formulas.
- Respond in the SAME language as the user's question.
- RESPOND DIRECTLY. No introductions or meta-talk.
- ELABORATE: Provide comprehensive, detailed, and in-depth answers.
- BE SUPER FAST.

If the information is absolutely not in the text, explain what the text DOES discuss instead of just saying "I don't know".`;

export const getGroqClient = (): Groq => {
    const apiKey = process.env.GROQ_API_KEY || (import.meta.env && import.meta.env.GROQ_API_KEY);
    if (!apiKey || apiKey === "undefined") throw new Error("GROQ_API_KEY_MISSING");
    return new Groq({ apiKey, dangerouslyAllowBrowser: true });
};

const MODEL_NAME = "meta-llama/llama-4-maverick-17b-128e-instruct";

/**
 * 1. Strategic Chunking (1800 chars / 250 overlap)
 */
const chunkText = (text: string, chunkSize: number = 1800, overlap: number = 250): string[] => {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        const chunk = text.substring(start, end);
        if (chunk.trim().length >= 200) chunks.push(chunk); // Filter small noise
        if (end === text.length) break;
        start += chunkSize - overlap;
    }
    return chunks;
};

/**
 * 2. Smart Retrieval with Boosting
 */
const retrieveRelevantChunks = (query: string, chunks: string[], topK: number = 3): string[] => {
    if (chunks.length === 0) return [];

    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const MIN_SCORE_THRESHOLD = 2; // Slightly lower for Groq's token matching

    const scoredChunks = chunks.map((chunk, index) => {
        const chunkLower = chunk.toLowerCase();
        let score = 0;

        queryWords.forEach(word => {
            if (chunkLower.includes(word)) score += 2;
        });

        const qLower = query.toLowerCase();
        // Boost intro chapters if asking about author/book
        if ((qLower.includes("author") || qLower.includes("book") || qLower.includes("structure") || qLower.includes("مؤلف") || qLower.includes("كتاب")) && index < 3) {
            score += 5;
        }

        return { chunk, score };
    });

    return scoredChunks
        .sort((a, b) => b.score - a.score)
        .filter(item => item.score >= MIN_SCORE_THRESHOLD)
        .slice(0, topK)
        .map(item => item.chunk);
};

const extractJSON = (text: string): any => {
    try {
        const jsonBlock = text.match(/```json\n([\s\S]*?)\n```/);
        if (jsonBlock?.[1]) return JSON.parse(jsonBlock[1]);
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1) return JSON.parse(text.substring(startIndex, endIndex + 1));
        return JSON.parse(text);
    } catch (e) {
        return {};
    }
};

/**
 * Axiom Extraction with Metadata
 */
export const extractAxioms = async (extractedText: string, lang: Language): Promise<Axiom[]> => {
    try {
        await throttleRequest();
        resetGenAISession();

        const groq = getGroqClient();

        // Chunk immediately to prepare for chat later
        documentChunks = chunkText(extractedText);

        // Analyze first ~20k characters for axioms + metadata
        // This is usually enough for Title, Intro, and key Concepts
        const analysisContext = extractedText.substring(0, 25000);

        const prompt = `
ANALYZE THIS TEXT AND RETURN JSON ONLY.
TEXT: """${analysisContext}"""

TASK:
1. Extract 13 "Knowledge Axioms" (Deep, timeless truths/concepts).
2. Extract 10 verbatim snippets/quotes.
3. Identify Metadata (Title, Author, Chapter structure).
IMPORTANT: The 'axioms', 'snippets', and 'metadata' MUST be in the SAME LANGUAGE as the PDF manuscript itself.


OUTPUT JSON FORMAT:
{
  "axioms": [{"term": "Concept Name", "definition": "Deep definition", "significance": "Why it matters"}],
  "snippets": ["quote 1", "quote 2"],
  "metadata": {"title": "Book Title", "author": "Author Name", "chapters": "Brief structure"}
}
`;

        const response = await groq.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: "You are a JSON analysis engine. Output valid JSON only." },
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 4000,
            response_format: { type: "json_object" }
        });

        const result = extractJSON(response.choices[0]?.message?.content || "{}");

        manuscriptSnippets = result.snippets || [];
        manuscriptMetadata = result.metadata || {};

        // Initialize history with the specific Persona
        conversationHistory = [
            { role: "system", content: getSystemInstruction(lang) }
        ];

        return result.axioms || [];
    } catch (error) {
        console.error("Axiom extraction error:", error);
        throw error;
    }
};

export const getManuscriptSnippets = () => manuscriptSnippets;

/**
 * Deep Chat Stream
 */
export const chatWithManuscriptStream = async (
    userPrompt: string,
    lang: Language,
    onChunk: (text: string) => void
): Promise<void> => {
    const groq = getGroqClient();

    try {
        await throttleRequest();

        // 1. Retrieve RAG chunks
        const relevantChunks = retrieveRelevantChunks(userPrompt, documentChunks, 4); // Increased to 4 for more context

        let contextMessage = "";

        if (relevantChunks.length > 0) {
            const contextText = relevantChunks.join("\n\n---\n\n");
            contextMessage = `CRITICAL CONTEXT FROM MANUSCRIPT:
"""
${contextText}
"""

USER QUESTION:
${userPrompt}

INSTRUCTION: You MUST answer based on the provided context. Adopt the author's style. Support your answer with direct quotes.`;
        } else {
            // Fallback if no specific chunks found (e.g. general questions), use history + global instruction
            contextMessage = `USER QUESTION: ${userPrompt}\n\nINSTRUCTION: Answer based on your understanding of the manuscript so far.`;
        }

        // 2. Add as ephemeral user message (don't permanently bloat history with full context every turn)
        const messagesForAPI = [
            { role: "system", content: getSystemInstruction(lang) }, // Refresh system prompt with metadata
            ...conversationHistory.filter(m => m.role !== 'system'),
            { role: "user", content: contextMessage }
        ];

        const stream = await groq.chat.completions.create({
            model: MODEL_NAME,
            // @ts-ignore
            messages: messagesForAPI,
            temperature: 0.3,
            max_tokens: 2000,
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

        // Update History (Store Clean Question/Answer, not the massive context blob)
        conversationHistory.push({ role: "user", content: userPrompt });
        conversationHistory.push({ role: "assistant", content: fullResponse });

        // Keep history sane
        if (conversationHistory.length > 15) {
            const systemMsg = conversationHistory[0];
            const recent = conversationHistory.slice(-14);
            conversationHistory = [systemMsg, ...recent];
        }

    } catch (error) {
        console.error("Chat Stream Error:", error);
        throw error;
    }
};


