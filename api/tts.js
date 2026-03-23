/**
 * POST /api/tts
 * Body: { text: string, voice_id?: string, model_id?: string }
 * Returns: { audio_base64: string, content_type: string }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    text,
    voice_id = 'English_expressive_narrator',
    model_id  = 'speech-02-hd',
  } = req.body;

  if (!text) return res.status(400).json({ error: 'Missing text' });

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Minimax API key not configured' });

  try {
    const response = await fetch('https://api.minimax.io/v1/t2a_v2', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model_id,
        text,
        voice_setting: {
          voice_id,
          speed: 1.0,
          vol:   1.0,
          pitch: 0,
        },
        audio_setting: {
          sample_rate: 44100,
          bitrate:     128000,
          format:      'mp3',
          channel:     1,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Minimax HTTP error:', err);
      return res.status(502).json({ error: 'Minimax API error', detail: err });
    }

    const data = await response.json();

    // Minimax returns status_code 0 for success
    if (data.base_resp?.status_code !== 0) {
      const msg = data.base_resp?.status_msg ?? 'Unknown Minimax error';
      console.error('Minimax status error:', msg);
      return res.status(502).json({ error: msg });
    }

    const hexAudio = data.data?.audio;
    if (!hexAudio) {
      return res.status(502).json({ error: 'No audio data in Minimax response' });
    }

    // Convert hex → Buffer → base64 for the browser
    const base64 = Buffer.from(hexAudio, 'hex').toString('base64');

    return res.status(200).json({ audio_base64: base64, content_type: 'audio/mpeg' });

  } catch (err) {
    console.error('TTS handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
