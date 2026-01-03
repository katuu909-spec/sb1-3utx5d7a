// @ts-nocheck
import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export const config = { runtime: 'nodejs' };

interface Roi {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_ROI: Roi = { x: 0, y: 0, width: Number.MAX_SAFE_INTEGER, height: Number.MAX_SAFE_INTEGER };

function dataUrlToBuffer(dataUrl: string) {
  const base64 = dataUrl.replace(/^data:.*;base64,/, '');
  return Buffer.from(base64, 'base64');
}

function parseNumber(text: string): number | null {
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return Number.isFinite(num) ? num : null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { imageBase64, rois }: { imageBase64?: string; rois?: Roi[] } = req.body || {};

    if (!imageBase64) {
      res.status(400).json({ ok: false, error: 'imageBase64 is required' });
      return;
    }

    const buffer = dataUrlToBuffer(imageBase64);
    const meta = await sharp(buffer).metadata();
    const targetWidth = meta.width && meta.width < 1200 ? 1200 : meta.width || undefined;
    const resized = await sharp(buffer)
      .resize(targetWidth ? { width: targetWidth } : undefined)
      .grayscale()
      .normalize()
      .toBuffer();

    const scale = meta.width && targetWidth ? targetWidth / meta.width : 1;
    const regions: Roi[] = (rois?.length ? rois : [DEFAULT_ROI]).map((r) => ({
      x: Math.max(0, Math.round(r.x * scale)),
      y: Math.max(0, Math.round(r.y * scale)),
      width: Math.round((r.width === Number.MAX_SAFE_INTEGER ? (meta.width || 0) : r.width) * scale),
      height: Math.round((r.height === Number.MAX_SAFE_INTEGER ? (meta.height || 0) : r.height) * scale),
    }));

    const results: Array<{ text: string; value: number | null; confidence: number | null }> = [];
    for (const roi of regions) {
      const roiBuffer = await sharp(resized)
        .extract({
          left: roi.x,
          top: roi.y,
          width: Math.max(1, roi.width),
          height: Math.max(1, roi.height),
        })
        .threshold()
        .toBuffer();

      // Node 環境で addEventListener が未定義の場合のフォールバック（ブラウザAPI要求を無視）
      if (typeof (globalThis as any).addEventListener !== 'function') {
        (globalThis as any).addEventListener = () => {};
      }

      // tesseract.js 2.x の Node 用ワーカーとコアを使用
      const workerPath = require.resolve('tesseract.js/dist/node/worker.js');
      let corePath: string;
      try {
        corePath = require.resolve('tesseract.js-core/tesseract-core.wasm');
      } catch {
        try {
          corePath = require.resolve('tesseract.js-core/tesseract-core-simd.wasm');
        } catch {
          corePath = 'https://unpkg.com/tesseract.js-core@2.2.0/tesseract-core.wasm';
        }
      }
      const langPath = 'https://tessdata.projectnaptha.com/5/tessdata_fast';

      const {
        data: { text, confidence },
      } = await Tesseract.recognize(roiBuffer, 'eng', {
        tessedit_pageseg_mode: 7, // single line
        tessedit_char_whitelist: '0123456789.-',
        workerPath,
        corePath,
        langPath,
      } as any);

      results.push({
        text: text.trim(),
        value: parseNumber(text),
        confidence,
      });
    }

    res.status(200).json({ ok: true, results });
  } catch (error: any) {
    console.error('OCR error', error);
    res.status(500).json({ ok: false, error: error?.message || 'ocr_failed' });
  }
}

