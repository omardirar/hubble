-- Add a database-backed sequence generator for message ordering
-- This eliminates race conditions in concurrent message creation

-- Create a sequence tracking table
create table if not exists chat.conversation_sequences (
    conversation_id uuid primary key references chat.conversations(id) on delete cascade,
    next_seq integer not null default 0,
    updated_at timestamptz not null default timezone('utc', now())
);

-- Function to get next sequence number atomically
create or replace function chat.get_next_message_seq(p_conversation_id uuid)
returns integer as $$
declare
    v_seq integer;
begin
    -- Insert or update atomically to get next sequence
    insert into chat.conversation_sequences (conversation_id, next_seq)
    values (p_conversation_id, 1)
    on conflict (conversation_id) do update
        set next_seq = chat.conversation_sequences.next_seq + 1,
            updated_at = timezone('utc', now())
    returning next_seq - 1 into v_seq;

    return v_seq;
end;
$$ language plpgsql;

-- Add index for performance
create index if not exists idx_conversation_sequences_updated
    on chat.conversation_sequences (updated_at);

-- Add a comment explaining usage
comment on function chat.get_next_message_seq(uuid) is
    'Atomically generates the next sequence number for a message in a conversation. '
    'Eliminates race conditions in concurrent message creation.';
