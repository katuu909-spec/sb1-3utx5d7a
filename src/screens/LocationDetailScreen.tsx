import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { ArrowLeft, AlertCircle } from 'lucide-react';

type ShapeType = 'rectangular' | 'circular';

export function LocationDetailScreen() {
  const {
    currentProject,
    currentLocationGroupName,
    currentLocationCount,
    currentLocationIndex,
    setCurrentLocationIndex,
    setCurrentScreen,
  } = useApp();

  const [shapeType, setShapeType] = useState<ShapeType>('rectangular');
  const [vertical, setVertical] = useState('');
  const [horizontal, setHorizontal] = useState('');
  const [diameter, setDiameter] = useState('');
  const [pointCount, setPointCount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const locationName = `${currentLocationGroupName}${currentLocationIndex}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentProject || !currentLocationGroupName || !currentLocationCount) {
      setError('必要な情報が不足しています');
      return;
    }

    if (!pointCount.trim()) {
      setError('測定点数を入力してください');
      return;
    }

    if (shapeType === 'rectangular') {
      if (!vertical.trim() || !horizontal.trim()) {
        setError('縦と横の寸法を入力してください');
        return;
      }
    } else {
      if (!diameter.trim()) {
        setError('直径を入力してください');
        return;
      }
    }

    setLoading(true);

    try {
      const insertData: any = {
        project_id: currentProject.id,
        name: locationName,
        location_group_name: currentLocationGroupName,
        location_number: currentLocationIndex,
        target_point_count: parseInt(pointCount, 10),
        shape_type: shapeType,
      };

      if (shapeType === 'rectangular') {
        insertData.vertical_mm = parseInt(vertical, 10);
        insertData.horizontal_mm = parseInt(horizontal, 10);
      } else {
        insertData.diameter_mm = parseInt(diameter, 10);
        insertData.vertical_mm = parseInt(diameter, 10);
      }

      const { error: insertError } = await supabase
        .from('measurement_points')
        .insert([insertData]);

      if (insertError) throw insertError;

      if (currentLocationIndex < currentLocationCount) {
        setCurrentLocationIndex(currentLocationIndex + 1);
        setShapeType('rectangular');
        setVertical('');
        setHorizontal('');
        setDiameter('');
        setPointCount('');
      } else {
        setCurrentScreen('measurement-locations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (!currentProject || !currentLocationGroupName || !currentLocationCount) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <button
            onClick={() => {
              if (currentLocationIndex > 1) {
                setCurrentLocationIndex(currentLocationIndex - 1);
              } else {
                setCurrentScreen('location-count');
              }
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{locationName}の詳細</h1>
          <div className="mt-3 space-y-1 text-sm text-gray-600">
            <p>製造番号: {currentProject.serial_number}</p>
            <p>
              進捗: {currentLocationIndex} / {currentLocationCount}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">測定箇所情報</h2>

          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">測定箇所名</label>
              <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-900 font-medium">
                {locationName}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">形状</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShapeType('rectangular')}
                  disabled={loading}
                  className={`flex-1 px-6 py-3 rounded-lg font-semibold transition ${
                    shapeType === 'rectangular'
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  四角形
                </button>
                <button
                  type="button"
                  onClick={() => setShapeType('circular')}
                  disabled={loading}
                  className={`flex-1 px-6 py-3 rounded-lg font-semibold transition ${
                    shapeType === 'circular'
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  円形
                </button>
              </div>
            </div>

            {shapeType === 'rectangular' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="vertical" className="block text-sm font-medium text-gray-700 mb-2">
                    縦 (mm)
                  </label>
                  <input
                    id="vertical"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="1"
                    value={vertical}
                    onChange={(e) => setVertical(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="300"
                  />
                </div>
                <div>
                  <label htmlFor="horizontal" className="block text-sm font-medium text-gray-700 mb-2">
                    横 (mm)
                  </label>
                  <input
                    id="horizontal"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="1"
                    value={horizontal}
                    onChange={(e) => setHorizontal(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="400"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="diameter" className="block text-sm font-medium text-gray-700 mb-2">
                  直径 (mm)
                </label>
                <input
                  id="diameter"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="1"
                  value={diameter}
                  onChange={(e) => setDiameter(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="300"
                />
              </div>
            )}

            <div>
              <label htmlFor="pointCount" className="block text-sm font-medium text-gray-700 mb-2">
                測定点数
              </label>
              <input
                id="pointCount"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="1"
                value={pointCount}
                onChange={(e) => setPointCount(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="16"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => {
                  if (currentLocationIndex > 1) {
                    setCurrentLocationIndex(currentLocationIndex - 1);
                  } else {
                    setCurrentScreen('location-count');
                  }
                }}
                disabled={loading}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:bg-gray-100"
              >
                戻る
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
              >
                {loading
                  ? '保存中...'
                  : currentLocationIndex < currentLocationCount
                  ? '次へ'
                  : '完了'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
