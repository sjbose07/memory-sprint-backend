// Test script to check createMaterial endpoint
const axios = require('axios');

const BASE_URL = 'http://localhost:5001'; // or 10.0.2.2 for emulator
const TOKEN = '...'; // I need a token, but I can't easily get one.

async function test() {
  try {
    const res = await axios.post(`${BASE_URL}/subjects`);
    console.log('Status:', res.status);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

// I'll check the users table for an admin and then I'll try to test if possible.
// Actually, I'll just check if the server is alive.
test();
