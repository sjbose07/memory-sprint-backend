const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');
const pdfParse = require('pdf-parse');

// Helper to chunk text
const chunkText = (text, maxLength) => {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + maxLength));
        i += maxLength;
    }
    return chunks;
};

// Helper to run prompt with fallback
// Helper to run prompt with fallback and dynamic discovery
const safeGenerateContent = async (genAI, prompt, customModelName = null) => {
    let primaryModel = customModelName || (process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest').trim();
    
    // Log for debugging (server console only)
    console.log(`[AI] Attempting AI generation with model: "${primaryModel}"`);

    try {
        const model = genAI.getGenerativeModel({ model: primaryModel });
        const result = await model.generateContent(prompt);
        return await result.response;
    } catch (err) {
        const errorMsg = err.message || '';
        console.error(`[AI] Primary model "${primaryModel}" failed:`, errorMsg);
        
        // Handle Rate Limit (429) explicitly
        if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota exceeded')) {
            throw new Error('AI Rate Limit reached. Please wait 1-2 minutes and try again. (Google Free Tier Restriction)');
        }

        // --- DYNAMIC FALLBACK (Only if NO custom model was forced) ---
        if (!customModelName) {
            console.warn(`[AI] Attempting dynamic fallback discovery...`);
            try {
                const modelList = await genAI.listModels();
                // Look for any modern flash or pro models that support generateContent
                const candidates = [
                    'gemini-1.5-flash-latest', 
                    'gemini-2.0-flash-exp', 
                    'gemini-1.5-flash', 
                    'gemini-1.5-pro-latest',
                    'gemini-pro'
                ];

                for (const cand of candidates) {
                    if (cand === primaryModel) continue; // Skip what already failed
                    
                    // Check if this candidate is actually in the permitted list for this key
                    if (modelList.models.some(m => m.name.includes(cand))) {
                        try {
                            console.log(`[AI] Trying dynamic candidate: ${cand}`);
                            const fbModel = genAI.getGenerativeModel({ model: cand });
                            const fbResult = await fbModel.generateContent(prompt);
                            console.log(`[AI] Fallback SUCCESS with model: ${cand}`);
                            return await fbResult.response;
                        } catch (e) {
                             console.warn(`[AI] Candidate ${cand} also failed. Skipping.`);
                        }
                    }
                }
            } catch (listErr) {
                console.error('[AI] Dynamic discovery failed:', listErr.message);
            }
        }

        throw new Error(`AI Service error: ${errorMsg}. Please ensure your API key is active and check your quota at ai.google.dev.`);
    }
};

