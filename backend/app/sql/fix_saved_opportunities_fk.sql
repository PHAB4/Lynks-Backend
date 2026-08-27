-- Drop the foreign key constraint on saved_opportunities.opportunity_id
-- Opportunities are curated/scraped in-memory, not stored in a DB table.
-- The opportunity_id is a text hash, not a FK reference.

-- First, find and drop the FK constraint (name may vary)
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'saved_opportunities'
        AND tc.constraint_type = 'FOREIGN KEY';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE saved_opportunities DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped FK constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No FK constraint found on saved_opportunities';
    END IF;
END $$;
