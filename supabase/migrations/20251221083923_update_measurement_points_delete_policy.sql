/*
  # Update measurement points delete policy

  1. Changes
    - Remove the restriction that only incomplete measurement points can be deleted
    - Allow users to delete any measurement point in their projects (both complete and incomplete)
    - This enables proper data management and cleanup
*/

DROP POLICY IF EXISTS "Users can delete incomplete measurement points" ON measurement_points;

CREATE POLICY "Users can delete their measurement points"
  ON measurement_points
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM projects
      WHERE projects.id = measurement_points.project_id
      AND projects.user_id = auth.uid()
    )
  );
