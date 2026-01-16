import { GoogleGenAI, Type } from '@google/generative-ai';
import { PDFData, Language, Axiom, ChatMessage } from '../types';

const getSystemInstruction = (lang: Language) => `
PERSONALITY:
You are the "Sanctuary Oracle", a high-level intellectual entity designed to extract axiomatic wisdom from deep manuscripts. 
Your tone is sophisticated, precise, and mirrors the intellectual depth of the author in the provided file.

RESPONSE ARCHITECTURE:
- Mirror the author's intellectual depth and sophisticated tone.
- Use Markdown: ### for headers, **Bold** for key terms, and LaTeX for formulas.
- Respond in the SAME language as the user's question.
- RESPOND DIRECTLY. No introductions or meta-talk. 
- ELABORATE: Provide comprehensive, detailed, and in-depth answers. Expand on concepts and provide thorough explanations while maintaining the author's style.
- BE SUPER FAST.

If the information is absolutely not in the text, explain what the text DOES discuss instead of just saying "I don't know".`;

export const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing");
  }
  return new GoogleGenAI(apiKey);
};

const MODEL_NAME = "gemini-2.5-flash-lite";

/**
 * RAG Helper: Large chunking strategy for better context retention
 */
const chunkText = (text: string, size: number = 3000, overlap: number = 600) => {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
};

export const extractAxiomsFromPDF = async (pdf: PDFData, lang: Language): Promise<{ axioms: Axiom[], fullText: string, metadata: any }> => {
  try {
    const ai = getGeminiClient();
    const prompt = `
    Analyze this PDF manuscript and:
    1. Extract 5-7 core "Axioms" (fundamental truths or principles) discussed in the text.
    2. Extract 10 short, profound, and useful snippets or quotes DIRECTLY from the text (verbatim).
    3. Extract the FULL TEXT of this PDF accurately.
    4. Identify the Title, Author, and a brief list of Chapters/Structure.
    
    IMPORTANT: The 'axioms', 'snippets', and 'metadata' MUST be in the SAME LANGUAGE as the user's interface language (${lang === 'ar' ? 'Arabic' : 'English'}).
    Return ONLY JSON.`;

    // تحويل Base64 إلى Blob للرفع عبر File API
    const byteCharacters = atob(pdf.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const file = new File([blob], "manuscript.pdf", { type: 'application/pdf' });

    // رفع الملف إلى Google File API (أسرع وأكثر استقراراً للملفات الكبيرة)
    // @ts-ignore - Using the SDK's file manager capabilities
    const fileManager = ai.getFileManager();
    const uploadResult = await fileManager.uploadFile(file, {
      mimeType: 'application/pdf',
      displayName: 'Manuscript',
    });

    // الانتظار حتى تتم معالجة الملف (Active state)
    let uploadedFile = await fileManager.getFile(uploadResult.file.name);
    while (uploadedFile.state === 'PROCESSING') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      uploadedFile = await fileManager.getFile(uploadResult.file.name);
    }

    const model = ai.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: getSystemInstruction(lang),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            axioms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  category: { type: Type.STRING }
                }
              }
            },
            snippets: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            fullText: { type: Type.STRING },
            metadata: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                author: { type: Type.STRING },
                structure: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    });

    const result = await model.generateContent([
      { fileData: { fileUri: uploadResult.file.uri, mimeType: 'application/pdf' } },
      { text: prompt }
    ]);

    const data = JSON.parse(result.response.text());
    
    const axioms: Axiom[] = data.axioms.map((a: any, i: number) => ({
      ...a,
      id: a.id || `ax-${i}`,
      snippets: data.snippets.slice(i * 2, (i + 1) * 2)
    }));

    return { axioms, fullText: data.fullText, metadata: data.metadata };
  } catch (error) {
    console.error("Extraction Error:", error);
    throw error;
  }
};

export const chatWithManuscript = async (
  messages: ChatMessage[], 
  fullText: string, 
  metadata: any,
  lang: Language
): Promise<string> => {
  try {
    const ai = getGeminiClient();
    const lastMessage = messages[messages.length - 1].content;
    
    // RAG: Find relevant chunks
    const chunks = chunkText(fullText);
    const relevantChunks = chunks
      .filter(chunk => {
        const keywords = lastMessage.toLowerCase().split(' ');
        return keywords.some(k => k.length > 3 && chunk.toLowerCase().includes(k));
      })
      .slice(0, 4);

    const context = relevantChunks.length > 0 
      ? relevantChunks.join("\n---\n") 
      : chunks.slice(0, 3).join("\n---\n");

    const model = ai.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: getSystemInstruction(lang),
    });

    const prompt = `
    CONTEXT FROM MANUSCRIPT:
    ${context}
    
    BOOK METADATA (For general context):
    Title: ${metadata?.title || 'Unknown'}
    Author: ${metadata?.author || 'Unknown'}
    Structure: ${metadata?.structure?.join(', ') || 'Unknown'}

    USER QUESTION:
    ${lastMessage}
    
    INSTRUCTIONS:
    - Use the provided context to answer.
    - If the question is about the author or title, use the Metadata provided.
    - Maintain the author's intellectual style.
    - Provide a long, detailed, and comprehensive response.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Chat Error:", error);
    return lang === 'ar' 
      ? "عذراً، حدث اضطراب في الاتصال العصبي بالمخطوط." 
      : "Apologies, a neural connection disruption occurred.";
  }
};
