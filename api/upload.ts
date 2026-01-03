import { createClient } from '@supabase/supabase-js';

const BUCKET = 'measurement-images';

function dataUrlToBuffer(dataUrl: string) {
  const [, meta, base64] = dataUrl.match(/^data:(.*);base64,(.*)$/) || [];
  if (!base64) throw new Error('Invalid data URL');
  return { buffer: Buffer.from(base64, 'base64'), contentType: meta || 'application/octet-stream' };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { path, dataUrl }: { path?: string; dataUrl?: string } = req.body || {};
  if (!path || !dataUrl) {
    res.status(400).json({ ok: false, error: 'path and dataUrl are required' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ ok: false, error: 'Supabase server env not configured' });
    return;
  }

  try {
    const { buffer, contentType } = dataUrlToBuffer(dataUrl);
    const supabase = createClient(supabaseUrl, serviceKey);
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType,
      upsert: true,
    });

    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

    res.status(200).json({ ok: true, path, publicUrl: data.publicUrl });
  } catch (error: any) {
    console.error('Upload error', error);
    res.status(500).json({ ok: false, error: error?.message || 'upload_failed' });
  }
}

