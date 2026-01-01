import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import type { MeasurementPoint, MeasurementReading } from '../types';

interface LocationWithReadings extends MeasurementPoint {
  readings: MeasurementReading[];
}

interface MergedLocation {
  key: string;
  names: string[];
  shape_type: MeasurementPoint['shape_type'];
  vertical_mm: number;
  horizontal_mm: number | null;
  diameter_mm: number | null;
  target_point_count_total: number;
  area: number;
  airflow: number;
  readingEntries: { reading: MeasurementReading; name: string }[];
}

interface GroupedLocations {
  groupName: string;
  mergedLocations: MergedLocation[];
  totalAirflow: number;
}

export function SummaryScreen() {
  const { currentProject, setCurrentScreen } = useApp();
  const [locations, setLocations] = useState<LocationWithReadings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentProject]);

  const loadData = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const { data: pointsRaw, error: pointsError } = await supabase
        .from('measurement_points')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: true });

      if (pointsError) throw pointsError;

      const points: MeasurementPoint[] = (pointsRaw as MeasurementPoint[] | null) ?? [];
      const pointIds = points.map((p) => p.id);
      let readingMap: Record<string, MeasurementReading[]> = {};

      if (pointIds.length > 0) {
        const { data: readingsRaw, error: readingsError } = await supabase
          .from('measurement_readings')
          .select('*')
          .in('measurement_point_id', pointIds)
          .order('point_number', { ascending: true });

        if (readingsError) throw readingsError;

        const readings: MeasurementReading[] = (readingsRaw as MeasurementReading[] | null) ?? [];

        readingMap = readings.reduce<Record<string, MeasurementReading[]>>((acc, reading) => {
          if (!acc[reading.measurement_point_id]) {
            acc[reading.measurement_point_id] = [];
          }
          acc[reading.measurement_point_id].push(reading);
          return acc;
        }, {});
      }

      const merged: LocationWithReadings[] = points.map((point) => ({
        ...point,
        readings: readingMap[point.id] || [],
      }));

      setLocations(merged);
    } catch (error) {
      console.error('Failed to load summary data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calcArea = (point: MeasurementPoint) => {
    if (point.shape_type === 'circular' && point.diameter_mm) {
      const radius = point.diameter_mm / 2;
      return (Math.PI * radius * radius) / 1000000;
    }
    if (point.horizontal_mm) {
      return (point.vertical_mm * point.horizontal_mm) / 1000000;
    }
    return 0;
  };

  const calcAirflowFromReadings = (readings: MeasurementReading[], area: number) => {
    if (readings.length === 0) return 0;
    const avgSpeed =
      readings.reduce((sum, r) => sum + Number(r.ave_wind_speed ?? 0), 0) / readings.length;
    return avgSpeed * area * 60;
  };

  const grouped = useMemo<GroupedLocations[]>(() => {
    const groupMap: Record<string, LocationWithReadings[]> = {};

    locations.forEach((loc) => {
      const baseName =
        loc.location_group_name ||
        loc.name.replace(/\s*\(?\d+\)?$/, ''); // 連番をまとめる簡易な正規化
      if (!groupMap[baseName]) {
        groupMap[baseName] = [];
      }
      groupMap[baseName].push(loc);
    });

    return Object.entries(groupMap).map(([groupName, locs]) => {
      // 同一グループ内で「面積」と「測定点数」が同じものをマージ
      const mergedMap = new Map<string, MergedLocation>();

      locs.forEach((loc) => {
        const area = calcArea(loc);
        const key = `${loc.shape_type}-${area.toFixed(6)}-${loc.target_point_count}`;
        const existing = mergedMap.get(key);

        const newEntries = loc.readings.map((r) => ({ reading: r, name: loc.name }));

        if (existing) {
          const combinedEntries = [...existing.readingEntries, ...newEntries];
          const combinedReadings = combinedEntries.map((e) => e.reading);
          mergedMap.set(key, {
            ...existing,
            names: [...existing.names, loc.name],
            target_point_count_total: existing.target_point_count_total + loc.target_point_count,
            readingEntries: combinedEntries,
            airflow: calcAirflowFromReadings(combinedReadings, area),
          });
        } else {
          mergedMap.set(key, {
            key,
            names: [loc.name],
            shape_type: loc.shape_type,
            vertical_mm: loc.vertical_mm,
            horizontal_mm: loc.horizontal_mm,
            diameter_mm: loc.diameter_mm,
            target_point_count_total: loc.target_point_count,
            area,
            readingEntries: newEntries,
            airflow: calcAirflowFromReadings(loc.readings, area),
          });
        }
      });

      const mergedLocations = Array.from(mergedMap.values());
      const totalAirflow = mergedLocations.reduce((sum, loc) => sum + loc.airflow, 0);
      return {
        groupName,
        mergedLocations,
        totalAirflow,
      };
    });
  }, [locations]);

  if (!currentProject) {
    return null;
  }

  return (
    <div className="min-h-screen bg-emerald-50">
      <div className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex items-center justify-between">
          <div>
            <button
              onClick={() => setCurrentScreen('measurement-locations')}
              className="flex items-center gap-2 text-emerald-700 hover:text-emerald-900 transition mb-3"
            >
              <ArrowLeft className="w-5 h-5" />
              測定箇所一覧へ
            </button>
            <h1 className="text-3xl font-bold text-emerald-900">集計</h1>
            <p className="text-sm text-emerald-800 mt-1">
              製造番号: {currentProject.serial_number} / 機種: {currentProject.model_type}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {loading ? (
          <div className="bg-white rounded-2xl shadow p-10 text-center text-emerald-800">
            読み込み中...
          </div>
        ) : grouped.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-10 text-center text-emerald-800">
            測定データがありません
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.groupName} className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-100 to-emerald-50 px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-700">測定箇所グループ</p>
                  <h2 className="text-2xl font-bold text-emerald-900">{group.groupName}</h2>
                </div>
                <div className="text-right">
                  <p className="text-sm text-emerald-700">グループ風量合計</p>
                  <p className="text-3xl font-extrabold text-emerald-900">
                    {group.totalAirflow.toFixed(2)} m³/min
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.mergedLocations.map((loc) => {
                    return (
                      <div
                        key={loc.key}
                        className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-emerald-900">
                            {loc.names[0]}
                            {loc.names.length > 1 && (
                              <span className="text-sm text-emerald-700 ml-2">
                                他{loc.names.length - 1}件
                              </span>
                            )}
                          </h3>
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              loc.shape_type === 'circular'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-emerald-200 text-emerald-900'
                            }`}
                          >
                            {loc.shape_type === 'circular' ? '円形' : '四角形'}
                          </span>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 text-sm text-emerald-800">
                          <div>
                            <dt className="text-emerald-700">寸法</dt>
                            <dd className="font-semibold text-emerald-900">
                              {loc.shape_type === 'circular' && loc.diameter_mm
                                ? `φ${loc.diameter_mm}mm`
                                : `${loc.vertical_mm}mm × ${loc.horizontal_mm ?? '-'}mm`}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-emerald-700">測定点数</dt>
                            <dd className="font-semibold text-emerald-900">
                              {loc.target_point_count_total} 点
                            </dd>
                          </div>
                          <div>
                            <dt className="text-emerald-700">面積</dt>
                            <dd className="font-semibold text-emerald-900">{loc.area.toFixed(4)} m²</dd>
                          </div>
                          <div>
                            <dt className="text-emerald-700">風量</dt>
                            <dd className="font-semibold text-emerald-900">
                              {loc.airflow.toFixed(2)} m³/min
                            </dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })}
                </div>

                <div className="overflow-x-auto rounded-xl border border-emerald-100">
                  <table className="min-w-full divide-y divide-emerald-100 text-sm md:text-base">
                    <thead className="bg-emerald-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider whitespace-nowrap">
                          測定箇所
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider whitespace-nowrap">
                          測定点
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider whitespace-nowrap">
                          AVE風速 (m/s)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider whitespace-nowrap">
                          風量 (m³/min)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider whitespace-nowrap">
                          画像
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-emerald-50">
                      {group.mergedLocations.flatMap((loc) => {
                        return loc.readingEntries.map(({ reading, name }) => {
                          const airflow = (reading.ave_wind_speed ?? 0) * loc.area * 60;
                          return (
                            <tr key={reading.id} className="hover:bg-emerald-50/50 transition align-middle">
                              <td className="px-4 py-3 text-emerald-900 font-medium whitespace-nowrap">
                                {name}
                              </td>
                              <td className="px-4 py-3 text-emerald-800 whitespace-nowrap">
                                {reading.point_number}
                              </td>
                              <td className="px-4 py-3 text-emerald-800 whitespace-nowrap">
                                {reading.ave_wind_speed.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-emerald-900 font-semibold whitespace-nowrap">
                                {airflow.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-emerald-800 whitespace-nowrap">
                                {reading.image_url ? (
                                  <a
                                    href={reading.image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold underline"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    画像
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                ) : (
                                  <span className="text-emerald-500">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

