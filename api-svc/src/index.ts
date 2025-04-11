import express from 'express';
import axios from 'axios';

const app = express();
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

app.get('/hello', async (req, res) => {
  try {
    console.log(`Calling backend at: ${backendUrl}/string`);
    const response = await axios.get(`${backendUrl}/string`);
    console.log('Backend response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error calling backend:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
    }
    res.status(500).json({ error: 'Service error', details: error });
  }
});

app.listen(3000, () => {
  console.log('API service running on port 3000');
  console.log('Backend URL:', backendUrl);
});
