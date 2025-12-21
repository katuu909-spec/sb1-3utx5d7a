import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export function OCRConfirmScreen() {
  const [aveWindSpeed, setAveWindSpeed] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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
            <div className="bg-black rounded-lg overflow-hidden">
              <img src={currentPhotoData} alt="測定画像" className="w-full h-auto" />
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
              type="number"
              step="0.01"
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
