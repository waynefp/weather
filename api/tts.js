/**
 * POST /api/tts
 * Body: { text: string, voice_id?: string }
 * Returns: { audio_base64: string, content_type: string }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, voice_id = '21m00Tcm4TlvDq8ikWAM', model_id = 'eleven_multilingual_v2' } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ElevenLabs API key not configured' });

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.80,
          style: 0.25,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('ElevenLabs error:', err);
      return res.status(502).json({ error: 'ElevenLabs error', detail: err });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString('base64');

    return res.status(200).json({ audio_base64: base64, content_type: 'audio/mpeg' });

  } catch (err) {
    console.error('TTS handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
