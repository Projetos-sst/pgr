-- Compatibility placeholder for the historical journal entry `0018_schedule_events`.
--
-- Context: a `develop` merge collided two feature branches on the `0018` slot. The
-- canonical schedule_events DDL ended up in `0023_schedule_events.sql` (journal idx 23),
-- while the journal still references `0018_schedule_events` (idx 18) with no file on disk.
-- Rewriting the journal/snapshots would change the historical hashes/idx of shared
-- migrations, so instead this no-op lets journal-based `drizzle-kit migrate` resolve the
-- idx 18 entry on a fresh database. schedule_events is created exactly once, by 0023.
-- Do NOT add schema DDL here.
SELECT 1;
