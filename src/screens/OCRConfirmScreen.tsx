// @ts-nocheck
import React, { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { ArrowLeft, AlertCircle } from 'lucide-react';

async function resizeDataUrl(dataUrl: string, maxWidth = 1200, quality = 0.8) {
  return new Promise<{ dataUrl: string; width: number; height: number; scale: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const targetWidth = Math.round(img.width * scale);
      const targetHeight = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      resolve({
        dataUrl: canvas.toDataURL('image/jpeg', quality),
        width: targetWidth,
        height: targetHeight,
        scale,
      });
    };
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}

function clampRoi(roi: { x: number; y: number; width: number; height: number }, maxW: number, maxH: number) {
  const x = Math.max(0, Math.min(roi.x, maxW));
  const y = Math.max(0, Math.min(roi.y, maxH));
  const width = Math.max(1, Math.min(roi.width, maxW - x));
  const height = Math.max(1, Math.min(roi.height, maxH - y));
  return { x, y, width, height };
}

async function cropDataUrl(base64: string, roi: { x: number; y: number; width: number; height: number }) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = roi.width;
      canvas.height = roi.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, roi.x, roi.y, roi.width, roi.height, 0, 0, roi.width, roi.height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = (e) => reject(e);
    img.src = base64;
  });
}

export function OCRConfirmScreen() {
  // 最小サイズは小さすぎない程度に確保しつつ、ドラッグ範囲はユーザー任せ
  const MIN_ROI_SIZE = 32;
  const DEFAULT_ROI_RATIO = { w: 0.7, h: 0.3 }; // 画像に対するデフォルト比率

  const [aveWindSpeed, setAveWindSpeed] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrValue, setOcrValue] = useState<number | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [roi, setRoi] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const {
    currentMeasurementPoint,
    currentPhotoData,
    measurementSession,
    setMeasurementSession,
    setCurrentScreen,
    setCurrentPhotoData,
  } = useApp();

  const handleSave = async () => {
    setError('');

    if (!aveWindSpeed) {
      setError('AVE風速を入力してください');
      return;
    }

    const windSpeed = parseFloat(aveWindSpeed);
    if (isNaN(windSpeed) || windSpeed < 0) {
      setError('有効な風速値を入力してください');
      return;
    }

    if (!currentMeasurementPoint || !currentPhotoData) return;

    setSaving(true);

    try {
      const fileName = `${currentMeasurementPoint.id}/${Date.now()}.jpg`;
      const blob = await fetch(currentPhotoData).then((res) => res.blob());

      const { error: uploadError } = await supabase.storage
        .from('measurement-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('measurement-images').getPublicUrl(fileName);

      const currentReadings = measurementSession?.readings || [];
      const pointNumber = currentReadings.length + 1;

      const { data: reading, error: insertError } = await supabase
        .from('measurement_readings')
        .insert([
          {
            measurement_point_id: currentMeasurementPoint.id,
            point_number: pointNumber,
            image_url: publicUrl,
            ave_wind_speed: windSpeed,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      const updatedReadings = [...currentReadings, reading];
      setMeasurementSession({
        projectId: currentMeasurementPoint.project_id,
        pointId: currentMeasurementPoint.id,
        pointNumber: pointNumber + 1,
        totalPoints: currentMeasurementPoint.target_point_count,
        readings: updatedReadings,
      });

      setCurrentPhotoData(null);

      if (pointNumber >= currentMeasurementPoint.target_point_count) {
        await supabase
          .from('measurement_points')
          .update({ is_completed: true })
          .eq('id', currentMeasurementPoint.id);

        setCurrentScreen('results');
      } else {
        setCurrentScreen('shooting');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (confirm('入力内容は破棄されます。よろしいですか？')) {
      setCurrentPhotoData(null);
      setCurrentScreen('shooting');
    }
  };

  const normalizeRoi = (
    roiRaw: { x: number; y: number; width: number; height: number },
    containerW: number,
    containerH: number
  ) => {
    return clampRoi(
      {
        x: roiRaw.x,
        y: roiRaw.y,
        width: Math.max(MIN_ROI_SIZE, roiRaw.width),
        height: Math.max(MIN_ROI_SIZE, roiRaw.height),
      },
      containerW,
      containerH
    );
  };

  const setRoiAroundPoint = (
    pointInContainer: { x: number; y: number },
    containerSize: { w: number; h: number },
    ratio = DEFAULT_ROI_RATIO
  ) => {
    const width = Math.max(MIN_ROI_SIZE, containerSize.w * ratio.w);
    const height = Math.max(MIN_ROI_SIZE, containerSize.h * ratio.h);
    const roiRaw = {
      x: pointInContainer.x - width / 2,
      y: pointInContainer.y - height / 2,
      width,
      height,
    };
    setRoi(normalizeRoi(roiRaw, containerSize.w, containerSize.h));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (saving || ocrLoading) return;
    if (activePointerId !== null && activePointerId !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setStartPoint(point);
    setRoi({ x: point.x, y: point.y, width: 1, height: 1 });
    setIsSelecting(true);
    setActivePointerId(e.pointerId);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSelecting || !startPoint) return;
    if (activePointerId !== null && activePointerId !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const x = Math.min(startPoint.x, current.x);
    const y = Math.min(startPoint.y, current.y);
    const width = Math.abs(current.x - startPoint.x);
    const height = Math.abs(current.y - startPoint.y);
    setRoi({ x, y, width, height });
    e.preventDefault();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId !== null && activePointerId !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();

    // ドラッグ範囲をそのまま採用し、最小サイズ＆境界内にクランプ
    if (roi) {
      const normalized = normalizeRoi(
        {
          x: roi.x,
          y: roi.y,
          width: Math.max(1, roi.width),
          height: Math.max(1, roi.height),
        },
        rect.width,
        rect.height
      );
      setRoi(normalized);
    }

    setIsSelecting(false);
    setStartPoint(null);
    setActivePointerId(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const resetRoi = () => {
    setRoi(null);
    setOcrValue(null);
    setOcrConfidence(null);
  };

  const runOcr = async () => {
    if (!currentPhotoData) return;
    setError('');
    setOcrValue(null);
    setOcrConfidence(null);
    setOcrLoading(true);

    try {
      // 画像を送る前にクライアント側でリサイズ（短辺1200px程度に圧縮）
      const resized = await resizeDataUrl(currentPhotoData, 1200, 0.8);

      const img = imgRef.current;
      const container = containerRef.current;
      if (!img || !container) throw new Error('画像が読み込まれていません');

      const displayRect = container.getBoundingClientRect();

      let targetRoi = roi;
      if (!targetRoi) {
        // デフォルト: 画像中央を幅70%, 高さ30%で切り出す
        const base = {
          x: displayRect.width * 0.15,
          y: displayRect.height * 0.35,
          width: Math.max(MIN_ROI_SIZE, displayRect.width * DEFAULT_ROI_RATIO.w),
          height: Math.max(MIN_ROI_SIZE, displayRect.height * DEFAULT_ROI_RATIO.h),
        };
        targetRoi = clampRoi(base, displayRect.width, displayRect.height);
        setRoi(targetRoi);
      }

      const scaleX = resized.width / displayRect.width;
      const scaleY = resized.height / displayRect.height;

      const roiScaled = clampRoi(
        {
          x: Math.round(targetRoi.x * scaleX),
          y: Math.round(targetRoi.y * scaleY),
          width: Math.round(targetRoi.width * scaleX),
          height: Math.round(targetRoi.height * scaleY),
        },
        resized.width,
        resized.height
      );

      // ROI 部分を切り出してクライアントサイドで OCR 実行
      const roiDataUrl = await cropDataUrl(resized.dataUrl, roiScaled);
      const { default: Tesseract } = await import('tesseract.js');
      // langPath はディレクトリを指定すると、内部で "eng.traineddata.gz" が連結される
      const langPathLocal = `${window.location.origin}/tessdata`;

      const {
        data: { text, confidence },
      } = await Tesseract.recognize(roiDataUrl, 'eng', {
        workerPath: 'https://unpkg.com/tesseract.js@4.0.2/dist/worker.min.js',
        // corePath: wasm本体を読み込むJSラッパー（.wasm.js）を指定し、MIME問題を回避
        corePath: 'https://unpkg.com/tesseract.js-core@4.0.2/tesseract-core-simd.wasm.js',
        // オフライン運用: public/tessdata に eng.traineddata.gz を配置（langPath + /eng.traineddata.gz を内部で組み立て）
        langPath: langPathLocal,
        tessedit_pageseg_mode: 7, // single line
        tessedit_char_whitelist: '0123456789.-',
      } as any);

      const value = parseFloat((text.match(/-?\d+(?:\.\d+)?/) || [])[0] || '');
      if (Number.isNaN(value)) {
        setError('OCRは実行されましたが数値を抽出できませんでした。範囲を調整するか再撮影してください。');
      } else {
        setOcrValue(value);
        setOcrConfidence(confidence ?? null);
        setAveWindSpeed(value.toFixed(2));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OCRに失敗しました';
      if (msg.includes('traineddata') || msg.includes('404') || msg.includes('Network error')) {
        setError('OCRモデルファイルが読み込めませんでした。public/tessdata/eng.traineddata.gz を配置してください。');
      } else {
        setError(msg);
      }
    } finally {
      setOcrLoading(false);
    }
  };

  if (!currentMeasurementPoint || !currentPhotoData) {
    return null;
  }

  const currentReadingCount = measurementSession?.readings?.length || 0;
  const pointNumber = currentReadingCount + 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
            disabled={saving}
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900">測定値入力</h1>
          <p className="text-sm text-gray-600 mt-2">
            {currentMeasurementPoint.name} - 測定点 {pointNumber}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">撮影画像</p>
            <div
              className="bg-black rounded-lg overflow-hidden relative select-none"
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
              style={{ touchAction: 'none' }}
            >
              <img
                ref={imgRef}
                src={currentPhotoData}
                alt="測定画像"
                className="w-full h-auto block"
                draggable={false}
              />
              {roi && (
                <div
                  className="absolute border-2 border-blue-400 bg-blue-200/20 rounded"
                  style={{
                    left: `${roi.x}px`,
                    top: `${roi.y}px`,
                    width: `${roi.width}px`,
                    height: `${roi.height}px`,
                  }}
                />
              )}
              {isSelecting && (
                <div className="absolute inset-0 bg-blue-200/10 pointer-events-none" />
              )}
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-100 text-blue-900 rounded-lg p-4 text-sm leading-relaxed">
              <p className="font-semibold mb-2">OCRをかける位置を教えてください</p>
              <ul className="list-disc list-inside space-y-1">
                <li>読み取りたい数値の「範囲」を決めてください（数値部分だけを囲むイメージ）。</li>
                <li>範囲が決まったら「この範囲で読み取る」ボタンを押してOCRを実行してください。</li>
                <li>読み取りがうまくいかない場合は、再撮影または範囲を調整してください。</li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:bg-gray-400"
                  onClick={runOcr}
                  disabled={saving || ocrLoading}
                >
                  {ocrLoading ? '読み取り中...' : 'この範囲で読み取る'}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border border-blue-200 text-blue-800 text-sm font-semibold rounded-lg hover:bg-blue-50 transition disabled:bg-gray-100"
                  onClick={resetRoi}
                  disabled={saving || ocrLoading}
                >
                  範囲をリセット
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border border-blue-200 text-blue-800 text-sm font-semibold rounded-lg hover:bg-blue-50 transition disabled:bg-gray-100"
                  onClick={() => {
                    const container = containerRef.current;
                    if (!container) return;
                    const rect = container.getBoundingClientRect();
                    setRoiAroundPoint(
                      { x: rect.width / 2, y: rect.height / 2 },
                      { w: rect.width, h: rect.height },
                      DEFAULT_ROI_RATIO
                    );
                  }}
                  disabled={saving || ocrLoading}
                  title="中央に自動設定"
                >
                  中央を自動選択
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border border-blue-200 text-blue-800 text-sm font-semibold rounded-lg hover:bg-blue-50 transition disabled:bg-gray-100"
                  onClick={() => {
                    const container = containerRef.current;
                    if (!container) return;
                    const rect = container.getBoundingClientRect();
                    setRoiAroundPoint(
                      { x: rect.width / 2, y: rect.height * 0.25 },
                      { w: rect.width, h: rect.height },
                      { w: 0.6, h: 0.25 }
                    );
                  }}
                  disabled={saving || ocrLoading}
                  title="上部を読む"
                >
                  上部を自動選択
                </button>
              </div>
              {ocrValue !== null && (
                <p className="text-xs text-blue-800 mt-2">
                  OCR結果: {ocrValue.toFixed(2)} (信頼度 {ocrConfidence !== null ? ocrConfidence.toFixed(1) : '-'} )
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="aveWindSpeed" className="block text-sm font-medium text-gray-700 mb-2">
              AVE風速 (m/s)
            </label>
            <input
              id="aveWindSpeed"
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              value={aveWindSpeed}
              onChange={(e) => setAveWindSpeed(e.target.value)}
              disabled={saving}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-lg"
              placeholder="0.00"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              測定値を入力してください
            </p>
          </div>

          <div className="flex gap-4 mt-8">
            <button
              onClick={handleBack}
              disabled={saving}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:bg-gray-100"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>

          {pointNumber < currentMeasurementPoint.target_point_count && (
            <p className="text-center text-sm text-gray-600 mt-4">
              保存後、次の測定点（{pointNumber + 1}/{currentMeasurementPoint.target_point_count}）に進みます
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
