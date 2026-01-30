/**
 * Groq AI Service - Premium Smart RAG System
 * Features:
 * 1. Hybrid Search Algorithm (Density + Proximity)
 * 2. Context Expansion (Sliding Window retrieval)
 * 3. Ephemeral Memory (Low Token Usage)
 * 4. Strict Session Reset (Fixes data mixing)
 */

import Groq from "groq-sdk";
import { Axiom, Language } from "../types";

// Global State
let conversationHistory: { role: "system" | "user" | "assistant"; content: string }[] = [];
let manuscriptSnippets: string[] = [];
let documentChunks: string[] = [];
let manuscriptMetadata: { title?: string; author?: string; chapters?: string; summary?: string } = {};

/**
 * RESET FUNCTION - CRITICAL FOR PREVENTING DATA MIXING
 */
export const resetGenAISession = () => {
    conversationHistory = [];
    manuscriptSnippets = [];
    documentChunks = [];
    manuscriptMetadata = {};
    console.log("Create New Session: Memory Wiped Sucessfully.");
};

/**
 * Enhanced System Persona
 */
const getSystemInstruction = (lang: Language): string => `You are the Knowledge AI, an Elite Intellectual Researcher. 
IDENTITY: Developed by Knowledge AI team.
${manuscriptMetadata.title ? `MANUSCRIPT FOCUS: ${manuscriptMetadata.title} by ${manuscriptMetadata.author}` : ""}

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


export const getGroqClient = (): Groq => {
    const apiKey = process.env.GROQ_API_KEY || (import.meta.env && import.meta.env.GROQ_API_KEY);
    if (!apiKey || apiKey === "undefined") throw new Error("GROQ_API_KEY_MISSING");
    return new Groq({ apiKey, dangerouslyAllowBrowser: true });
};

const MODEL_NAME = "llama-3.3-70b-versatile";

/**
 * 1. Chunking with Indexing
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
 * 2. Advanced Retrieval Logic
 */
const retrieveRelevantChunks = (query: string, chunks: string[], topK: number = 3): string[] => {
    if (chunks.length === 0) return [];

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
            if (chunkLower.includes(word)) {
                score += 5;
                matches++;
            }
        });

        if (matches > 1) {
            score *= 1.5;
        }

        return { index, chunk, score };
    });

    const topResults = scoredChunks
        .sort((a, b) => b.score - a.score)
        .filter(item => item.score > 0)
        .slice(0, topK);

    // Context Expansion
    const expandedContexts = topResults.map(item => {
        const prev = chunks[item.index - 1] || "";
        const current = item.chunk;
        const next = chunks[item.index + 1] || "";
        return `...${prev.slice(-300)} ${current} ${next.slice(0, 300)}...`;
    });

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
        // CRITICAL: Ensure clean slate for new file
        resetGenAISession();

        const groq = getGroqClient();
        documentChunks = chunkText(extractedText);

        // Initial analysis on first ~15k chars
        const analysisText = extractedText.substring(0, 15000);

        const combinedPrompt = `Analyze text & return JSON.
TEXT: """${analysisText}"""
TASK: 
1. Extract 13 "Knowledge Axioms" (Deep, timeless truths).
2. Extract 10 verbatim snippets.
3. Metadata (Title, Author).
IMPORTANT: The 'axioms', 'snippets', and 'metadata' MUST be in the SAME LANGUAGE as the PDF manuscript itself.
FORMAT: {"axioms": [{"term": "", "definition": "", "significance": "..."}], "snippets": [], "metadata": {"title": "", "author": ""}}`;

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
        const relevantChunks = retrieveRelevantChunks(userPrompt, documentChunks, 3);
        const contextText = relevantChunks.join("\n\n---\n\n");

        const ephemeralUserMessage = `
CRITICAL CONTEXT FROM MANUSCRIPT:
"""
${contextText}
"""

USER QUESTION: ${userPrompt}

INSTRUCTION: Answer deeply using ONLY the context above. Adopt author's style.`;

        const messagesForAPI = [
            ...conversationHistory,
            { role: "user", content: ephemeralUserMessage }
        ];

        const stream = await groq.chat.completions.create({
            model: MODEL_NAME,
            // @ts-ignore
            messages: messagesForAPI,
            temperature: 0.2,
            max_tokens: 8000,
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

        conversationHistory.push({ role: "user", content: userPrompt });
        conversationHistory.push({ role: "assistant", content: fullResponse });

        if (conversationHistory.length > 13) {
            conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-12)];
        }

    } catch (error) {
        console.error("Chat Stream Error:", error);
        throw error;
    }
};

