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
 * Get Groq Client - Uses GROQ_API_KEY from environment
 */
export const getGroqClient = (): Groq => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "undefined") {
        console.error("Critical: GROQ_API_KEY is missing in the environment.");
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
 * JSON Parser with fallback for malformed responses
 */
const parseJSONResponse = (text: string): any => {
    // Try direct parse first
    try {
        return JSON.parse(text);
    } catch {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[1].trim());
            } catch {
                // Continue to fallback
            }
        }

        // Try to find JSON object in text
        const objectMatch = text.match(/\{[\s\S]*\}/);
        if (objectMatch) {
            try {
                return JSON.parse(objectMatch[0]);
            } catch {
                // Continue to fallback
            }
        }

        console.error("Failed to parse JSON response:", text.substring(0, 500));
        throw new Error("Invalid JSON response from AI");
    }
};

/**
 * Extract Axioms from PDF text using Groq
 * This replaces the Gemini extractAxioms function
 */
export const extractAxioms = async (extractedText: string, lang: Language): Promise<Axiom[]> => {
    try {
        const groq = getGroqClient();
        chatHistory = [];
        fullManuscriptText = extractedText;
        documentChunks = chunkText(extractedText);

        const combinedPrompt = `You are a specialized text analysis AI. Analyze the following manuscript text and respond ONLY with valid JSON (no markdown, no explanation).

MANUSCRIPT TEXT:
"""
${extractedText.substring(0, 30000)}
"""

TASK:
1. Extract exactly 13 high-quality 'Knowledge Axioms' from this manuscript.
2. Extract 10 short, profound, and useful snippets or quotes DIRECTLY from the text (verbatim).
3. Identify the Title, Author, and a brief list of Chapters/Structure.

IMPORTANT: The 'axioms', 'snippets', and 'metadata' MUST be in the SAME LANGUAGE as the manuscript itself.

Respond with ONLY this JSON structure (no markdown code blocks):
{
  "axioms": [
    {"term": "...", "definition": "...", "significance": "..."}
  ],
  "snippets": ["...", "..."],
  "metadata": {
    "title": "...",
    "author": "...",
    "chapters": "..."
  }
}`;

        const response = await groq.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: "You are a JSON-only response AI. Never include markdown code blocks or explanations. Only output valid JSON." },
                { role: "user", content: combinedPrompt }
            ],
            temperature: 0.3,
            max_tokens: 8000,
        });

        const responseText = response.choices[0]?.message?.content || "{}";
        const result = parseJSONResponse(responseText);

        manuscriptSnippets = result.snippets || [];
        manuscriptMetadata = result.metadata || {};

        console.log("Single-pass extraction with Metadata indexing complete.");

        // Initialize chat history with system instruction
        chatHistory = [
            { role: "system", content: getSystemInstruction(lang) }
        ];

        return result.axioms || [];
    } catch (error: any) {
        console.error("Error in extractAxioms:", error);
        throw error;
    }
};

export const getManuscriptSnippets = () => manuscriptSnippets;

/**
 * Stream chat with manuscript using Groq
 * This replaces the Gemini chatWithManuscriptStream function
 */
export const chatWithManuscriptStream = async (
    userPrompt: string,
    lang: Language,
    onChunk: (text: string) => void
): Promise<void> => {
    const groq = getGroqClient();

    try {
        const relevantChunks = retrieveRelevantChunks(userPrompt, documentChunks);

        let augmentedPrompt = "";
        const hasChunks = relevantChunks.length > 0;

        if (hasChunks) {
            const contextText = relevantChunks.join("\n\n---\n\n");
            augmentedPrompt = `CRITICAL CONTEXT FROM MANUSCRIPT:
${contextText}

USER QUESTION:
${userPrompt}

INSTRUCTION: You MUST answer based on the provided context. Adopt the author's style. Support your answer with direct quotes.`;
        } else {
            // If no relevant chunks, include more context
            const broadContext = documentChunks.slice(0, 3).join("\n\n---\n\n");
            augmentedPrompt = `MANUSCRIPT CONTEXT:
${broadContext}

USER QUESTION: ${userPrompt}

INSTRUCTION: Scan the entire manuscript to find the answer. Adopt the author's style. Be specific and provide quotes.`;
        }

        // Update chat history
        chatHistory.push({ role: "user", content: augmentedPrompt });

        // Create streaming completion
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

        // Add assistant response to history
        chatHistory.push({ role: "assistant", content: fullResponse });

        // Keep history manageable (last 10 exchanges)
        if (chatHistory.length > 21) {
            const systemMsg = chatHistory[0];
            chatHistory = [systemMsg, ...chatHistory.slice(-20)];
        }

    } catch (error: any) {
        console.error("Stream error in groqService:", error);
        chatHistory = [{ role: "system", content: getSystemInstruction(lang) }];
        throw error;
    }
};
