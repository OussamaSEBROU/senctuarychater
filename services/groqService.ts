/**
 * Groq AI Service - Optimized RAG System
 * Implements "Ephemeral Context" to optimize token usage
 */

import Groq from "groq-sdk";
import { Axiom, Language } from "../types";

// State management
// We store ONLY pure conversation here (User Q + AI A), no heavy context
let conversationHistory: { role: "system" | "user" | "assistant"; content: string }[] = [];
let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let fullManuscriptText: string = "";
let manuscriptMetadata: { title?: string; author?: string; chapters?: string; summary?: string } = {};

/**
 * System Instruction
 */
const getSystemInstruction = (lang: Language): string => `You are an Elite Intellectual Researcher, the Knowledge AI. 
IDENTITY: Developed by Knowledge AI team.
${manuscriptMetadata.title ? `MANUSCRIPT: ${manuscriptMetadata.title} by ${manuscriptMetadata.author}` : ""}

PROTOCOL:
1. SOURCE OF TRUTH: Use the provided "CONTEXT" sections strictly.
2. STYLE: Mirror the author's tone.
3. QUOTES: Support claims with verbatim quotes.
4. CONCISENESS: Be deep but efficient. Don't waste tokens on fluff.

If answer is not in context, state what the text DOES discuss.`;

export const getGroqClient = (): Groq => {
    const apiKey = process.env.GROQ_API_KEY || (import.meta.env && import.meta.env.GROQ_API_KEY);
    if (!apiKey || apiKey === "undefined") throw new Error("GROQ_API_KEY_MISSING");
    return new Groq({ apiKey, dangerouslyAllowBrowser: true });
};

const MODEL_NAME = "llama-3.3-70b-versatile";

/**
 * OPTIMIZATION 1: Smaller, denser chunks
 * Reduced from 3000 -> 1200 chars to be more precise and save tokens
 */
const chunkText = (text: string, chunkSize: number = 1200, overlap: number = 200): string[] => {
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
 * RAG Retrieval
 */
const retrieveRelevantChunks = (query: string, chunks: string[], topK: number = 3): string[] => {
    if (chunks.length === 0) return [];
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scoredChunks = chunks.map(chunk => {
        const chunkLower = chunk.toLowerCase();
        let score = 0;
        queryWords.forEach(word => {
            if (chunkLower.includes(word)) score += 3; // Higher weight for matches
        });
        return { chunk, score };
    });

    return scoredChunks
        .sort((a, b) => b.score - a.score)
        .filter(item => item.score > 0)
        .slice(0, topK) // Reduced TopK to 3 to save context window
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
        console.error("JSON Parse Error", e);
        return {};
    }
};

/**
 * Extract Axioms - Optimized Token Usage
 */
export const extractAxioms = async (extractedText: string, lang: Language): Promise<Axiom[]> => {
    try {
        const groq = getGroqClient();
        conversationHistory = [];
        fullManuscriptText = extractedText;
        documentChunks = chunkText(extractedText);

        // OPTIMIZATION 2: Cap input analysis to first 15k chars (approx 3-4k tokens)
        // This is enough for Metadata/Axioms without reading the whole book at once
        const analysisText = extractedText.substring(0, 15000);

        const combinedPrompt = `Analyze this text and return JSON ONLY.
TEXT: """${analysisText}"""
TASK: Extract 13 Axioms, 10 Snippets, and Metadata (Title/Author).
FORMAT: {"axioms": [{"term": "...", "definition": "...", "significance": "..."}], "snippets": [], "metadata": {"title": "...", "author": "..."}}
LANGUAGE: Same as text.`;

        const response = await groq.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: "JSON only." },
                { role: "user", content: combinedPrompt }
            ],
            temperature: 0.3,
            max_tokens: 4000,
            response_format: { type: "json_object" }
        });

        const result = extractJSON(response.choices[0]?.message?.content || "{}");
        manuscriptSnippets = result.snippets || [];
        manuscriptMetadata = result.metadata || {};

        // Init history with just System Instruction (No context yet)
        conversationHistory = [
            { role: "system", content: getSystemInstruction(lang) }
        ];

        return result.axioms || [];
    } catch (error) {
        console.error("Axiom Extract Error:", error);
        throw error;
    }
};

export const getManuscriptSnippets = () => manuscriptSnippets;

/**
 * Chat Stream - Optimized with Ephemeral Context
 */
export const chatWithManuscriptStream = async (
    userPrompt: string,
    lang: Language,
    onChunk: (text: string) => void
): Promise<void> => {
    const groq = getGroqClient();

    try {
        // 1. Retrieve concise context
        constrelevantChunks = retrieveRelevantChunks(userPrompt, documentChunks, 3);
        const contextText = relevantChunks.join("\n---\n");

        // 2. Construct Ephemeral Prompt (User Q + Context)
        // This HUGE block is sent to LLM but NOT saved in history
        const ephemeralUserMessage = `CONTEXT:\n${contextText}\n\nQUESTION: ${userPrompt}`;

        // 3. Construct Messages for API Call
        // [System, ...History, Current_Ephemeral_Msg]
        const messagesForAPI = [
            ...conversationHistory,
            { role: "user", content: ephemeralUserMessage }
        ];

        const stream = await groq.chat.completions.create({
            model: MODEL_NAME,
            // @ts-ignore
            messages: messagesForAPI,
            temperature: 0.3,
            max_tokens: 1024, // Limiting output tokens for speed
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

        // 4. Save to History - OPTIMIZED
        // Only save the pure Question and pure Answer. Drop the context.
        conversationHistory.push({ role: "user", content: userPrompt });
        conversationHistory.push({ role: "assistant", content: fullResponse });

        // Keep history tight (Last 6 turns only) to save tokens
        if (conversationHistory.length > 13) {
            conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-12)];
        }

    } catch (error) {
        console.error("Stream Error:", error);
        throw error;
    }
};
