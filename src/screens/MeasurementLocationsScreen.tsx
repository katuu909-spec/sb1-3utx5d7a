import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { Plus, ArrowLeft, Trash2 } from 'lucide-react';
import type { MeasurementPoint } from '../types';

interface LocationWithAirflow extends MeasurementPoint {
  airflow?: number;
}

export function MeasurementLocationsScreen() {
  const [locations, setLocations] = useState<LocationWithAirflow[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentProject, setCurrentScreen, setCurrentMeasurementPoint } = useApp();

  useEffect(() => {
    loadLocations();
  }, [currentProject]);

  const loadLocations = async () => {
    if (!currentProject) return;

    try {
      const { data: locationData, error } = await supabase
        .from('measurement_points')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const locationsWithAirflow = await Promise.all(
        (locationData || []).map(async (location) => {
          const { data: readings } = await supabase
            .from('measurement_readings')
            .select('ave_wind_speed')
            .eq('measurement_point_id', location.id);

          let airflow: number | undefined;
          if (readings && readings.length > 0) {
            const validReadings = readings.filter((r) => r.ave_wind_speed !== null);
            if (validReadings.length > 0) {
              const avgWindSpeed =
                validReadings.reduce((sum, r) => sum + Number(r.ave_wind_speed), 0) /
                validReadings.length;

              let area: number;
              if (location.shape_type === 'circular' && location.diameter_mm) {
                const radius = location.diameter_mm / 2;
                area = (Math.PI * radius * radius) / 1000000;
              } else if (location.horizontal_mm) {
                area = (location.vertical_mm * location.horizontal_mm) / 1000000;
              } else {
                area = 0;
              }

              airflow = avgWindSpeed * area * 60;
            }
          }

          return { ...location, airflow };
        })
      );

      setLocations(locationsWithAirflow);
    } catch (error) {
      console.error('Failed to load locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewLocation = () => {
    setCurrentMeasurementPoint(null);
    setCurrentScreen('location-group-name');
  };

  const handleSelectLocation = (location: MeasurementPoint) => {
    setCurrentMeasurementPoint(location);
    if (location.is_completed) {
      setCurrentScreen('results');
    } else {
      setCurrentScreen('shooting');
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('この測定箇所を削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('measurement_points')
        .delete()
        .eq('id', locationId);

      if (error) throw error;
      setLocations(locations.filter((l) => l.id !== locationId));
    } catch (error) {
      console.error('Failed to delete location:', error);
      alert('削除に失敗しました');
    }
  };

  const calculateArea = (location: MeasurementPoint) => {
    if (location.shape_type === 'circular' && location.diameter_mm) {
      const radius = location.diameter_mm / 2;
      return ((Math.PI * radius * radius) / 1000000).toFixed(4);
    } else if (location.shape_type === 'rectangular' && location.horizontal_mm) {
      return ((location.vertical_mm * location.horizontal_mm) / 1000000).toFixed(4);
    }
    return '0.0000';
  };

  if (!currentProject) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <button
            onClick={() => setCurrentScreen('home')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900">測定箇所一覧</h1>
          <div className="mt-3 space-y-1 text-sm text-gray-600">
            <p>製造番号: {currentProject.serial_number}</p>
            <p>機種型式: {currentProject.model_type} / 機種番号: {currentProject.model_number}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold text-gray-900">測定箇所</h2>
          <button
            onClick={handleNewLocation}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
            新規追加
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        ) : locations.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-600 mb-4">測定箇所がありません</p>
            <button
              onClick={handleNewLocation}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              <Plus className="w-5 h-5" />
              最初の測定箇所を追加
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(
              locations.reduce((groups, location) => {
                const groupName = location.location_group_name || location.name;
                if (!groups[groupName]) {
                  groups[groupName] = [];
                }
                groups[groupName].push(location);
                return groups;
              }, {} as Record<string, typeof locations>)
            ).map(([groupName, groupLocations]) => {
              const totalAirflow = groupLocations.reduce((sum, loc) => {
                return sum + (loc.airflow || 0);
              }, 0);
              const hasAnyAirflow = groupLocations.some((loc) => loc.airflow !== undefined);

              return (
                <div key={groupName} className="space-y-4">
                  <div className="flex items-baseline justify-between px-2">
                    <h3 className="text-lg font-semibold text-gray-900">{groupName}</h3>
                    {hasAnyAirflow && (
                      <div className="text-sm">
                        <span className="text-gray-600">トータル風量: </span>
                        <span className="text-blue-600 font-bold text-base">{totalAirflow.toFixed(2)} m³/min</span>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-4">
                  {groupLocations.map((location) => (
                    <div
                      key={location.id}
                      onClick={() => handleSelectLocation(location)}
                      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-lg font-semibold text-gray-900 mb-3">{location.name}</p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">形状</p>
                              <p className="text-gray-900">{location.shape_type === 'circular' ? '円形' : '四角形'}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">寸法</p>
                              <p className="text-gray-900">
                                {location.shape_type === 'circular' && location.diameter_mm
                                  ? `φ${location.diameter_mm}mm`
                                  : `${location.vertical_mm}mm × ${location.horizontal_mm}mm`}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">面積</p>
                              <p className="text-gray-900">{calculateArea(location)}m²</p>
                            </div>
                            <div>
                              <p className="text-gray-600">測定点数</p>
                              <p className="text-gray-900">{location.target_point_count}点</p>
                            </div>
                            <div>
                              <p className="text-gray-600">ステータス</p>
                              <p className={`font-semibold ${location.is_completed ? 'text-green-600' : 'text-yellow-600'}`}>
                                {location.is_completed ? '確定済み' : '測定中'}
                              </p>
                            </div>
                            {location.airflow !== undefined && (
                              <div>
                                <p className="text-gray-600">風量</p>
                                <p className="text-gray-900 font-semibold">{location.airflow.toFixed(2)} m³/min</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLocation(location.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="削除"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
