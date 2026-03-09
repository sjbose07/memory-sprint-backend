/**
 * Question Parser Utility
 * Parses text content following this pattern:
 *
 * Question text?
 * A. option text  B. option text  C. option text  D. option text
 * ANSWER: A
 *
 * (blank line separates questions)
 */

function parseQuestions(text) {
    const questions = [];
    const blocks = text
        .replace(/\r\n/g, '\n')
        .trim()
        .split(/\n{2,}/);  // split by blank lines

    for (const block of blocks) {
        const lines = block.trim().split('\n').filter(l => l.trim());
        if (lines.length < 3) continue;

        // Find ANSWER: line
        const answerLine = lines.find(l => /^ANSWER\s*:/i.test(l));
        if (!answerLine) continue;

        const correctOption = answerLine.replace(/^ANSWER\s*:\s*/i, '').trim().toUpperCase();
        if (!['A', 'B', 'C', 'D'].includes(correctOption)) continue;

        // Question text is everything before the options line and answer line
        const optionsLineIndex = lines.findIndex(l =>
            /\bA\.\s+.+\bB\.\s+.+\bC\.\s+.+\bD\.\s+/i.test(l) ||
            /^A\.\s+/i.test(l)
        );

        if (optionsLineIndex === -1) continue;

        const questionText = lines.slice(0, optionsLineIndex).join(' ').trim();
        const optionsLine = lines[optionsLineIndex];

        // Parse options — supports same line: "A. opt  B. opt  C. opt  D. opt"
        const optPattern = /A\.\s*(.*?)\s+B\.\s*(.*?)\s+C\.\s*(.*?)\s+D\.\s*(.*?)(?:\s+ANSWER|$)/i;
        const match = optionsLine.match(optPattern);

        let optionA, optionB, optionC, optionD;

        if (match) {
            optionA = match[1].trim();
            optionB = match[2].trim();
            optionC = match[3].trim();
            optionD = match[4].trim();
        } else {
            // Try multi-line options
            const optLines = lines.filter(l => /^[A-D]\.\s+/i.test(l));
            if (optLines.length < 4) continue;
            optionA = optLines[0].replace(/^A\.\s+/i, '').trim();
            optionB = optLines[1].replace(/^B\.\s+/i, '').trim();
            optionC = optLines[2].replace(/^C\.\s+/i, '').trim();
            optionD = optLines[3].replace(/^D\.\s+/i, '').trim();
        }

        if (!questionText || !optionA || !optionB || !optionC || !optionD) continue;

        // Parse explanation (optional)
        const expLineIndex = lines.findIndex(l => /^EXPLANATION\s*:/i.test(l));
        let explanation = '';
        if (expLineIndex !== -1) {
            explanation = lines.slice(expLineIndex).join('\n').replace(/^EXPLANATION\s*:\s*/i, '').trim();
        }

        questions.push({
            question_text: questionText,
            option_a: optionA,
            option_b: optionB,
            option_c: optionC,
            option_d: optionD,
            correct_option: correctOption,
            explanation: explanation || null,
        });
    }

    return questions;
}

function formatQuestionsToText(questions) {
    return questions.map(q => {
        let text = `${q.question_text}\n`;
        text += `A. ${q.option_a}\nB. ${q.option_b}\nC. ${q.option_c}\nD. ${q.option_d}\n`;
        text += `ANSWER: ${q.correct_option}`;
        if (q.explanation) {
            text += `\nEXPLANATION: ${q.explanation}`;
        }
        return text;
    }).join('\n\n');
}

module.exports = { parseQuestions, formatQuestionsToText };
