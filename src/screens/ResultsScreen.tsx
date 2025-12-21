import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import type { MeasurementReading } from '../types';

export function ResultsScreen() {
  const [readings, setReadings] = useState<MeasurementReading[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentMeasurementPoint, setCurrentScreen, setMeasurementSession } = useApp();

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
    } catch (error) {
      console.error('Failed to load readings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    setMeasurementSession(null);
    setCurrentScreen('measurement-locations');
  };

  const calculateAverage = () => {
    if (readings.length === 0) return 0;
    const sum = readings.reduce((acc, reading) => acc + reading.ave_wind_speed, 0);
    return (sum / readings.length).toFixed(2);
  };

  const calculateArea = () => {
    if (!currentMeasurementPoint) return 0;

    if (currentMeasurementPoint.shape_type === 'circular' && currentMeasurementPoint.diameter_mm) {
      const radius = currentMeasurementPoint.diameter_mm / 2;
      return (Math.PI * radius * radius) / 1000000;
    } else if (currentMeasurementPoint.horizontal_mm) {
      return (currentMeasurementPoint.vertical_mm * currentMeasurementPoint.horizontal_mm) / 1000000;
    }
    return 0;
  };

  const calculateAirVolume = () => {
    if (!currentMeasurementPoint || readings.length === 0) return 0;
    const avgSpeed = parseFloat(calculateAverage());
    const areaM2 = calculateArea();
    return (avgSpeed * areaM2 * 60).toFixed(2);
  };

  if (!currentMeasurementPoint) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <button
            onClick={handleFinish}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            測定箇所一覧へ
          </button>
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">測定完了</h1>
          </div>
          <p className="text-lg text-gray-700">{currentMeasurementPoint.name}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">測定結果サマリー</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-700 mb-1">測定点数</p>
              <p className="text-2xl font-bold text-blue-900">{readings.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-700 mb-1">平均風速</p>
              <p className="text-2xl font-bold text-green-900">{calculateAverage()} m/s</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-700 mb-1">面積</p>
              <p className="text-2xl font-bold text-purple-900">
                {calculateArea().toFixed(4)} m²
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-orange-700 mb-1">風量</p>
              <p className="text-2xl font-bold text-orange-900">{calculateAirVolume()} m³/min</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">測定値一覧</h2>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">読み込み中...</p>
            </div>
          ) : readings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">測定データがありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">測定点</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">AVE風速 (m/s)</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">画像</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((reading) => (
                    <tr key={reading.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{reading.point_number}</td>
                      <td className="py-3 px-4 text-gray-900 font-semibold">{reading.ave_wind_speed.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <a
                          href={reading.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline"
                        >
                          画像を表示
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6">
          <button
            onClick={handleFinish}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
          >
            測定箇所一覧へ戻る
          </button>
        </div>
      </div>
    </div>
  );
}
