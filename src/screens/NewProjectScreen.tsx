import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export function NewProjectScreen() {
  const [serialNumber, setSerialNumber] = useState('');
  const [modelType, setModelType] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, setCurrentScreen, setCurrentProject } = useApp();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!serialNumber.trim() || !modelType.trim() || !modelNumber.trim()) {
      setError('すべての項目を入力してください');
      return;
    }

    setLoading(true);

    try {
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert([
          {
            user_id: user?.id,
            serial_number: serialNumber.trim().toUpperCase(),
            model_type: modelType.trim().toUpperCase(),
            model_number: modelNumber.trim().toUpperCase(),
          },
        ])
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          setError('この製造番号は既に存在します');
        } else {
          throw insertError;
        }
        return;
      }

      if (data) {
        setCurrentProject(data);
        setCurrentScreen('measurement-locations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '案件の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <button
            onClick={() => setCurrentScreen('home')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900">新規測定</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">機器情報入力</h2>

          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-2">
                製造番号
              </label>
              <input
                id="serialNumber"
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                required
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition uppercase"
                placeholder="例: ABC123456"
              />
            </div>

            <div>
              <label htmlFor="modelType" className="block text-sm font-medium text-gray-700 mb-2">
                機種型式
              </label>
              <input
                id="modelType"
                type="text"
                value={modelType}
                onChange={(e) => setModelType(e.target.value.toUpperCase())}
                required
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition uppercase"
                placeholder="例: HVAC-2000"
              />
            </div>

            <div>
              <label htmlFor="modelNumber" className="block text-sm font-medium text-gray-700 mb-2">
                機種番号
              </label>
              <input
                id="modelNumber"
                type="text"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value.toUpperCase())}
                required
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition uppercase"
                placeholder="例: MN-001"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setCurrentScreen('home')}
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
