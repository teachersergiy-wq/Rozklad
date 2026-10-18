-- Student recurring schedules and 14-day rolling lesson creation.
-- Additive migration. Auto-generation stays disabled until a teacher enables it per schedule.

create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.v2_schedule_settings (
  schedule_id uuid primary key references public.v2_schedules(id) on delete cascade,
  auto_schedule_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.v2_schedule_settings(schedule_id)
select id from public.v2_schedules
on conflict (schedule_id) do nothing;

create table if not exists public.v2_student_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.v2_schedules(id) on delete cascade,
  student_id uuid not null references public.v2_students(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- ISO: Monday=1
  lesson_time time not null,
  starts_on date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create unique index if not exists v2_student_schedule_rules_active_slot
  on public.v2_student_schedule_rules(schedule_id, student_id, weekday, lesson_time)
  where is_active;

create index if not exists v2_student_schedule_rules_due
  on public.v2_student_schedule_rules(schedule_id, weekday, starts_on)
  where is_active;

alter table public.v2_lessons
  add column if not exists schedule_rule_id uuid
    references public.v2_student_schedule_rules(id) on delete set null,
  add column if not exists schedule_occurrence_date date;

create unique index if not exists v2_lessons_schedule_occurrence_once
  on public.v2_lessons(schedule_rule_id, schedule_occurrence_date)
  where schedule_rule_id is not null and schedule_occurrence_date is not null;

create table if not exists public.v2_schedule_conflicts (
  id bigint generated always as identity primary key,
  schedule_id uuid not null references public.v2_schedules(id) on delete cascade,
  student_id uuid references public.v2_students(id) on delete set null,
  conflict_kind text not null check (conflict_kind in ('old_new', 'occupied_slot', 'generation_error')),
  occurrence_date date,
  slot_time time,
  old_lesson_id uuid references public.v2_lessons(id) on delete set null,
  new_lesson_id uuid references public.v2_lessons(id) on delete set null,
  lesson_id uuid references public.v2_lessons(id) on delete set null,
  conflicting_lesson_id uuid references public.v2_lessons(id) on delete set null,
  details text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists v2_schedule_conflicts_old_new_open
  on public.v2_schedule_conflicts(old_lesson_id, new_lesson_id)
  where conflict_kind = 'old_new' and resolved_at is null;

create unique index if not exists v2_schedule_conflicts_occupied_open
  on public.v2_schedule_conflicts(lesson_id, conflicting_lesson_id)
  where conflict_kind = 'occupied_slot' and resolved_at is null;

alter table public.v2_schedule_settings enable row level security;
alter table public.v2_student_schedule_rules enable row level security;
alter table public.v2_schedule_conflicts enable row level security;

grant select on public.v2_schedule_settings to authenticated;
grant select on public.v2_student_schedule_rules to authenticated;
grant select on public.v2_schedule_conflicts to authenticated;

drop policy if exists teacher_all_v2_schedule_settings on public.v2_schedule_settings;
create policy teacher_read_v2_schedule_settings on public.v2_schedule_settings
  for select to authenticated
  using (schedule_id in (select id from public.v2_schedules where owner_id = auth.uid()));

drop policy if exists teacher_all_v2_student_schedule_rules on public.v2_student_schedule_rules;
create policy teacher_read_v2_student_schedule_rules on public.v2_student_schedule_rules
  for select to authenticated
  using (schedule_id in (select id from public.v2_schedules where owner_id = auth.uid()));

drop policy if exists teacher_all_v2_schedule_conflicts on public.v2_schedule_conflicts;
create policy teacher_read_v2_schedule_conflicts on public.v2_schedule_conflicts
  for select to authenticated
  using (schedule_id in (select id from public.v2_schedules where owner_id = auth.uid()));

create or replace function public.v2_schedule_log_error(
  p_rule_id uuid,
  p_occurrence_date date,
  p_error text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.v2_student_schedule_rules;
begin
  select * into v_rule from public.v2_student_schedule_rules where id = p_rule_id;
  if not found then return; end if;

  insert into public.v2_schedule_conflicts
    (schedule_id, student_id, conflict_kind, occurrence_date, slot_time, details)
  values
    (v_rule.schedule_id, v_rule.student_id, 'generation_error', p_occurrence_date,
     v_rule.lesson_time, left(coalesce(p_error, 'Unknown error'), 1000));
end;
$$;

create or replace function public.v2_create_student_schedule_occurrence(
  p_rule_id uuid,
  p_occurrence_date date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.v2_student_schedule_rules;
  v_enabled boolean;
  v_lesson_id uuid;
  v_schedule_timezone text;
  v_old record;
  v_conflict record;
begin
  select * into v_rule
    from public.v2_student_schedule_rules
   where id = p_rule_id
   for update;
  if not found or not v_rule.is_active or p_occurrence_date < v_rule.starts_on then
    return null;
  end if;

  select coalesce(ss.auto_schedule_enabled, false), s.timezone
    into v_enabled, v_schedule_timezone
    from public.v2_schedules s
    left join public.v2_schedule_settings ss on ss.schedule_id = s.id
   where s.id = v_rule.schedule_id;
  if not found or not v_enabled then return null; end if;
  if p_occurrence_date < (now() at time zone v_schedule_timezone)::date then return null; end if;

  if exists (
    select 1 from public.v2_students st
     where st.id = v_rule.student_id
       and (st.archived_at is not null or st.schedule_id <> v_rule.schedule_id)
  ) then
    return null;
  end if;

  insert into public.v2_lessons
    (schedule_id, student_id, lesson_date, lesson_time, status,
     schedule_rule_id, schedule_occurrence_date)
  values
    (v_rule.schedule_id, v_rule.student_id, p_occurrence_date, v_rule.lesson_time,
     'planned', v_rule.id, p_occurrence_date)
  on conflict (schedule_rule_id, schedule_occurrence_date)
    where schedule_rule_id is not null and schedule_occurrence_date is not null
    do nothing
  returning id into v_lesson_id;

  if v_lesson_id is null then
    select id into v_lesson_id
      from public.v2_lessons
     where schedule_rule_id = v_rule.id
       and schedule_occurrence_date = p_occurrence_date
     limit 1;
    return v_lesson_id;
  end if;

  -- When a replacement rule schedules the same occurrence date, let the teacher
  -- choose which lesson to keep. The two rules remain visibly classified old/new.
  for v_old in
    select l.id
      from public.v2_lessons l
      join public.v2_student_schedule_rules old_rule on old_rule.id = l.schedule_rule_id
     where l.student_id = v_rule.student_id
       and l.schedule_id = v_rule.schedule_id
       and date_trunc('week', l.schedule_occurrence_date::timestamp)
           = date_trunc('week', p_occurrence_date::timestamp)
       and l.id <> v_lesson_id
       and old_rule.is_active = false
       and l.status = 'planned'
       and not exists (
         select 1 from public.v2_schedule_conflicts c
          where c.conflict_kind = 'old_new'
            and c.resolved_at is null
            and c.old_lesson_id = l.id
       )
     order by abs(l.schedule_occurrence_date - p_occurrence_date),
              l.schedule_occurrence_date, l.lesson_time
     limit 1
  loop
    insert into public.v2_schedule_conflicts
      (schedule_id, student_id, conflict_kind, occurrence_date, slot_time,
       old_lesson_id, new_lesson_id, details)
    values
      (v_rule.schedule_id, v_rule.student_id, 'old_new', p_occurrence_date,
       v_rule.lesson_time, v_old.id, v_lesson_id, 'Зіставте уроки за старим і новим графіком.')
    on conflict do nothing;
  end loop;

  -- Occupied slots are reported without moving or deleting either lesson.
  for v_conflict in
    select l.id, l.student_id
      from public.v2_lessons l
     where l.schedule_id = v_rule.schedule_id
       and l.lesson_date = p_occurrence_date
       and l.lesson_time = v_rule.lesson_time
       and l.status <> 'cancelled'
       and l.id <> v_lesson_id
       and not exists (
         select 1 from public.v2_schedule_conflicts c
          where c.conflict_kind = 'old_new'
            and c.resolved_at is null
            and c.old_lesson_id = l.id
            and c.new_lesson_id = v_lesson_id
       )
  loop
    insert into public.v2_schedule_conflicts
      (schedule_id, student_id, conflict_kind, occurrence_date, slot_time,
       lesson_id, conflicting_lesson_id, details)
    values
      (v_rule.schedule_id, v_rule.student_id, 'occupied_slot', p_occurrence_date,
       v_rule.lesson_time, v_lesson_id, v_conflict.id,
       'Час зайнятий іншим уроком. Перенесіть один із уроків вручну.')
    on conflict do nothing;
  end loop;

  return v_lesson_id;
end;
$$;

create or replace function public.v2_seed_student_schedule(p_student_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
  v_through date;
  v_count integer := 0;
  v_timezone text;
  v_rule record;
  v_date date;
  v_id uuid;
begin
  select s.timezone into v_timezone
    from public.v2_schedules s
    join public.v2_students st on st.schedule_id = s.id
   where st.id = p_student_id and st.schedule_id = s.id and st.archived_at is null;
  if not found then return 0; end if;

  v_today := (now() at time zone v_timezone)::date;
  v_through := v_today + 14;

  for v_rule in
    select r.* from public.v2_student_schedule_rules r
     where r.student_id = p_student_id and r.is_active
     order by r.weekday, r.lesson_time
  loop
    for v_date in
      select d::date
        from generate_series(greatest(v_today, v_rule.starts_on)::timestamp,
                             v_through::timestamp, interval '1 day') d
       where extract(isodow from d)::integer = v_rule.weekday
    loop
      v_id := public.v2_create_student_schedule_occurrence(v_rule.id, v_date);
      if v_id is not null then v_count := v_count + 1; end if;
    end loop;
  end loop;
  return v_count;
end;
$$;

create or replace function public.v2_replace_student_schedule(
  p_student_id uuid,
  p_start_date date,
  p_rules jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.v2_students;
  v_owner uuid;
  v_rule jsonb;
  v_weekday integer;
  v_time time;
  v_count integer := 0;
  v_generated integer := 0;
  v_enabled boolean;
  v_today date;
begin
  select * into v_student
    from public.v2_students
   where id = p_student_id
   for update;
  if not found or v_student.archived_at is not null then
    raise exception using errcode='P0001', message='STUDENT_NOT_ACTIVE';
  end if;

  select owner_id, (now() at time zone timezone)::date into v_owner, v_today
    from public.v2_schedules where id = v_student.schedule_id;
  if v_owner is distinct from auth.uid() then
    raise exception using errcode='42501', message='NOT_SCHEDULE_OWNER';
  end if;

  if p_start_date is null or p_start_date < v_today then
    raise exception using errcode='22023', message='START_DATE_MUST_BE_TODAY_OR_LATER';
  end if;
  if p_rules is null or jsonb_typeof(p_rules) <> 'array' then
    raise exception using errcode='22023', message='RULES_MUST_BE_AN_ARRAY';
  end if;

  update public.v2_student_schedule_rules
     set is_active = false, deactivated_at = now()
   where student_id = p_student_id and is_active;

  for v_rule in select value from jsonb_array_elements(p_rules)
  loop
    v_weekday := (v_rule->>'weekday')::integer;
    v_time := (v_rule->>'time')::time;
    if v_weekday < 1 or v_weekday > 7 or v_time is null then
      raise exception using errcode='22023', message='INVALID_WEEKDAY_OR_TIME';
    end if;

    insert into public.v2_student_schedule_rules
      (schedule_id, student_id, weekday, lesson_time, starts_on)
    values
      (v_student.schedule_id, p_student_id, v_weekday, v_time, p_start_date);
    v_count := v_count + 1;
  end loop;

  select coalesce(auto_schedule_enabled, false) into v_enabled
    from public.v2_schedule_settings where schedule_id = v_student.schedule_id;
  if coalesce(v_enabled, false) then
    v_generated := public.v2_seed_student_schedule(p_student_id);
  end if;

  return jsonb_build_object('rules', v_count, 'generated', v_generated,
                            'autoScheduleEnabled', coalesce(v_enabled, false));
end;
$$;

create or replace function public.v2_set_auto_schedule_enabled(
  p_schedule_id uuid,
  p_enabled boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_count integer := 0;
  v_student record;
begin
  select owner_id into v_owner from public.v2_schedules where id = p_schedule_id;
  if v_owner is distinct from auth.uid() then
    raise exception using errcode='42501', message='NOT_SCHEDULE_OWNER';
  end if;

  insert into public.v2_schedule_settings(schedule_id, auto_schedule_enabled, updated_at)
  values (p_schedule_id, coalesce(p_enabled, false), now())
  on conflict (schedule_id) do update
    set auto_schedule_enabled = excluded.auto_schedule_enabled,
        updated_at = now();

  if p_enabled then
    for v_student in
      select id from public.v2_students
       where schedule_id = p_schedule_id and archived_at is null
    loop
      v_count := v_count + public.v2_seed_student_schedule(v_student.id);
    end loop;
  end if;

  return jsonb_build_object('enabled', coalesce(p_enabled, false), 'generated', v_count);
end;
$$;

create or replace function public.v2_resolve_student_schedule_conflict(
  p_conflict_id bigint,
  p_keep_lesson_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict public.v2_schedule_conflicts;
  v_owner uuid;
  v_delete_lesson uuid;
begin
  select * into v_conflict
    from public.v2_schedule_conflicts
   where id = p_conflict_id and conflict_kind = 'old_new' and resolved_at is null
   for update;
  if not found then raise exception using errcode='P0001', message='CONFLICT_NOT_FOUND'; end if;

  select owner_id into v_owner from public.v2_schedules where id = v_conflict.schedule_id;
  if v_owner is distinct from auth.uid() then
    raise exception using errcode='42501', message='NOT_SCHEDULE_OWNER';
  end if;

  if p_keep_lesson_id = v_conflict.old_lesson_id then
    v_delete_lesson := v_conflict.new_lesson_id;
  elsif p_keep_lesson_id = v_conflict.new_lesson_id then
    v_delete_lesson := v_conflict.old_lesson_id;
  else
    raise exception using errcode='22023', message='KEEP_LESSON_MUST_BE_OLD_OR_NEW';
  end if;

  if v_delete_lesson is not null then
    delete from public.v2_lessons
     where id = v_delete_lesson and schedule_id = v_conflict.schedule_id and status = 'planned';
    if not found then raise exception using errcode='P0001', message='LESSON_CANNOT_BE_DELETED'; end if;
  end if;

  update public.v2_schedule_conflicts set resolved_at = now() where id = p_conflict_id;
end;
$$;

create or replace function public.v2_refresh_occupied_schedule_conflicts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    update public.v2_schedule_conflicts c
       set resolved_at = now()
     where c.conflict_kind = 'occupied_slot'
       and c.resolved_at is null
       and (c.lesson_id = case when tg_op = 'DELETE' then old.id else new.id end
            or c.conflicting_lesson_id = case when tg_op = 'DELETE' then old.id else new.id end)
       and (
       not exists (select 1 from public.v2_lessons where id = c.lesson_id and status <> 'cancelled')
       or not exists (select 1 from public.v2_lessons where id = c.conflicting_lesson_id and status <> 'cancelled')
       or not exists (
         select 1 from public.v2_lessons a
         join public.v2_lessons b on b.id = c.conflicting_lesson_id
         where a.id = c.lesson_id and a.lesson_date = b.lesson_date and a.lesson_time = b.lesson_time
           and a.status <> 'cancelled' and b.status <> 'cancelled'
       )
       );

    -- An old/new choice is no longer valid once either lesson is cancelled
    -- or removed. Resolve it automatically and leave the remaining lesson intact.
    update public.v2_schedule_conflicts c
       set resolved_at = now()
     where c.conflict_kind = 'old_new'
       and c.resolved_at is null
       and (
         c.old_lesson_id = case when tg_op = 'DELETE' then old.id else new.id end
         or c.new_lesson_id = case when tg_op = 'DELETE' then old.id else new.id end
         or c.old_lesson_id is null
         or c.new_lesson_id is null
       )
       and (
         c.old_lesson_id is null
         or not exists (
           select 1 from public.v2_lessons
            where id = c.old_lesson_id and status <> 'cancelled'
         )
         or c.new_lesson_id is null
         or not exists (
           select 1 from public.v2_lessons
            where id = c.new_lesson_id and status <> 'cancelled'
         )
       );
  exception when others then
    raise warning 'Could not refresh schedule conflicts: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace function public.v2_autofill_completed_schedule_lesson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  begin
    if old.status is distinct from 'completed' and new.status = 'completed'
       and new.schedule_rule_id is not null
       and new.schedule_occurrence_date is not null then
      select coalesce(auto_schedule_enabled, false) into v_enabled
        from public.v2_schedule_settings where schedule_id = new.schedule_id;
      if coalesce(v_enabled, false) then
        perform public.v2_create_student_schedule_occurrence(
          new.schedule_rule_id, new.schedule_occurrence_date + 14
        );
      end if;
    end if;
  exception when others then
    begin
      if new.schedule_rule_id is not null and new.schedule_occurrence_date is not null then
        perform public.v2_schedule_log_error(new.schedule_rule_id,
          new.schedule_occurrence_date + 14, sqlerrm);
      end if;
    exception when others then
      raise warning 'Could not record student schedule generation failure: %', sqlerrm;
    end;
  end;
  return new;
end;
$$;

create or replace function public.v2_process_due_student_schedules()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_schedule record;
  v_due_date date;
  v_count integer := 0;
begin
  for v_schedule in
    select s.id, s.timezone
      from public.v2_schedules s
      join public.v2_schedule_settings ss on ss.schedule_id = s.id
     where ss.auto_schedule_enabled
  loop
    v_due_date := (now() at time zone v_schedule.timezone)::date - 1;

    for v_rule in
      select r.*
        from public.v2_student_schedule_rules r
        join public.v2_students st on st.id = r.student_id
       where r.schedule_id = v_schedule.id
         and r.is_active
         and st.archived_at is null
         and r.starts_on <= v_due_date
         and r.weekday = extract(isodow from v_due_date)::integer
    loop
      begin
        if public.v2_create_student_schedule_occurrence(
             v_rule.id, v_due_date + 14
           ) is not null then
          v_count := v_count + 1;
        end if;
      exception when others then
        perform public.v2_schedule_log_error(v_rule.id, v_due_date + 14, sqlerrm);
      end;
    end loop;
  end loop;

  update public.v2_schedule_conflicts c
     set resolved_at = now()
   where c.conflict_kind = 'occupied_slot' and c.resolved_at is null
     and (
       not exists (select 1 from public.v2_lessons where id = c.lesson_id and status <> 'cancelled')
       or not exists (select 1 from public.v2_lessons where id = c.conflicting_lesson_id and status <> 'cancelled')
       or not exists (
         select 1 from public.v2_lessons a
         join public.v2_lessons b on b.id = c.conflicting_lesson_id
         where a.id = c.lesson_id and a.lesson_date = b.lesson_date and a.lesson_time = b.lesson_time
           and a.status <> 'cancelled' and b.status <> 'cancelled'
       )
     );

  -- Reconcile old/new conflicts in case a lesson was removed and its FK was
  -- cleared after the lesson trigger ran.
  update public.v2_schedule_conflicts c
     set resolved_at = now()
   where c.conflict_kind = 'old_new'
     and c.resolved_at is null
     and (
       c.old_lesson_id is null
       or c.new_lesson_id is null
       or not exists (
         select 1 from public.v2_lessons
          where id = c.old_lesson_id and status <> 'cancelled'
       )
       or not exists (
         select 1 from public.v2_lessons
          where id = c.new_lesson_id and status <> 'cancelled'
       )
     );
  return v_count;
end;
$;

drop trigger if exists v2_autofill_completed_schedule_lesson on public.v2_lessons;
create trigger v2_autofill_completed_schedule_lesson
  after update of status on public.v2_lessons
  for each row execute function public.v2_autofill_completed_schedule_lesson();

drop trigger if exists v2_refresh_occupied_schedule_conflicts on public.v2_lessons;
create trigger v2_refresh_occupied_schedule_conflicts
  after update of lesson_date, lesson_time, status or delete on public.v2_lessons
  for each row execute function public.v2_refresh_occupied_schedule_conflicts();

revoke all on function public.v2_schedule_log_error(uuid, date, text) from public, anon, authenticated;
revoke all on function public.v2_create_student_schedule_occurrence(uuid, date) from public, anon, authenticated;
revoke all on function public.v2_seed_student_schedule(uuid) from public, anon, authenticated;
revoke all on function public.v2_refresh_occupied_schedule_conflicts() from public, anon, authenticated;
revoke all on function public.v2_autofill_completed_schedule_lesson() from public, anon, authenticated;
revoke all on function public.v2_process_due_student_schedules() from public, anon, authenticated;

revoke all on function public.v2_replace_student_schedule(uuid, date, jsonb) from public, anon;
grant execute on function public.v2_replace_student_schedule(uuid, date, jsonb) to authenticated;
revoke all on function public.v2_set_auto_schedule_enabled(uuid, boolean) from public, anon;
grant execute on function public.v2_set_auto_schedule_enabled(uuid, boolean) to authenticated;
revoke all on function public.v2_resolve_student_schedule_conflict(bigint, uuid) from public, anon;
grant execute on function public.v2_resolve_student_schedule_conflict(bigint, uuid) to authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'v2-student-schedule-autofill';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'v2-student-schedule-autofill',
    '5 22 * * *',
    'select public.v2_process_due_student_schedules();'
  );
end;
$$;
