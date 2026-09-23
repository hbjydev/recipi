-- Run once when upgrading an existing single-household Recipi installation.
-- Back up the database first. Pass -v household_id=home to psql.
UPDATE recipes
SET owner_id = 'household:' || :'household_id'
WHERE owner_id NOT LIKE 'household:%';
