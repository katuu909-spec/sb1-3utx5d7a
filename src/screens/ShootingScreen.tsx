import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Camera, Repeat2, Trash2 } from 'lucide-react';
import type { MeasurementReading } from '../types';

export function ShootingScreen() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [readings, setReadings] = useState<MeasurementReading[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentMeasurementPoint, measurementSession, setCurrentPhotoData, setCurrentScreen, setMeasurementSession } = useApp();

  useEffect(() => {
    loadReadings();
  }, [currentMeasurementPoint]);

  const loadReadings = async () => {
    if (!currentMeasurementPoint) return;

    try {
      const { data, error } = await supabase
        .from('measurement_readings')
        .select('*')
        .eq('measurement_point_id', currentMeasurementPoint.id)
        .order('point_number', { ascending: true });

      if (error) throw error;
      setReadings(data || []);

      if (measurementSession) {
        setMeasurementSession({
          ...measurementSession,
          readings: data || [],
        });
      }
    } catch (error) {
      console.error('Failed to load readings:', error);
    }
  };

  const handleDeleteReading = async (readingId: string) => {
    if (!confirm('この測定データを削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('measurement_readings')
        .delete()
        .eq('id', readingId);

      if (error) throw error;
      await loadReadings();
    } catch (error) {
      console.error('Failed to delete reading:', error);
      alert('削除に失敗しました');
    }
  };

  const calculateIntermediateResults = () => {
    if (readings.length === 0 || !currentMeasurementPoint) {
      return { count: 0, avgSpeed: 0, airflow: 0 };
    }

    const avgSpeed = readings.reduce((sum, r) => sum + r.ave_wind_speed, 0) / readings.length;
    const area = (currentMeasurementPoint.vertical_mm * currentMeasurementPoint.horizontal_mm) / 1000000;
    const airflow = avgSpeed * area * 60;

    return {
      count: readings.length,
      avgSpeed: parseFloat(avgSpeed.toFixed(2)),
      airflow: parseFloat(airflow.toFixed(2)),
    };
  };

  if (!currentMeasurementPoint) {
    return null;
  }

  const currentReadingCount = readings.length;
  const totalPoints = currentMeasurementPoint.target_point_count;
  const pointNumber = currentReadingCount + 1;
  const intermediateResults = calculateIntermediateResults();

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const photoData = event.target?.result as string;
      setPhoto(photoData);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmPhoto = async () => {
    if (!photo) return;

    setLoading(true);
    try {
      setCurrentPhotoData(photo);
      setCurrentScreen('ocr-confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleRetake = () => {
    setPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBack = () => {
    setCurrentScreen('measurement-locations');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="bg-black/50 backdrop-blur-sm p-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-white hover:text-gray-300 transition mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          戻る
        </button>
        <div className="text-white mb-4">
          <p className="text-sm text-gray-300">測定点: {pointNumber} / {totalPoints}</p>
          <h1 className="text-2xl font-bold">{currentMeasurementPoint.name}</h1>
        </div>

        {intermediateResults.count > 0 && (
          <div className="bg-black/30 rounded-lg p-4 mt-4">
            <p className="text-xs text-gray-400 mb-2">現在の測定状況</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-400">測定済み</p>
                <p className="text-lg font-bold text-white">{intermediateResults.count}点</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">平均風速</p>
                <p className="text-lg font-bold text-blue-400">{intermediateResults.avgSpeed} m/s</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">概算風量</p>
                <p className="text-lg font-bold text-green-400">{intermediateResults.airflow} m³/min</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center p-4 overflow-y-auto">
        {photo ? (
          <div className="w-full max-w-2xl">
            <div className="bg-black rounded-lg overflow-hidden mb-6">
              <img src={photo} alt="撮影画像" className="w-full h-auto" />
            </div>

            <div className="space-y-3">
              <button
                onClick={handleRetake}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition"
              >
                <Repeat2 className="w-5 h-5" />
                再撮影
              </button>
              <button
                onClick={handleConfirmPhoto}
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition"
              >
                {loading ? '処理中...' : '次へ'}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <div className="mb-6 text-white">
                <p className="text-lg font-medium mb-2">{currentMeasurementPoint.name}</p>
                <p className="text-sm text-gray-400">測定点 {pointNumber} / {totalPoints}</p>
              </div>

              <button
                onClick={handleCameraClick}
                className="mb-4 inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition shadow-lg"
                title="撮影"
              >
                <Camera className="w-12 h-12" />
              </button>

              <p className="text-gray-400 text-sm">カメラボタンをタップして撮影してください</p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {readings.length > 0 && (
              <div className="bg-white/95 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">測定済みデータ</h3>
                <div className="space-y-2">
                  {readings.map((reading) => (
                    <div
                      key={reading.id}
                      className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          測定点 {reading.point_number}
                        </p>
                        <p className="text-sm text-gray-600">
                          {reading.ave_wind_speed.toFixed(2)} m/s
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteReading(reading.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="削除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
