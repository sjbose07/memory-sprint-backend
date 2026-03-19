const pool = require('./src/config/db');

async function seed() {
  const notices = [
    { type: 'SYSTEM_ERROR', title: 'Database Connection Timeout', message: 'Error: Connection to Neon DB timed out after 30s. Automatically reconnected.\nStack: Error: timeout\n    at Pool.query (node_modules/pg/lib/pool.js:123:45)' },
    { type: 'SERVER_EVENT', title: 'Graceful Restart Complete', message: 'The server was restarted on signal SIGTERM. All services are back online.' },
    { type: 'SECURITY_ALERT', title: 'Brute Force Attempt Blocked', message: 'Rate limiter triggered for IP 192.168.1.1. 50+ failed login attempts detected in 15 minutes.' },
    { type: 'SYSTEM_ERROR', title: 'Memory Usage High', message: 'Node.js heap usage exceeded 85% (435MB / 512MB). Triggering garbage collection.' },
    { type: 'SERVER_EVENT', title: 'Daily Cleanup Task', message: 'CRON: successfully deleted 124 expired test attempts and cleared cache.' }
  ];

  for (const n of notices) {
    await pool.query('INSERT INTO admin_notices (type, title, message) VALUES ($1, $2, $3)', [n.type, n.title, n.message]);
  }
  console.log('Done!');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
