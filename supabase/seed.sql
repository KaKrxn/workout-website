-- GENERATED FILE — do not edit by hand.
-- Run `npm run seed:generate` to regenerate from Report/data/program-seed.json.
--
-- Contains the 41 stock exercises only. Everything else is per-user and
-- is created by provisionUser() at signup (Report/02-data-model.md §8).
-- Safe to run more than once.

insert into exercises (
  id, owner_id, name, kind, muscle, secondary, equipment,
  rep_min, rep_max, duration_min_s, duration_max_s,
  per_side, is_key_lift, note, is_public
) values
  ('pushup', NULL, 'Push-up', 'bodyweight', 'chest', ARRAY['shoulders', 'arms']::text[], '{}'::text[], 8, 15, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('wide_pushup', NULL, 'Wide Push-up', 'bodyweight', 'chest', ARRAY['shoulders']::text[], '{}'::text[], 10, 15, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('pike_pushup', NULL, 'Pike Push-up', 'bodyweight', 'shoulders', ARRAY['arms']::text[], '{}'::text[], 6, 12, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('diamond_pushup', NULL, 'Diamond Push-up', 'bodyweight', 'arms', ARRAY['chest']::text[], '{}'::text[], 6, 12, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('decline_pushup', NULL, 'Decline Push-up', 'bodyweight', 'chest', ARRAY['shoulders']::text[], ARRAY['bench_flat']::text[], 8, 15, NULL, NULL, FALSE, FALSE, 'ใช้แทน Incline Dumbbell Press เพื่อเน้นอกบน (วางเท้าบนเบาะ)', TRUE),
  ('leg_raise', NULL, 'Leg Raise', 'bodyweight', 'core', '{}'::text[], '{}'::text[], 10, 15, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('plank', NULL, 'Plank', 'duration', 'core', '{}'::text[], '{}'::text[], NULL, NULL, 30, 60, FALSE, FALSE, NULL, TRUE),
  ('crunch', NULL, 'Crunch', 'bodyweight', 'core', '{}'::text[], '{}'::text[], 15, 20, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('bicycle_crunch', NULL, 'Bicycle Crunch', 'bodyweight', 'core', '{}'::text[], '{}'::text[], 15, 20, NULL, NULL, TRUE, FALSE, NULL, TRUE),
  ('bw_squat', NULL, 'Bodyweight Squat', 'bodyweight', 'legs', ARRAY['glutes']::text[], '{}'::text[], 15, 20, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('reverse_lunge', NULL, 'Reverse Lunge', 'bodyweight', 'legs', ARRAY['glutes']::text[], '{}'::text[], 10, 15, NULL, NULL, TRUE, FALSE, NULL, TRUE),
  ('split_squat', NULL, 'Split Squat', 'bodyweight', 'legs', ARRAY['glutes']::text[], '{}'::text[], 8, 12, NULL, NULL, TRUE, FALSE, NULL, TRUE),
  ('glute_bridge', NULL, 'Glute Bridge', 'bodyweight', 'glutes', ARRAY['legs']::text[], '{}'::text[], 15, 20, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('sl_glute_bridge', NULL, 'Single-leg Glute Bridge', 'bodyweight', 'glutes', ARRAY['legs']::text[], '{}'::text[], 10, 15, NULL, NULL, TRUE, FALSE, NULL, TRUE),
  ('calf_raise', NULL, 'Calf Raise', 'bodyweight', 'legs', '{}'::text[], '{}'::text[], 15, 25, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('reverse_snow_angel', NULL, 'Reverse Snow Angel', 'bodyweight', 'back_lat', ARRAY['shoulders']::text[], '{}'::text[], 12, 20, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('prone_ytw', NULL, 'Prone Y-T-W Raise', 'bodyweight', 'back_lat', ARRAY['shoulders']::text[], '{}'::text[], 8, 12, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('superman', NULL, 'Superman', 'bodyweight', 'back_lat', ARRAY['core']::text[], '{}'::text[], 12, 20, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('bird_dog', NULL, 'Bird Dog', 'bodyweight', 'core', ARRAY['back_lat']::text[], '{}'::text[], 10, 10, NULL, NULL, TRUE, FALSE, NULL, TRUE),
  ('db_bench_press', NULL, 'Dumbbell Bench Press', 'strength', 'chest', ARRAY['shoulders', 'arms']::text[], ARRAY['dumbbell_adj_25', 'bench_flat']::text[], 6, 12, NULL, NULL, FALSE, TRUE, NULL, TRUE),
  ('db_fly', NULL, 'Dumbbell Fly', 'strength', 'chest', '{}'::text[], ARRAY['dumbbell_adj_25', 'bench_flat']::text[], 10, 15, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('db_shoulder_press', NULL, 'Dumbbell Shoulder Press', 'strength', 'shoulders', ARRAY['arms']::text[], ARRAY['dumbbell_adj_25']::text[], 8, 12, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('db_lateral_raise', NULL, 'Dumbbell Lateral Raise', 'strength', 'shoulders', '{}'::text[], ARRAY['dumbbell_adj_25']::text[], 12, 20, NULL, NULL, FALSE, TRUE, NULL, TRUE),
  ('db_oh_tri_ext', NULL, 'Dumbbell Overhead Triceps Extension', 'strength', 'arms', '{}'::text[], ARRAY['dumbbell_adj_25']::text[], 10, 15, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('db_row_onearm', NULL, 'One-arm Dumbbell Row', 'strength', 'back_lat', ARRAY['arms']::text[], ARRAY['dumbbell_adj_25', 'bench_flat']::text[], 8, 12, NULL, NULL, TRUE, TRUE, NULL, TRUE),
  ('db_row_bentover', NULL, 'Bent-over Dumbbell Row', 'strength', 'back_lat', ARRAY['arms']::text[], ARRAY['dumbbell_adj_25']::text[], 8, 12, NULL, NULL, FALSE, TRUE, NULL, TRUE),
  ('db_pullover', NULL, 'Dumbbell Pullover', 'strength', 'back_lat', ARRAY['chest']::text[], ARRAY['dumbbell_adj_25', 'bench_flat']::text[], 10, 15, NULL, NULL, FALSE, TRUE, NULL, TRUE),
  ('db_rear_delt_fly', NULL, 'Rear Delt Fly', 'strength', 'shoulders', ARRAY['back_lat']::text[], ARRAY['dumbbell_adj_25']::text[], 12, 20, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('db_curl', NULL, 'Dumbbell Curl', 'strength', 'arms', '{}'::text[], ARRAY['dumbbell_adj_25']::text[], 8, 15, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('db_hammer_curl', NULL, 'Hammer Curl', 'strength', 'arms', '{}'::text[], ARRAY['dumbbell_adj_25']::text[], 8, 15, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('goblet_squat', NULL, 'Goblet Squat', 'strength', 'legs', ARRAY['glutes', 'core']::text[], ARRAY['dumbbell_adj_25']::text[], 8, 15, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('db_rdl', NULL, 'Dumbbell Romanian Deadlift', 'strength', 'legs', ARRAY['glutes', 'back_lat']::text[], ARRAY['dumbbell_adj_25']::text[], 8, 12, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('bulgarian_split', NULL, 'Bulgarian Split Squat', 'strength', 'legs', ARRAY['glutes']::text[], ARRAY['dumbbell_adj_25', 'bench_flat']::text[], 8, 12, NULL, NULL, TRUE, FALSE, NULL, TRUE),
  ('db_glute_bridge', NULL, 'Dumbbell Glute Bridge', 'strength', 'glutes', ARRAY['legs']::text[], ARRAY['dumbbell_adj_25']::text[], 10, 15, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('db_calf_raise', NULL, 'Dumbbell Calf Raise', 'strength', 'legs', '{}'::text[], ARRAY['dumbbell_adj_25']::text[], 15, 25, NULL, NULL, FALSE, FALSE, NULL, TRUE),
  ('db_lunge', NULL, 'Dumbbell Lunge', 'strength', 'legs', ARRAY['glutes']::text[], ARRAY['dumbbell_adj_25']::text[], 10, 10, NULL, NULL, TRUE, FALSE, NULL, TRUE),
  ('sl_rdl', NULL, 'Single-leg Romanian Deadlift', 'strength', 'legs', ARRAY['glutes']::text[], ARRAY['dumbbell_adj_25']::text[], 8, 12, NULL, NULL, TRUE, FALSE, 'ใช้เพิ่มความยากเมื่อดัมเบล 25 kg เริ่มเบาเกินไป', TRUE),
  ('treadmill', NULL, 'ลู่วิ่ง (เดินเร็ว / เดินชัน)', 'cardio', 'cardio', '{}'::text[], ARRAY['treadmill']::text[], NULL, NULL, 1500, 2400, FALSE, FALSE, NULL, TRUE),
  ('walk_easy', NULL, 'เดินเบา ๆ', 'cardio', 'cardio', '{}'::text[], '{}'::text[], NULL, NULL, 1200, 2400, FALSE, FALSE, NULL, TRUE),
  ('chin_tuck', NULL, 'Chin Tuck', 'duration', 'neck', '{}'::text[], '{}'::text[], 10, 15, NULL, NULL, FALSE, FALSE, 'ค้าง 3–5 วินาทีต่อครั้ง', TRUE),
  ('neck_curl', NULL, 'Neck Curl', 'bodyweight', 'neck', '{}'::text[], '{}'::text[], 10, 15, NULL, NULL, FALSE, FALSE, NULL, TRUE)
on conflict (id) do update set
  name           = excluded.name,
  kind           = excluded.kind,
  muscle         = excluded.muscle,
  secondary      = excluded.secondary,
  equipment      = excluded.equipment,
  rep_min        = excluded.rep_min,
  rep_max        = excluded.rep_max,
  duration_min_s = excluded.duration_min_s,
  duration_max_s = excluded.duration_max_s,
  per_side       = excluded.per_side,
  is_key_lift    = excluded.is_key_lift,
  note           = excluded.note,
  is_public      = excluded.is_public
where exercises.owner_id is null;
