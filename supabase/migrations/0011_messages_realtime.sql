-- Publish message inserts so assigned chat members can receive them through
-- Supabase realtime. RLS on public.messages still controls who may see rows.
do $$
begin
  execute 'alter publication supabase_realtime add table public.messages';
exception
  when duplicate_object then
    null;
end;
$$;
