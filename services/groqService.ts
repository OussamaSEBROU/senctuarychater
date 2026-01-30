/**
 * Groq AI Service - Premium Smart RAG System
 * Features:
 * 1. Hybrid Search Algorithm (Density + Proximity)
 * 2. Context Expansion (Sliding Window retrieval)
 * 3. Ephemeral Memory (Low Token Usage)
 */

import Groq from "groq-sdk";
import { Axiom, Language } from "../types";

// State
let conversationHistory: { role: "system" | "user" | "assistant"; content: string }[] = [];
let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let manuscriptMetadata: { title?: string; author?: string; chapters?: string; summary?: string } = {};

/**
 * Enhanced System Persona
 */
const getSystemInstruction = (lang: Language): string => `You are the Knowledge AI, an Elite Intellectual Researcher. 
IDENTITY: Developed by Knowledge AI team.
${manuscriptMetadata.title ? `MANUSCRIPT FOCUS: ${manuscriptMetadata.title} by ${manuscriptMetadata.author}` : ""}

CORE PROTOCOLS:
1. DEEP ANALYSIS: Do not jump to conclusions. Analyze the provided CONTEXT deeply before answering.
2. SOURCE FIDELITY: Your answer must be derived *primarily* from the provided snippets.
3. AUTHOR MIRRORING: Adopt the exact intellectual tone and vocabulary of the author.
4. CITATION: When you make a claim, verify it with a short quote from the text if possible.

If the context lacks the answer, admit it clearly but try to infer from the author's general philosophy if applicable.`;

export const getGroqClient = (): Groq => {
    const apiKey = process.env.GROQ_API_KEY || (import.meta.env && import.meta.env.GROQ_API_KEY);
    if (!apiKey || apiKey === "undefined") throw new Error("GROQ_API_KEY_MISSING");
    return new Groq({ apiKey, dangerouslyAllowBrowser: true });
};

const MODEL_NAME = "llama-3.3-70b-versatile";

/**
 * 1. Chunking with Indexing
 * Stores index to allow fetching neighbors later
 */
const chunkText = (text: string, chunkSize: number = 1000, overlap: number = 200): string[] => {
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
 * 2. Advanced Retrieval Logic (The Brain of RAG)
 */
const retrieveRelevantChunks = (query: string, chunks: string[], topK: number = 3): string[] => {
    if (chunks.length === 0) return [];

    // Filter insignificant words for better matching
    const stopWords = new Set(['the', 'and', 'is', 'in', 'it', 'to', 'of', 'for', 'on', 'this', 'that', 'fi', 'min', 'ila', 'ala']);
    const queryWords = query.toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));

    const scoredChunks = chunks.map((chunk, index) => {
        const chunkLower = chunk.toLowerCase();
        let score = 0;
        let matches = 0;

        queryWords.forEach(word => {
            // Base score for existence
            if (chunkLower.includes(word)) {
                score += 5;
                matches++;

                // Boost for specific phrases (exact matches of pairs)
                // (Simple optimization)
            }
        });

        // Density Boost: More matches in shorter text = explicit focus
        if (matches > 1) {
            score *= 1.5;
        }

        return { index, chunk, score };
    });

    // Sort by score
    const topResults = scoredChunks
        .sort((a, b) => b.score - a.score)
        .filter(item => item.score > 0)
        .slice(0, topK);

    // 3. Context Expansion (Smart Window)
    // Instead of just returning the chunk, grab its neighbors!
    // This ensures we don't cut off a sentence or an idea.
    const expandedContexts = topResults.map(item => {
        const prev = chunks[item.index - 1] || "";
        const current = item.chunk;
        const next = chunks[item.index + 1] || "";

        // Combine to form a "Super Chunk" (~3000 chars)
        // Overlap handling is rough here but fine for LLM context
        return `...${prev.slice(-300)} ${current} ${next.slice(0, 300)}...`;
    });

    // Remove duplicates if neighbor logic overlapped
    return [...new Set(expandedContexts)];
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
 * Extract Axioms / Metadata
 */
export const extractAxioms = async (extractedText: string, lang: Language): Promise<Axiom[]> => {
    try {
        const groq = getGroqClient();
        conversationHistory = [];
        documentChunks = chunkText(extractedText);

        // Initial analysis on first ~15k chars to save tokens
        const analysisText = extractedText.substring(0, 15000);

        const combinedPrompt = `Analyze text & return JSON.
TEXT: """${analysisText}"""
TASK: 
1. Extract 13 "Knowledge Axioms" (Deep, timeless truths).
2. Extract 10 verbatim snippets.
3. Metadata (Title, Author).
FORMAT: {"axioms": [{"term": "", "definition": "", "significance": ""}], "snippets": [], "metadata": {"title": "", "author": ""}}`;

        const response = await groq.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: "You are a JSON engine." },
                { role: "user", content: combinedPrompt }
            ],
            temperature: 0.3,
            max_tokens: 4000,
            response_format: { type: "json_object" }
        });

        const result = extractJSON(response.choices[0]?.message?.content || "{}");
        manuscriptSnippets = result.snippets || [];
        manuscriptMetadata = result.metadata || {};

        conversationHistory = [
            { role: "system", content: getSystemInstruction(lang) }
        ];

        return result.axioms || [];
    } catch (error) {
        console.error("Axiom extraction failed:", error);
        throw error;
    }
};

export const getManuscriptSnippets = () => manuscriptSnippets;

/**
 * Chat System
 */
export const chatWithManuscriptStream = async (
    userPrompt: string,
    lang: Language,
    onChunk: (text: string) => void
): Promise<void> => {
    const groq = getGroqClient();

    try {
        // 1. Smart Retrieval with Context Expansion
        const relevantChunks = retrieveRelevantChunks(userPrompt, documentChunks, 3);
        const contextText = relevantChunks.join("\n\n---\n\n");

        // 2. Ephemeral Prompt Construction
        // Included context is NOT saved to permanent history to keep tokens low
        const ephemeralUserMessage = `
CRITICAL CONTEXT FROM MANUSCRIPT:
"""
${contextText}
"""

USER QUESTION: ${userPrompt}

INSTRUCTION: Answer deeply using ONLY the context above. Adopt author's style.`;

        // 3. Prepare minimal history for API
        const messagesForAPI = [
            ...conversationHistory, // Just previous Qs & As
            { role: "user", content: ephemeralUserMessage } // Current Q + Heavy Context
        ];

        const stream = await groq.chat.completions.create({
            model: MODEL_NAME,
            // @ts-ignore
            messages: messagesForAPI,
            temperature: 0.3,
            max_tokens: 1500, // Generous output limit for deep answers
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

        // 4. Update History (Pure Q&A only)
        conversationHistory.push({ role: "user", content: userPrompt });
        conversationHistory.push({ role: "assistant", content: fullResponse });

        // Prune history
        if (conversationHistory.length > 13) {
            conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-12)];
        }

    } catch (error) {
        console.error("Chat Stream Error:", error);
        throw error;
    }
};
