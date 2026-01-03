import React, { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export function OCRConfirmScreen() {
  const [aveWindSpeed, setAveWindSpeed] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrValue, setOcrValue] = useState<number | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [roi, setRoi] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
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
      const base64Data = currentPhotoData.split(',')[1];
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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (saving || ocrLoading) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setStartPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !startPoint) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const x = Math.min(startPoint.x, current.x);
    const y = Math.min(startPoint.y, current.y);
    const width = Math.abs(current.x - startPoint.x);
    const height = Math.abs(current.y - startPoint.y);
    setRoi({ x, y, width, height });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setStartPoint(null);
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
      const img = imgRef.current;
      const container = containerRef.current;
      if (!img || !container) throw new Error('画像が読み込まれていません');

      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const displayRect = container.getBoundingClientRect();

      let targetRoi = roi;
      if (!targetRoi) {
        // デフォルト: 画像中央を幅80%, 高さ40%で切り出す
        targetRoi = {
          x: displayRect.width * 0.1,
          y: displayRect.height * 0.3,
          width: displayRect.width * 0.8,
          height: displayRect.height * 0.4,
        };
        setRoi(targetRoi);
      }

      const scaleX = naturalWidth / displayRect.width;
      const scaleY = naturalHeight / displayRect.height;

      const payload = {
        imageBase64: currentPhotoData,
        rois: [
          {
            x: Math.max(0, Math.round(targetRoi.x * scaleX)),
            y: Math.max(0, Math.round(targetRoi.y * scaleY)),
            width: Math.max(1, Math.round(targetRoi.width * scaleX)),
            height: Math.max(1, Math.round(targetRoi.height * scaleY)),
          },
        ],
      };

      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'OCRに失敗しました');

      const first = data.results?.[0];
      if (!first || first.value == null) {
        setError('数値を読み取れませんでした。範囲を調整するか再撮影してください。');
      } else {
        setOcrValue(first.value);
        setOcrConfidence(first.confidence ?? null);
        setAveWindSpeed(first.value.toFixed(2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCRに失敗しました');
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
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img ref={imgRef} src={currentPhotoData} alt="測定画像" className="w-full h-auto block" />
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
