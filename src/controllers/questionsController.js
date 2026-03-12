const pool = require('../config/db');
const { parseQuestions, formatQuestionsToText } = require('../utils/questionParser');
const pdfParse = require('pdf-parse');

// GET /questions?chapter_id=...
const listQuestions = async (req, res) => {
    const { chapter_id, current_affair_id } = req.query;
    try {
        let query = `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
                        q.correct_option, q.explanation, q.created_at, q.chapter_id, q.current_affair_id,
                        c.name AS chapter_name, s.name AS subject_name, ca.title AS ca_title
                 FROM questions q
                 LEFT JOIN chapters c ON c.id = q.chapter_id
                 LEFT JOIN subjects s ON s.id = c.subject_id
                 LEFT JOIN current_affairs ca ON ca.id = q.current_affair_id`;
        const params = [];
        if (chapter_id) {
            params.push(chapter_id);
            query += ` WHERE q.chapter_id = $${params.length}`;
        } else if (current_affair_id) {
            params.push(current_affair_id);
            query += ` WHERE q.current_affair_id = $${params.length}`;
        }
        query += ' ORDER BY q.created_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /questions — single question
const createQuestion = async (req, res) => {
    const { chapter_id, current_affair_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation } = req.body;
    if ((!chapter_id && !current_affair_id) || !question_text || !option_a || !option_b || !option_c || !option_d || !correct_option) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!['A', 'B', 'C', 'D'].includes(correct_option.toUpperCase())) {
        return res.status(400).json({ error: 'correct_option must be A, B, C, or D' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO questions (chapter_id, current_affair_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [chapter_id || null, current_affair_id || null, question_text, option_a, option_b, option_c, option_d, correct_option.toUpperCase(), explanation || null, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /questions/bulk — parse text or PDF and insert many questions
const bulkUploadQuestions = async (req, res) => {
    const { chapter_id, current_affair_id, text_content } = req.body;
    if (!chapter_id && !current_affair_id) return res.status(400).json({ error: 'chapter_id or current_affair_id is required' });

    let rawText = text_content || '';

    // If file uploaded (PDF or .txt), extract text
    if (req.file) {
        try {
            if (req.file.mimetype === 'application/pdf') {
                const pdfData = await pdfParse(req.file.buffer);
                rawText = pdfData.text;
            } else {
                rawText = req.file.buffer.toString('utf-8');
            }
        } catch (e) {
            return res.status(400).json({ error: 'Failed to parse file: ' + e.message });
        } finally {
            // Memory Leak Fix: Explicitly clear the buffer from memory as soon as parsing is done
            req.file.buffer = null;
        }
    }

    if (!rawText.trim()) return res.status(400).json({ error: 'No content provided' });

    const parsed = parseQuestions(rawText);
    if (!parsed.length) {
        return res.status(400).json({ error: 'No valid questions found in content. Check format.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const inserted = [];
        for (const q of parsed) {
            const r = await client.query(
                `INSERT INTO questions (chapter_id, current_affair_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                [chapter_id || null, current_affair_id || null, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation || null, req.user.id]
            );
            inserted.push(r.rows[0].id);
        }
        await client.query('COMMIT');
        res.status(201).json({ inserted_count: inserted.length, question_ids: inserted });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// DELETE /questions/:id
const deleteQuestion = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM questions WHERE id = $1 RETURNING id', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Question not found' });
        res.json({ message: 'Question deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /questions/preview — parse only, return parsed questions without inserting
const previewQuestions = async (req, res) => {
    const { text_content } = req.body;
    let rawText = text_content || '';

    if (req.file) {
        try {
            if (req.file.mimetype === 'application/pdf') {
                const pdfData = await pdfParse(req.file.buffer);
                rawText = pdfData.text;
            } else {
                rawText = req.file.buffer.toString('utf-8');
            }
        } catch (e) {
            return res.status(400).json({ error: 'Failed to parse file: ' + e.message });
        } finally {
            // Memory Leak Fix: Explicitly clear the buffer from memory
            req.file.buffer = null;
        }
    }

    const parsed = parseQuestions(rawText);
    res.json({ count: parsed.length, questions: parsed });
};

// GET /questions/bulk-export/:chapterId
const bulkExportQuestions = async (req, res) => {
    const { chapterId } = req.params;
    try {
        const result = await pool.query(
            `SELECT question_text, option_a, option_b, option_c, option_d, correct_option, explanation
             FROM questions WHERE chapter_id = $1 OR current_affair_id = $1 ORDER BY created_at ASC`,
            [chapterId]
        );

        const formattedText = formatQuestionsToText(result.rows);
        res.json({ text_content: formattedText });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PUT /questions/bulk-sync/:chapterId
const bulkSyncQuestions = async (req, res) => {
    const { chapterId } = req.params;
    const { text_content } = req.body;

    if (!text_content || !text_content.trim()) {
        return res.status(400).json({ error: 'No content provided for sync' });
    }

    const parsed = parseQuestions(text_content);
    if (!parsed.length) {
        return res.status(400).json({ error: 'No valid questions found in content. Check format.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Delete existing questions
        await client.query('DELETE FROM questions WHERE chapter_id = $1 OR current_affair_id = $1', [chapterId]);

        // 2. Insert new questions
        const inserted = [];
        for (const q of parsed) {
            const r = await client.query(
                `INSERT INTO questions (chapter_id, current_affair_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                [null, // Handled by CA-specific logic if needed, but for now generic
                 chapterId, // Assuming it's a CA ID if we are syncing CA
                 q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation || null, req.user.id]
            );
            inserted.push(r.rows[0].id);
        }

        await client.query('COMMIT');
        res.status(200).json({ sync_count: inserted.length });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

module.exports = { listQuestions, createQuestion, bulkUploadQuestions, deleteQuestion, previewQuestions, bulkExportQuestions, bulkSyncQuestions };
