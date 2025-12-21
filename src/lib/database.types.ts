export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          serial_number: string;
          model_type: string;
          model_number: string;
          measurement_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          serial_number: string;
          model_type: string;
          model_number: string;
          measurement_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          serial_number?: string;
          model_type?: string;
          model_number?: string;
          measurement_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      measurement_points: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          location_group_name: string;
          location_number: number;
          vertical_mm: number;
          horizontal_mm: number | null;
          target_point_count: number;
          is_completed: boolean;
          shape_type: 'rectangular' | 'circular';
          diameter_mm: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          location_group_name: string;
          location_number: number;
          vertical_mm: number;
          horizontal_mm?: number | null;
          target_point_count: number;
          is_completed?: boolean;
          shape_type?: 'rectangular' | 'circular';
          diameter_mm?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          location_group_name?: string;
          location_number?: number;
          vertical_mm?: number;
          horizontal_mm?: number | null;
          target_point_count?: number;
          is_completed?: boolean;
          shape_type?: 'rectangular' | 'circular';
          diameter_mm?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      measurement_readings: {
        Row: {
          id: string;
          measurement_point_id: string;
          point_number: number;
          image_url: string;
          ave_wind_speed: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          measurement_point_id: string;
          point_number: number;
          image_url: string;
          ave_wind_speed: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          measurement_point_id?: string;
          point_number?: number;
          image_url?: string;
          ave_wind_speed?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
