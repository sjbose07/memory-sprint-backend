const axios = require('axios');
const cron = require('node-cron');

const startKeepAlive = (port) => {
  const url = `http://localhost:${port}/health`;
  
  // Every 10 minutes, ping itself
  cron.schedule('*/10 * * * *', async () => {
    try {
      console.log(`⏱️ Self-pinging health endpoint: ${url}`);
      await axios.get(url);
    } catch (err) {
      console.warn('⚠️ Keep-alive ping failed:', err.message);
    }
  });

  console.log('🚀 Anti-sleep (Keep-alive) service scheduled (every 10 mins)');
};

module.exports = { startKeepAlive };
