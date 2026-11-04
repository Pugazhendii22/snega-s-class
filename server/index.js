import express from 'express';
import { renderParentMessage } from '../shared/messages.js';

const app = express();
const PORT = Number(process.env.API_PORT || 4101);
const demoMode = process.env.DEMO_MODE !== 'false';

app.disable('x-powered-by');
app.use(express.json({ limit: '24kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'class-teacher-api',
    mode: demoMode ? 'demo' : 'configured',
    messagingEnabled: false,
    note: 'Preview API only. No message-send endpoint is enabled.',
  });
});

app.post('/api/messages/preview', (req, res) => {
  try {
    const draft = renderParentMessage(req.body ?? {});
    res.json({ draft, sendEnabled: false, channel: null });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid preview request' });
  }
});

// Intentionally no endpoint for sending parent messages in this first slice.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Class Teacher API listening on 127.0.0.1:${PORT} (demo=${demoMode}; messaging=OFF)`);
});
