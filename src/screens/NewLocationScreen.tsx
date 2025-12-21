import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { MEASUREMENT_LOCATION_PRESETS } from '../types';

export function NewLocationScreen() {
  const [nameSource, setNameSource] = useState<'preset' | 'custom'>('preset');
  const [presetName, setPresetName] = useState(MEASUREMENT_LOCATION_PRESETS[0]);
  const [customName, setCustomName] = useState('');
  const [shapeType, setShapeType] = useState<'rectangular' | 'circular'>('rectangular');
  const [verticalMm, setVerticalMm] = useState('');
  const [horizontalMm, setHorizontalMm] = useState('');
  const [diameterMm, setDiameterMm] = useState('');
  const [pointCount, setPointCount] = useState('9');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentProject, setCurrentScreen, setCurrentMeasurementPoint } = useApp();

  const getUniqueName = async (baseName: string): Promise<string> => {
    if (!currentProject) return baseName;

    const { data: existingLocations } = await supabase
      .from('measurement_points')
      .select('name')
      .eq('project_id', currentProject.id);

    if (!existingLocations || existingLocations.length === 0) {
      return baseName;
    }

    const existingNames = existingLocations.map((loc) => loc.name);

    if (!existingNames.includes(baseName)) {
      return baseName;
    }

    let counter = 2;
    let uniqueName = `${baseName} (${counter})`;

    while (existingNames.includes(uniqueName)) {
      counter++;
      uniqueName = `${baseName} (${counter})`;
    }

    return uniqueName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const baseLocationName = nameSource === 'preset' ? presetName : customName.trim();

    if (!baseLocationName) {
      setError('測定箇所名を入力してください');
      return;
    }

    if (!pointCount) {
      setError('測定点数を入力してください');
      return;
    }

    if (shapeType === 'rectangular') {
      if (!verticalMm || !horizontalMm) {
        setError('縦寸法と横寸法を入力してください');
        return;
      }
      const vertical = parseInt(verticalMm);
      const horizontal = parseInt(horizontalMm);
      if (vertical <= 0 || horizontal <= 0) {
        setError('0より大きい値を入力してください');
        return;
      }
    } else {
      if (!diameterMm) {
        setError('直径を入力してください');
        return;
      }
      const diameter = parseInt(diameterMm);
      if (diameter <= 0) {
        setError('0より大きい値を入力してください');
        return;
      }
    }

    const points = parseInt(pointCount);
    if (points <= 0) {
      setError('測定点数は0より大きい値を入力してください');
      return;
    }

    if (!currentProject) return;

    setLoading(true);

    try {
      const uniqueName = await getUniqueName(baseLocationName);

      const insertData: any = {
        project_id: currentProject.id,
        name: uniqueName,
        shape_type: shapeType,
        target_point_count: points,
      };

      if (shapeType === 'rectangular') {
        insertData.vertical_mm = parseInt(verticalMm);
        insertData.horizontal_mm = parseInt(horizontalMm);
        insertData.diameter_mm = null;
      } else {
        insertData.diameter_mm = parseInt(diameterMm);
        insertData.vertical_mm = parseInt(diameterMm);
        insertData.horizontal_mm = null;
      }

      const { data, error: insertError } = await supabase
        .from('measurement_points')
        .insert([insertData])
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        setCurrentMeasurementPoint(data);
        setCurrentScreen('shooting');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '測定箇所の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <button
            onClick={() => setCurrentScreen('measurement-locations')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900">測定箇所を追加</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">測定箇所情報</h2>

          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">測定箇所名</label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    id="preset"
                    name="nameSource"
                    value="preset"
                    checked={nameSource === 'preset'}
                    onChange={() => setNameSource('preset')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="preset" className="text-sm text-gray-700 cursor-pointer">
                    プリセットから選択
                  </label>
                </div>

                {nameSource === 'preset' && (
                  <select
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  >
                    {MEASUREMENT_LOCATION_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    id="custom"
                    name="nameSource"
                    value="custom"
                    checked={nameSource === 'custom'}
                    onChange={() => setNameSource('custom')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="custom" className="text-sm text-gray-700 cursor-pointer">
                    カスタム入力
                  </label>
                </div>

                {nameSource === 'custom' && (
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="例: 南側吹出口"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">吸い込み面の形状</label>
              <div className="flex gap-6">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    id="rectangular"
                    name="shapeType"
                    value="rectangular"
                    checked={shapeType === 'rectangular'}
                    onChange={() => setShapeType('rectangular')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="rectangular" className="text-sm text-gray-700 cursor-pointer">
                    四角形
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    id="circular"
                    name="shapeType"
                    value="circular"
                    checked={shapeType === 'circular'}
                    onChange={() => setShapeType('circular')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="circular" className="text-sm text-gray-700 cursor-pointer">
                    円形
                  </label>
                </div>
              </div>
            </div>

            {shapeType === 'rectangular' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="vertical" className="block text-sm font-medium text-gray-700 mb-2">
                    縦寸法 (mm)
                  </label>
                  <input
                    id="vertical"
                    type="number"
                    value={verticalMm}
                    onChange={(e) => setVerticalMm(e.target.value)}
                    required
                    disabled={loading}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="1000"
                  />
                </div>

                <div>
                  <label htmlFor="horizontal" className="block text-sm font-medium text-gray-700 mb-2">
                    横寸法 (mm)
                  </label>
                  <input
                    id="horizontal"
                    type="number"
                    value={horizontalMm}
                    onChange={(e) => setHorizontalMm(e.target.value)}
                    required
                    disabled={loading}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="800"
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
                  type="number"
                  value={diameterMm}
                  onChange={(e) => setDiameterMm(e.target.value)}
                  required
                  disabled={loading}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="500"
                />
              </div>
            )}

            <div>
              <label htmlFor="pointCount" className="block text-sm font-medium text-gray-700 mb-2">
                測定点数
              </label>
              <input
                id="pointCount"
                type="number"
                value={pointCount}
                onChange={(e) => setPointCount(e.target.value)}
                required
                disabled={loading}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="9"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                面積: <span className="font-semibold">
                  {(() => {
                    if (shapeType === 'rectangular') {
                      if (verticalMm && horizontalMm) {
                        return ((parseInt(verticalMm) * parseInt(horizontalMm)) / 1000000).toFixed(4);
                      }
                    } else {
                      if (diameterMm) {
                        const radius = parseInt(diameterMm) / 2;
                        return ((Math.PI * radius * radius) / 1000000).toFixed(4);
                      }
                    }
                    return '0.0000';
                  })()}
                  m²
                </span>
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setCurrentScreen('measurement-locations')}
                disabled={loading}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:bg-gray-100"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
              >
                {loading ? '作成中...' : '次へ'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
