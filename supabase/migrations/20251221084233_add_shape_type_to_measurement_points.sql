/*
  # Add shape type support to measurement points

  1. Changes
    - Add `shape_type` column to support rectangular and circular shapes
      - Values: 'rectangular' or 'circular'
      - Default: 'rectangular' for backward compatibility
    - Add `diameter_mm` column for circular shapes
    - Modify `horizontal_mm` to be nullable (not needed for circular shapes)
    - Update check constraints to validate data based on shape type
  
  2. Notes
    - Rectangular shapes use: vertical_mm (height) and horizontal_mm (width)
    - Circular shapes use: diameter_mm
    - Existing data will default to 'rectangular' shape type
*/

-- Add shape_type column
ALTER TABLE measurement_points 
ADD COLUMN IF NOT EXISTS shape_type text DEFAULT 'rectangular' CHECK (shape_type IN ('rectangular', 'circular'));

-- Add diameter_mm column for circular shapes
ALTER TABLE measurement_points 
ADD COLUMN IF NOT EXISTS diameter_mm integer CHECK (diameter_mm IS NULL OR diameter_mm > 0);

-- Drop existing constraint on horizontal_mm if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'measurement_points' AND constraint_name LIKE '%horizontal_mm%check%'
  ) THEN
    ALTER TABLE measurement_points DROP CONSTRAINT IF EXISTS measurement_points_horizontal_mm_check;
  END IF;
END $$;

-- Make horizontal_mm nullable and update constraint
ALTER TABLE measurement_points 
ALTER COLUMN horizontal_mm DROP NOT NULL;

-- Add constraint to ensure proper values based on shape type
ALTER TABLE measurement_points 
ADD CONSTRAINT shape_dimensions_check CHECK (
  (shape_type = 'rectangular' AND horizontal_mm IS NOT NULL AND horizontal_mm > 0 AND diameter_mm IS NULL) OR
  (shape_type = 'circular' AND diameter_mm IS NOT NULL AND diameter_mm > 0 AND horizontal_mm IS NULL)
);
