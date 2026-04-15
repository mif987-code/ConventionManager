-- Migration 007: Change cost column from INTEGER to NUMERIC to support decimal prices

ALTER TABLE store_items ALTER COLUMN cost TYPE NUMERIC(10, 2) USING cost::NUMERIC;
