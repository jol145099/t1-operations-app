-- Add staff/vendor identity separate from optional gameplay grade.
alter table public.players add column if not exists personnel_type text not null default '打手';

alter table public.players drop constraint if exists players_personnel_type_check;
alter table public.players add constraint players_personnel_type_check
  check (personnel_type in ('打手','客服','店長','考官','合作廠商'));

-- Grade is optional for non-player personnel. 娛樂女陪 remains a grade/category option.
alter table public.players drop constraint if exists players_player_grade_check;
alter table public.players add constraint players_player_grade_check
  check (player_grade is null or player_grade in ('SR','S','A','B','娛樂女陪'));
