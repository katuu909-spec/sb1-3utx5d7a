import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, ImageIcon, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
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

  const exportToExcel = () => {
    // グループごとに表を分け、ヘッダーを繰り返す
    const maxPoints = locations.reduce((m, loc) => Math.max(m, loc.readings.length), 0);
    const pointCols = Math.max(8, maxPoints);
    const headers = [
      '番号',
      '幅(mm)',
      '奥(mm)',
      ...Array.from({ length: pointCols }, (_, i) => `${i + 1}`),
      '面平均風速(m/s)',
      '風量(m³/min)',
    ];

    // グループ化（元データをそのまま）
    const groupMap: Record<string, LocationWithReadings[]> = {};
    locations.forEach((loc) => {
      const groupName = loc.location_group_name || '未設定';
      if (!groupMap[groupName]) groupMap[groupName] = [];
      groupMap[groupName].push(loc);
    });

    const sheetData: (string | number)[][] = [];

    Object.entries(groupMap).forEach(([groupName, locs], groupIndex) => {
      if (groupIndex > 0) {
        sheetData.push([]); // 空行で区切る
      }
      // グループ名行
      sheetData.push([`グループ: ${groupName}`]);
      // ヘッダー行
      sheetData.push(headers);

      locs.forEach((loc) => {
        const isCircular = loc.shape_type === 'circular';
        const width = isCircular ? loc.diameter_mm ?? 0 : loc.horizontal_mm ?? 0;
        const depth = loc.vertical_mm ?? 0;
        const readingsOrdered = Array.from({ length: pointCols }, (_, i) => {
          const r = loc.readings.find((rd) => rd.point_number === i + 1);
          return r ? Number(r.ave_wind_speed ?? 0) : '';
        });

        const avgSpeed =
          loc.readings.length === 0
            ? 0
            : loc.readings.reduce((s, r) => s + Number(r.ave_wind_speed ?? 0), 0) / loc.readings.length;
        const area =
          loc.shape_type === 'circular' && loc.diameter_mm
            ? (Math.PI * Math.pow(loc.diameter_mm / 2, 2)) / 1000000
            : loc.horizontal_mm
              ? (loc.vertical_mm * loc.horizontal_mm) / 1000000
              : 0;
        const airflow = avgSpeed * area * 60;

        sheetData.push([
          loc.location_number ?? '',
          width,
          depth,
          ...readingsOrdered.map((v) => (v === '' ? '' : Number(v.toFixed(2)))),
          Number(avgSpeed.toFixed(3)),
          Number(airflow.toFixed(1)),
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    XLSX.writeFile(wb, 'summary.xlsx');
  };

  return (
    <div className="min-h-screen bg-emerald-50">
      <div className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="w-full sm:w-auto">
            <button
              onClick={exportToExcel}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Excel出力
            </button>
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
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-emerald-900">
                            {loc.names[0]}
                            {loc.names.length > 1 && (
                              <span className="text-sm text-emerald-700 ml-2">
                                他{loc.names.length - 1}件
                              </span>
                            )}
                          </h3>
                        </div>
                        <div className="text-sm text-emerald-800">
                          <span className="text-emerald-700">寸法: </span>
                          <span className="font-semibold text-emerald-900">
                            {loc.shape_type === 'circular' && loc.diameter_mm
                              ? `φ${loc.diameter_mm}mm`
                              : `${loc.vertical_mm}mm × ${loc.horizontal_mm ?? '-'}mm`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="overflow-x-auto rounded-xl border border-emerald-100">
                  <table className="min-w-full divide-y divide-emerald-100 text-sm md:text-base">
                    <thead className="bg-emerald-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 tracking-wider whitespace-nowrap">
                          測定箇所
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 tracking-wider whitespace-nowrap">
                          測定点
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 tracking-wider whitespace-nowrap">
                          Ave風速 (m/s)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 tracking-wider whitespace-nowrap">
                          風量 (m³/min)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-800 tracking-wider whitespace-nowrap">
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

