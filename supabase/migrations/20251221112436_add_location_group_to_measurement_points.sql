/*
  # Add location group structure to measurement points

  1. Changes
    - Add `location_group_name` column to store the measurement location group name (e.g., "吹出", "吸込")
    - Add `location_number` column to store the number within the location group (e.g., 1, 2, 3)
    - These fields allow multiple measurement points to be grouped under the same location name
    
  2. Migration Strategy
    - Add nullable columns first
    - Set default values for existing records
    - Existing records will get location_group_name from their current name field
    - Existing records will get location_number = 1 (treated as single location)
    
  3. Data Preservation
    - All existing measurement point data is preserved
    - Existing records are automatically migrated to the new structure
*/

-- Add location_group_name column (nullable initially)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'measurement_points' AND column_name = 'location_group_name'
  ) THEN
    ALTER TABLE measurement_points ADD COLUMN location_group_name text;
  END IF;
END $$;

-- Add location_number column (nullable initially)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'measurement_points' AND column_name = 'location_number'
  ) THEN
    ALTER TABLE measurement_points ADD COLUMN location_number integer;
  END IF;
END $$;

-- Migrate existing data: use current name as location_group_name and set location_number to 1
UPDATE measurement_points 
SET location_group_name = name, location_number = 1 
WHERE location_group_name IS NULL;

-- Now make the columns NOT NULL with proper constraints
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'measurement_points' 
    AND column_name = 'location_group_name'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE measurement_points ALTER COLUMN location_group_name SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'measurement_points' 
    AND column_name = 'location_number'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE measurement_points ALTER COLUMN location_number SET NOT NULL;
  END IF;
END $$;

-- Add check constraint for location_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'measurement_points_location_number_check'
  ) THEN
    ALTER TABLE measurement_points ADD CONSTRAINT measurement_points_location_number_check CHECK (location_number > 0);
  END IF;
END $$;