import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft } from 'lucide-react';

export function LocationCountScreen() {
  const [count, setCount] = useState('');
  const {
    currentProject,
    currentLocationGroupName,
    setCurrentScreen,
    setCurrentLocationCount,
    setCurrentLocationIndex,
  } = useApp();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const countNum = parseInt(count, 10);
    if (countNum > 0) {
      setCurrentLocationCount(countNum);
      setCurrentLocationIndex(1);
      setCurrentScreen('location-detail');
    }
  };

  const handleQuickSelect = (num: number) => {
    setCurrentLocationCount(num);
    setCurrentLocationIndex(1);
    setCurrentScreen('location-detail');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <button
            onClick={() => setCurrentScreen('location-group-name')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900">測定箇所数</h1>
          {currentProject && (
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <p>製造番号: {currentProject.serial_number}</p>
              <p>測定箇所名: {currentLocationGroupName}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {currentLocationGroupName}の測定箇所数を選択してください
          </h2>

          <div className="mb-8">
            <p className="text-sm font-medium text-gray-700 mb-4">よく使う数</p>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleQuickSelect(num)}
                  className="px-4 py-4 border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition text-gray-900 font-semibold text-lg"
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="count" className="block text-sm font-medium text-gray-700 mb-2">
                または、直接入力
              </label>
              <input
                id="count"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                min="1"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="測定箇所数を入力"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setCurrentScreen('location-group-name')}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
              >
                戻る
              </button>
              <button
                type="submit"
                disabled={!count || parseInt(count, 10) <= 0}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
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
