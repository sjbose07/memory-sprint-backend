const axios = require('axios');

async function test() {
    try {
        const res = await axios.get('http://localhost:3000/home/summary', {
            headers: {
                // Mock a valid token if needed, or just see if it is a 401
                'Authorization': 'Bearer YOUR_TOKEN' 
            }
        });
        console.log('Success:', res.data);
    } catch (err) {
        console.log('Error:', err.response ? err.response.data : err.message);
    }
}
// test();
