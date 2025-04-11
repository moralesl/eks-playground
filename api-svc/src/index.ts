import express from 'express';
import axios from 'axios';

const app = express();
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

app.get('/hello', async (req, res) => {
  try {
    const response = await axios.get(`${backendUrl}/string`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Service error' });
  }
});

app.listen(3000, () => {
  console.log('API service running on port 3000');
});
