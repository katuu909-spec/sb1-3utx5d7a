import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft } from 'lucide-react';
import { MEASUREMENT_LOCATION_PRESETS } from '../types';

export function LocationGroupNameScreen() {
  const [locationName, setLocationName] = useState('');
  const { currentProject, setCurrentScreen, setCurrentLocationGroupName } = useApp();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locationName.trim()) {
      setCurrentLocationGroupName(locationName.trim());
      setCurrentScreen('location-count');
    }
  };

  const handlePresetClick = (preset: string) => {
    setLocationName(preset);
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
          <h1 className="text-3xl font-bold text-gray-900">測定箇所名</h1>
          {currentProject && (
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <p>製造番号: {currentProject.serial_number}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">測定箇所名を入力してください</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="locationName" className="block text-sm font-medium text-gray-700 mb-2">
                測定箇所名
              </label>
              <input
                id="locationName"
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="例: 吹出"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">よく使う測定箇所</p>
              <div className="grid grid-cols-2 gap-3">
                {MEASUREMENT_LOCATION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-gray-900 font-medium"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setCurrentScreen('measurement-locations')}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
              >
                次へ
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
