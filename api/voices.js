/**
 * GET /api/voices
 * Returns the user's Minimax voice library + available models
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Minimax API key not configured' });

  try {
    const voicesRes = await fetch('https://api.minimax.io/v1/get_voice', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ voice_type: 'all' }),
    });

    if (!voicesRes.ok) {
      const err = await voicesRes.text();
      return res.status(502).json({ error: 'Minimax voices error', detail: err });
    }

    const data = await voicesRes.json();

    if (data.base_resp?.status_code !== 0) {
      return res.status(502).json({ error: data.base_resp?.status_msg ?? 'Minimax error' });
    }

    const voices = [
      // User's cloned voices first
      ...(data.voice_cloning ?? []).map(v => ({
        voice_id:  v.voice_id,
        name:      v.description || v.voice_id,
        category:  'cloned',
      })),
      // User's generated voices
      ...(data.voice_generation ?? []).map(v => ({
        voice_id:  v.voice_id,
        name:      v.description || v.voice_id,
        category:  'generated',
      })),
      // System voices — filter to English first, then others
      ...(data.system_voice ?? [])
        .map(v => ({
          voice_id:  v.voice_id,
          name:      v.voice_name || v.voice_id,
          category:  'system',
          language:  v.voice_id.split('_')[0], // e.g. "English", "Spanish"
        }))
        .sort((a, b) => {
          // English voices at top of system group
          if (a.language === 'English' && b.language !== 'English') return -1;
          if (b.language === 'English' && a.language !== 'English') return 1;
          return a.name.localeCompare(b.name);
        }),
    ];

    // Minimax models available for TTS
    const models = [
      { model_id: 'speech-02-hd',     name: 'Speech 02 HD — Best Quality' },
      { model_id: 'speech-02-turbo',  name: 'Speech 02 Turbo — Fast' },
      { model_id: 'speech-2.6-hd',    name: 'Speech 2.6 HD' },
      { model_id: 'speech-2.6-turbo', name: 'Speech 2.6 Turbo' },
      { model_id: 'speech-2.8-hd',    name: 'Speech 2.8 HD — Latest' },
      { model_id: 'speech-2.8-turbo', name: 'Speech 2.8 Turbo — Latest Fast' },
    ];

    return res.status(200).json({ voices, models });

  } catch (err) {
    console.error('Voices handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
