const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({path: __dirname + '/.env'});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent('hello');
    console.log('SUCCESS 2.5:', result.response.text().trim());
  } catch(e) {
    console.error('ERROR 2.5:', e.message);
  }
  
  try {
    const model2 = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result2 = await model2.generateContent('hello');
    console.log('SUCCESS 2.0:', result2.response.text().trim());
  } catch(e) {
    console.error('ERROR 2.0:', e.message);
  }
}

test();
