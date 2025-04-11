// backend-svc/src/index.ts
import express from 'express';
import { Pool } from 'pg';

const app = express();
console.log('Starting backend service...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // Important for RDS
});

// Test connection on startup
pool.connect()
  .then(client => {
    console.log('Database connected successfully');
    client.query('SELECT 1')
      .then(() => console.log('Test query successful'))
      .finally(() => client.release());
  })
  .catch(err => console.error('Database connection failed:', err));

app.get('/string', async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM strings WHERE id = 1');
    res.json({ string: result.rows[0]?.value });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: 'Database error', details: error });
  }
});

app.listen(3001, () => console.log('Backend service running on port 3001'));