// POST /ai/generate
const generateQuestions = async (req, res) => {
    const { chapter_id, text_content, count = 5, language, model: customModel } = req.body;
    const langInstruction = language ? `IMPORTANT: The questions, options, and explanations MUST all be written in the following language: ${language}.` : "IMPORTANT: The questions, options, and explanations MUST be written in the SAME language as the input text content provided.";

    if (!chapter_id || !text_content) {
        return res.status(400).json({ error: 'chapter_id and text_content are required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const prompt = `
            You are an expert MCQ creator. Generate ${count} multiple choice questions from the following text content.
            ${langInstruction}
            
            The format must be a raw JSON array of objects, with NO markdown formatting (no \`\`\`json blocks), just the raw JSON.
            Each object must have these fields:
            - question_text: The question string
            - option_a: First option string
            - option_b: Second option string
            - option_c: Third option string
            - option_d: Fourth option string
            - correct_option: Only the letter A, B, C, or D (always use English letters A, B, C, D to denote the option)
            - explanation: A brief explanation of why that answer is correct

            CONTENT:
            ${text_content}
        `;

        const response = await safeGenerateContent(genAI, prompt, customModel);
        let text = response.text();

        // Clean up response if it contains markdown markers
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const questions = JSON.parse(text);
        res.json({ questions });

    } catch (err) {
        console.error('AI Generation Error:', err);
        res.status(500).json({ error: 'Failed to generate questions: ' + err.message });
    }
};

// POST /ai/enhance
const enhanceText = async (req, res) => {
    const { text_content, language, model: customModel } = req.body;
    const langInstruction = language ? `5. The final output MUST be in the following language: ${language}.` : "5. The final output MUST preserve the same language as the input content.";

    if (!text_content) {
        return res.status(400).json({ error: 'text_content is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const prompt = `
            You are an expert editor and fact-checker. Please review and enhance the following text.
            1. Format the text beautifully using Markdown (bold, headers, bullet points).
            2. Make it highly readable and visually attractive.
            3. Insert relevant emojis or ASCII icons to make it engaging.
            4. FACT-CHECK the content: If there are any factual errors in the content, correct them seamlessly or naturally integrate the correct facts.
            ${langInstruction}
            6. Return ONLY the enhanced markdown text, without any additional conversational filler like "Here is the enhanced text".

            CONTENT TO ENHANCE:
            ${text_content}
        `;

        const response = await safeGenerateContent(genAI, prompt, customModel);
        const enhanced_text = response.text().trim();

        res.json({ enhanced_text });

    } catch (err) {
        console.error('AI Enhance Error:', err);
        res.status(500).json({ error: 'Failed to enhance text: ' + err.message });
    }
};

const processDocument = async (req, res) => {
    try {
        const { mode = 'mcq', prompt_text = '', language, model: customModel } = req.body;
        const langInstruction = language ? `Output Language MUST BE: ${language}.` : "IMPORTANT: Always preserve the SAME language as the input text/image content. Do NOT translate unless explicitly requested in the prompt.";
        const file = req.file;

        if (!file && !prompt_text) {
             return res.status(400).json({ error: 'Please provide either a file or a text prompt.' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY missing' });
        }
        
        const genAI = new GoogleGenerativeAI(apiKey);
        let extractedText = prompt_text;

        // Process Direct Image
        if (file && file.mimetype.startsWith('image/')) {
            const primaryModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const model = genAI.getGenerativeModel({ model: primaryModel });
            
            let sysInstruction = '';
            if (mode === 'mcq') {
                sysInstruction = `Extract text and generate MCQs. Format strictly like this EXACTLY:
Question text here?
A. Opt 1 B. Opt 2
C. Opt 3 D. Opt 4
ANSWER: A`;
            } else if (mode === 'fancy_oneliner') {
                sysInstruction = `Extract text and format it into a fancy Q&A style. 
Place the 🌟📚[TOPIC TITLE]📚🌟 header ONLY ONCE at the very top of the entire output.
Then for each question found in the text, use this EXACT pattern below the title:
➡️ Q : [Question Number] [The Question text]
✅ A : ==> [The Answer text]

IMPORTANT: Do NOT repeat the Title for each question. Use only one Title header for the whole content. Ensure double newlines between different entries.`;
            } else {
                sysInstruction = "Extract text and beautify with ASCII icons, smileys, and attractive formatting. IMPORTANT: ALWAYS ensure there is a clear BLANK LINE (double newline) between questions, answers, and different statements so they render correctly in Markdown without squishing together!";
            }

            if (prompt_text) sysInstruction += `\nAdditional Instructions: ${prompt_text}`;
            sysInstruction += `\n${langInstruction} Return ONLY the generated content.`;

            const imagePart = {
                inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype }
            };

            const result = await model.generateContent([sysInstruction, imagePart]);
            const response = await result.response;
            return res.json({ result: response.text().trim() });
        }

        // Process PDF
        if (file && file.mimetype === 'application/pdf') {
            const pdfData = await pdfParse(file.buffer);
            extractedText += '\n\n' + pdfData.text;
        }

        if (!extractedText.trim()) {
            return res.status(400).json({ error: 'No text could be extracted.' });
        }

        // Process Text with chunking (Max ~20,000 chars per chunk to avoid output limits)
        const chunks = chunkText(extractedText, 20000);
        let finalOutput = '';

        for (const chunk of chunks) {
            let sysInstruction = '';
            if (mode === 'mcq') {
                sysInstruction = `Convert the following text into Multiple Choice Questions.
Format strictly EXACTLY like this (NO markdown code blocks, NO extra text):
Question text here?
A. Opt 1 B. Opt 2
C. Opt 3 D. Opt 4
ANSWER: A

Output Language MUST BE: ${language}.
Text to process:
${chunk}`;
            } else if (mode === 'fancy_oneliner') {
                sysInstruction = `Convert the following text into a fancy Q&A style.
Place the 🌟📚[TOPIC TITLE]📚🌟 header ONLY ONCE at the very top of the output.
Then for each question, use this EXACT pattern below the title:
➡️ Q : [Question Number] [The Question text]
✅ A : ==> [The Answer text]

IMPORTANT: Do NOT repeat the Title for each question. Use only one Title header for the whole content. Ensure double newlines between different entries.
Output Language MUST BE: ${language}.
Text to process:
${chunk}`;
            } else {
                sysInstruction = `Beautify and format the following text using ASCII icons, smileys, and colorful emojis. Make it highly attractive and readable as a concise one-liner note.
IMPORTANT: ALWAYS ensure there is a clear BLANK LINE (double newline) between questions, answers, and different points so they render correctly in Markdown. Do not let lines squish together!
${prompt_text ? 'Additional instructions: ' + prompt_text : ''}
${langInstruction}
Text to process:
${chunk}`;
            }

            const response = await safeGenerateContent(genAI, sysInstruction, customModel);
            finalOutput += response.text().trim() + '\n\n';
        }

        res.json({ result: finalOutput.trim() });

    } catch (error) {
        console.error('Process Document Error:', error);
        res.status(500).json({ error: 'Failed to process document: ' + error.message });
    }
};

// GET /ai/models
const listAvailableModels = async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(genAI));
        
        let models = [];
        let source = 'api';

        if (typeof genAI.listModels === 'function') {
            const modelList = await genAI.listModels();
            models = modelList.models
                .filter(m => m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name.replace('models/', ''));
        } else {
            source = 'fallback';
            models = [
                'gemini-2.5-flash',
                'gemini-2.5-pro',
                'gemini-1.5-flash-latest',
                'gemini-1.5-flash',
                'gemini-2.0-flash',
                'gemini-2.0-flash-exp',
                'gemini-1.5-pro-latest'
            ];
        }
        
        res.json({ models, source, methods });
    } catch (err) {
        res.json({ 
            models: ['gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-2.0-flash'],
            source: 'error_fallback',
            error: err.message
        });
    }
};

module.exports = { generateQuestions, enhanceText, processDocument, listAvailableModels };
