import express from 'express';
import { Pool } from 'pg';

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.get('/string', async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM strings WHERE id = 1');
    res.json({ string: result.rows[0].value });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(3001, () => {
  console.log('Backend service running on port 3001');
});
