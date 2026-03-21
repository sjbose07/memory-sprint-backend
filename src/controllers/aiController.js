const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');

// POST /ai/generate
const generateQuestions = async (req, res) => {
    const { chapter_id, text_content, count = 5, language = "English" } = req.body;

    if (!chapter_id || !text_content) {
        return res.status(400).json({ error: 'chapter_id and text_content are required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
            You are an expert MCQ creator. Generate ${count} multiple choice questions from the following text content.
            IMPORTANT: The questions, options, and explanations MUST all be written in the following language: ${language}.
            
            The format must be a raw JSON array of objects, with NO markdown formatting (no \`\`\`json blocks), just the raw JSON.
            Each object must have these fields:
            - question_text: The question string (in ${language})
            - option_a: First option string (in ${language})
            - option_b: Second option string (in ${language})
            - option_c: Third option string (in ${language})
            - option_d: Fourth option string (in ${language})
            - correct_option: Only the letter A, B, C, or D (always use English letters A, B, C, D to denote the option)
            - explanation: A brief explanation of why that answer is correct (in ${language})

            CONTENT:
            ${text_content}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Clean up response if it contains markdown markers
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const questions = JSON.parse(text);

        // Optional: Save to DB immediately or return for preview
        // For now, let's return for preview as per android logic
        res.json({ questions });

    } catch (err) {
        console.error('AI Generation Error:', err);
        res.status(500).json({ error: 'Failed to generate questions: ' + err.message });
    }
};

// POST /ai/enhance
const enhanceText = async (req, res) => {
    const { text_content, language = "English" } = req.body;

    if (!text_content) {
        return res.status(400).json({ error: 'text_content is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
            You are an expert editor and fact-checker. Please review and enhance the following text.
            1. Format the text beautifully using Markdown (bold, headers, bullet points).
            2. Make it highly readable and visually attractive.
            3. Insert relevant emojis or ASCII icons to make it engaging.
            4. FACT-CHECK the content: If there are any factual errors in the content, correct them seamlessly or naturally integrate the correct facts.
            5. The final output MUST be in the following language: ${language}.
            6. Return ONLY the enhanced markdown text, without any additional conversational filler like "Here is the enhanced text".

            CONTENT TO ENHANCE:
            ${text_content}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const enhanced_text = response.text().trim();

        res.json({ enhanced_text });

    } catch (err) {
        console.error('AI Enhance Error:', err);
        res.status(500).json({ error: 'Failed to enhance text: ' + err.message });
    }
};

module.exports = { generateQuestions, enhanceText };
