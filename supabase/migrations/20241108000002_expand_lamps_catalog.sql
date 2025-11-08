-- Migration: Expand lamps table to support 32 uploaded lantern images
-- Description: Renames legacy lamp keys (p1-p4) to new lamp_# format and ensures
--              32 placeholder records exist so pricing/status APIs remain consistent.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM lamps WHERE lamp_key = 'p1') THEN
    UPDATE lamps SET lamp_key = 'lamp_1' WHERE lamp_key = 'p1';
  END IF;
  IF EXISTS (SELECT 1 FROM lamps WHERE lamp_key = 'p2') THEN
    UPDATE lamps SET lamp_key = 'lamp_2' WHERE lamp_key = 'p2';
  END IF;
  IF EXISTS (SELECT 1 FROM lamps WHERE lamp_key = 'p3') THEN
    UPDATE lamps SET lamp_key = 'lamp_3' WHERE lamp_key = 'p3';
  END IF;
  IF EXISTS (SELECT 1 FROM lamps WHERE lamp_key = 'p4') THEN
    UPDATE lamps SET lamp_key = 'lamp_4' WHERE lamp_key = 'p4';
  END IF;
END $$;

DO $$
DECLARE
  idx INTEGER;
  lamp_key_value TEXT;
BEGIN
  FOR idx IN 1..32 LOOP
    lamp_key_value := format('lamp_%s', idx);
    IF NOT EXISTS (SELECT 1 FROM lamps WHERE lamp_key = lamp_key_value) THEN
      INSERT INTO lamps (lamp_key, status)
      VALUES (lamp_key_value, 'unlit');
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN lamps.lamp_key IS 'Unique lamp identifier (lamp_1 ... lamp_32) corresponding to uploaded lantern images';
