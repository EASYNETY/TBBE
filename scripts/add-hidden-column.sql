-- Add hidden column to properties table
ALTER TABLE properties ADD COLUMN hidden BOOLEAN DEFAULT FALSE;