/**
 * GET /api/voices
 * Returns the user's full ElevenLabs voice library
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ElevenLabs API key not configured' });

  try {
    const [voicesRes, modelsRes] = await Promise.all([
      fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey },
      }),
      fetch('https://api.elevenlabs.io/v1/models', {
        headers: { 'xi-api-key': apiKey },
      }),
    ]);

    if (!voicesRes.ok) {
      const err = await voicesRes.text();
      return res.status(502).json({ error: 'ElevenLabs voices error', detail: err });
    }

    const voicesData = await voicesRes.json();
    const modelsData = modelsRes.ok ? await modelsRes.json() : { models: [] };

    // Sort: cloned/professional voices first, then premade
    const voices = (voicesData.voices ?? [])
      .map(v => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,              // 'cloned' | 'professional' | 'premade' | 'generated'
        labels: v.labels ?? {},
        preview_url: v.preview_url ?? null,
      }))
      .sort((a, b) => {
        const order = { cloned: 0, professional: 1, generated: 2, premade: 3 };
        return (order[a.category] ?? 9) - (order[b.category] ?? 9);
      });

    // Only return TTS-capable models
    const models = (modelsData.models ?? [])
      .filter(m => m.can_do_text_to_speech)
      .map(m => ({ model_id: m.model_id, name: m.name }));

    return res.status(200).json({ voices, models });

  } catch (err) {
    console.error('Voices handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
