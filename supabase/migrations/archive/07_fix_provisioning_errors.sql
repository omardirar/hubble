-- =============================================================================
-- Fix provisioning errors and permissions
-- =============================================================================

-- Add error_message column to provisioning_runs table
alter table public.provisioning_runs
add column if not exists error_message text;

-- Add comment for the new column
comment on column public.provisioning_runs.error_message is 'Error message if provisioning failed';

-- Grant usage on the events sequence to service_role
-- This fixes the "permission denied for sequence events_id_seq" error
grant usage, select on sequence public.events_id_seq to service_role;

-- Also ensure service_role can insert into events table
grant insert on public.events to service_role;

-- Ensure service_role can update provisioning_runs
grant update on public.provisioning_runs to service_role;
