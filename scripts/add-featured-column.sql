-- Add is_featured column to properties table
ALTER TABLE properties ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;

-- Optionally, set some existing properties as featured for testing
-- UPDATE properties SET is_featured = TRUE WHERE id IN ('some-property-id1', 'some-property-id2');