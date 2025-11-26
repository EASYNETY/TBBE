ALTER TABLE properties
ADD COLUMN ownership_type ENUM('full', 'fractional', 'leasehold'),
ADD COLUMN fractional BOOLEAN,
ADD COLUMN supply INT,
ADD COLUMN project_id VARCHAR(255),
ADD COLUMN video_tour_url TEXT,
ADD COLUMN metadata_tags JSON;