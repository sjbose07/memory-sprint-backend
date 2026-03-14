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
    const blocks = text.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);

    for (const block of blocks) {
        const fullText = block.trim();
        
        // Find answer
        const ansMatch = fullText.match(/\bANSWER\s*:\s*([A-D])/i);
        if (!ansMatch) continue;
        const correctOption = ansMatch[1].toUpperCase();

        // Find explanation
        let explanation = '';
        const expMatch = fullText.match(/\bEXPLANATION\s*:\s*([\s\S]*)$/i);
        if (expMatch) {
            explanation = expMatch[1].trim();
        }

        // Clean out ANSWER and EXPLANATION
        let cleaned = fullText.replace(/\bANSWER\s*:\s*[A-D]/i, '').replace(/\bEXPLANATION\s*:[\s\S]*$/i, '').trim();

        // Find A. B. C. D.
        const aMatch = /(?:^|\s)A\.\s/i.exec(cleaned);
        const bMatch = /(?:^|\s)B\.\s/i.exec(cleaned);
        const cMatch = /(?:^|\s)C\.\s/i.exec(cleaned);
        const dMatch = /(?:^|\s)D\.\s/i.exec(cleaned);

        if (!aMatch || !bMatch || !cMatch || !dMatch) continue;

        // Ensure indices extract smoothly from start of matched dot
        const aIndex = aMatch.index + aMatch[0].toUpperCase().indexOf('A');
        const bIndex = bMatch.index + bMatch[0].toUpperCase().indexOf('B');
        const cIndex = cMatch.index + cMatch[0].toUpperCase().indexOf('C');
        const dIndex = dMatch.index + dMatch[0].toUpperCase().indexOf('D');

        if (!(aIndex < bIndex && bIndex < cIndex && cIndex < dIndex)) continue;

        const questionText = cleaned.substring(0, aIndex).trim();
        const optionA = cleaned.substring(aIndex + 2, bIndex).trim().replace(/^\.*|\.*$/g, '').trim();
        const optionB = cleaned.substring(bIndex + 2, cIndex).trim().replace(/^\.*|\.*$/g, '').trim();
        const optionC = cleaned.substring(cIndex + 2, dIndex).trim().replace(/^\.*|\.*$/g, '').trim();
        const optionD = cleaned.substring(dIndex + 2).trim().replace(/^\.*|\.*$/g, '').trim();

        if (!questionText || !optionA || !optionB || !optionC || !optionD) continue;

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
