ALTER TABLE properties
ADD COLUMN legal_description TEXT,
ADD COLUMN assessed_value DECIMAL(15,2),
ADD COLUMN jurisdiction VARCHAR(255),
ADD COLUMN document_hash VARCHAR(66);