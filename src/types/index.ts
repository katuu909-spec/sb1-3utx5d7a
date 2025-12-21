import type { Database } from '../lib/database.types';

export type Project = Database['public']['Tables']['projects']['Row'];
export type MeasurementPoint = Database['public']['Tables']['measurement_points']['Row'];
export type MeasurementReading = Database['public']['Tables']['measurement_readings']['Row'];

export interface MeasurementPointWithReadings extends MeasurementPoint {
  readings: MeasurementReading[];
}

export interface ProjectWithPoints extends Project {
  measurement_points: MeasurementPointWithReadings[];
}

export interface OCRResult {
  ave_wind_speed: number;
  confidence: number;
}

export type AppScreen =
  | 'home'
  | 'login'
  | 'signup'
  | 'new-project'
  | 'measurement-locations'
  | 'location-group-name'
  | 'location-count'
  | 'location-detail'
  | 'new-location'
  | 'shooting'
  | 'ocr-confirm'
  | 'results'
  | 'save-confirm';

export interface MeasurementSession {
  projectId: string;
  pointId: string;
  pointNumber: number;
  totalPoints: number;
  readings: MeasurementReading[];
}

export const MEASUREMENT_LOCATION_PRESETS = [
  '吹出',
  '吸込',
  'ダクト',
  'その他',
];
