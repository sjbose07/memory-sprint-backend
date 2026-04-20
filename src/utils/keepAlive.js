const axios = require('axios');
const cron = require('node-cron');

const startKeepAlive = (port) => {
  const url = `http://localhost:${port}/health`;
  
  // Every 3 hours, ping itself
  cron.schedule('0 */3 * * *', async () => {
    try {
      console.log(`⏱️ Self-pinging health endpoint: ${url}`);
      await axios.get(url);
    } catch (err) {
      console.warn('⚠️ Keep-alive ping failed:', err.message);
    }
  });

  console.log('🚀 Anti-sleep (Keep-alive) service scheduled (every 3 hrs)');
};

module.exports = { startKeepAlive };
