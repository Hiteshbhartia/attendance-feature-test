-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'employee');
CREATE TYPE public.job_role AS ENUM ('full-time', 'intern');
CREATE TYPE public.shift_type AS ENUM ('FT_MAIN', 'FT_EARLY', 'INTERN_DAY', 'CUSTOM');
CREATE TYPE public.day_status AS ENUM ('Early', 'On Time', 'Late', 'Absent');
CREATE TYPE public.work_mode AS ENUM ('Present', 'Break', 'Field', 'WFH', 'Absent');
CREATE TYPE public.session_type AS ENUM ('work', 'break', 'field');
CREATE TYPE public.task_status AS ENUM ('todo','in_progress','blocked','pending_review','completed','overdue','cancelled');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE public.leave_type AS ENUM ('casual','sick','earned','comp_off','lop','other');
CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected','cancelled');
CREATE TYPE public.holiday_type AS ENUM ('national','regional','optional','restricted');
CREATE TYPE public.notice_type AS ENUM ('general','warning','urgent');

-- ============ TIMESTAMPS HELPER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ USER ROLES (security-definer pattern) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager'))
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ OFFICE ZONES ============
CREATE TABLE public.office_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 100,
  week_off_day TEXT DEFAULT 'Tuesday',
  shift_start TEXT DEFAULT '10:00',
  shift_end TEXT DEFAULT '19:00',
  grace_minutes INTEGER DEFAULT 15,
  early_grace_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.office_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read zones" ON public.office_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage zones" ON public.office_zones FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_office_zones_updated BEFORE UPDATE ON public.office_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROFILES (employee directory) ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  date_of_birth DATE,
  job_role public.job_role,
  profile_photo TEXT,
  office_zone_id UUID REFERENCES public.office_zones(id) ON DELETE SET NULL,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_name TEXT DEFAULT '',
  department TEXT DEFAULT '',
  -- Work schedule (denormalized — matches your Mongo embedded doc)
  shift_type public.shift_type DEFAULT 'CUSTOM',
  shift_start_time TEXT DEFAULT '',
  shift_end_time TEXT DEFAULT '',
  break_duration INTEGER DEFAULT 0,
  breaks JSONB DEFAULT '[]'::jsonb,
  week_offs TEXT[] DEFAULT '{}',
  is_custom_shift BOOLEAN DEFAULT false,
  schedule_locked BOOLEAN DEFAULT false,
  schedule_set_by TEXT DEFAULT 'employee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Managers view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + default 'employee' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    false
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ATTENDANCE POLICIES (org-wide, single row pattern) ============
CREATE TABLE public.attendance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  late_grace_minutes INTEGER DEFAULT 10,
  late_mark_after_minutes INTEGER DEFAULT 15,
  half_day_threshold_minutes INTEGER DEFAULT 240,
  absent_threshold_minutes INTEGER DEFAULT 480,
  late_deduction_enabled BOOLEAN DEFAULT false,
  late_deduction_per_incident NUMERIC DEFAULT 0,
  standard_working_hours_per_day NUMERIC DEFAULT 9,
  weekly_off_days TEXT[] DEFAULT ARRAY['Sunday'],
  overtime_enabled BOOLEAN DEFAULT false,
  overtime_threshold_minutes INTEGER DEFAULT 540,
  overtime_multiplier NUMERIC DEFAULT 1.5,
  max_overtime_hours_per_day NUMERIC DEFAULT 4,
  max_overtime_hours_per_month NUMERIC DEFAULT 40,
  auto_mark_absent BOOLEAN DEFAULT true,
  auto_mark_absent_after_midnight BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read policy" ON public.attendance_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage policy" ON public.attendance_policies FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_policies_updated BEFORE UPDATE ON public.attendance_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ATTENDANCE (one row per employee per day) ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_status public.day_status DEFAULT 'Absent',
  total_work_mins INTEGER NOT NULL DEFAULT 0,
  total_break_mins INTEGER NOT NULL DEFAULT 0,
  late_by_mins INTEGER NOT NULL DEFAULT 0,
  early_by_mins INTEGER NOT NULL DEFAULT 0,
  is_checked_in BOOLEAN NOT NULL DEFAULT false,
  is_on_break BOOLEAN NOT NULL DEFAULT false,
  is_in_field BOOLEAN NOT NULL DEFAULT false,
  work_mode public.work_mode NOT NULL DEFAULT 'Absent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);
CREATE INDEX idx_attendance_date ON public.attendance(date);
CREATE INDEX idx_attendance_employee ON public.attendance(employee_id);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view own attendance" ON public.attendance FOR SELECT TO authenticated USING (auth.uid() = employee_id);
CREATE POLICY "Managers view all attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Employees insert own attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (auth.uid() = employee_id);
CREATE POLICY "Employees update own attendance" ON public.attendance FOR UPDATE TO authenticated USING (auth.uid() = employee_id) WITH CHECK (auth.uid() = employee_id);
CREATE POLICY "Admins manage attendance" ON public.attendance FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ATTENDANCE SESSIONS (each check-in/out cycle, with geo) ============
CREATE TABLE public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ,
  type public.session_type NOT NULL DEFAULT 'work',
  minutes INTEGER NOT NULL DEFAULT 0,
  work_minutes INTEGER NOT NULL DEFAULT 0,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  check_in_selfie TEXT,
  check_out_selfie TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_attendance ON public.attendance_sessions(attendance_id);
CREATE INDEX idx_sessions_employee ON public.attendance_sessions(employee_id);
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view own sessions" ON public.attendance_sessions FOR SELECT TO authenticated USING (auth.uid() = employee_id);
CREATE POLICY "Managers view all sessions" ON public.attendance_sessions FOR SELECT TO authenticated USING (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Employees insert own sessions" ON public.attendance_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = employee_id);
CREATE POLICY "Employees update own sessions" ON public.attendance_sessions FOR UPDATE TO authenticated USING (auth.uid() = employee_id) WITH CHECK (auth.uid() = employee_id);
CREATE POLICY "Admins manage sessions" ON public.attendance_sessions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  assigned_to UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to_name TEXT NOT NULL,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by_name TEXT NOT NULL,
  due_date DATE,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'todo',
  team_name TEXT DEFAULT '',
  completion_note TEXT DEFAULT '',
  completion_photo TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_assignee ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assignees view own tasks" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = assigned_to OR auth.uid() = assigned_by);
CREATE POLICY "Managers view all tasks" ON public.tasks FOR SELECT TO authenticated USING (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Managers create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Assignees update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = assigned_to) WITH CHECK (auth.uid() = assigned_to);
CREATE POLICY "Managers manage tasks" ON public.tasks FOR ALL TO authenticated USING (public.is_manager_or_admin(auth.uid())) WITH CHECK (public.is_manager_or_admin(auth.uid()));
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LEAVES ============
CREATE TABLE public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  leave_type public.leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC NOT NULL CHECK (total_days >= 0.5),
  reason TEXT NOT NULL,
  status public.leave_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_by_name TEXT,
  review_note TEXT DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  is_half_day BOOLEAN NOT NULL DEFAULT false,
  half_day_session TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leaves_employee_status ON public.leaves(employee_id, status);
CREATE INDEX idx_leaves_dates ON public.leaves(start_date, end_date);
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view own leaves" ON public.leaves FOR SELECT TO authenticated USING (auth.uid() = employee_id);
CREATE POLICY "Managers view all leaves" ON public.leaves FOR SELECT TO authenticated USING (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Employees create own leaves" ON public.leaves FOR INSERT TO authenticated WITH CHECK (auth.uid() = employee_id);
CREATE POLICY "Employees update own pending leaves" ON public.leaves FOR UPDATE TO authenticated USING (auth.uid() = employee_id AND status = 'pending') WITH CHECK (auth.uid() = employee_id);
CREATE POLICY "Managers review leaves" ON public.leaves FOR UPDATE TO authenticated USING (public.is_manager_or_admin(auth.uid())) WITH CHECK (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Admins manage leaves" ON public.leaves FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_leaves_updated BEFORE UPDATE ON public.leaves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ HOLIDAYS ============
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL UNIQUE,
  year INTEGER NOT NULL,
  type public.holiday_type NOT NULL DEFAULT 'national',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_holidays_year ON public.holidays(year);
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read holidays" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage holidays" ON public.holidays FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_holidays_updated BEFORE UPDATE ON public.holidays FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NOTICES ============
CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type public.notice_type NOT NULL DEFAULT 'general',
  target_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_name TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_by_name TEXT NOT NULL,
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notices_target ON public.notices(target_id, created_at DESC);
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read targeted or broadcast notices" ON public.notices FOR SELECT TO authenticated USING (target_id IS NULL OR target_id = auth.uid() OR public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Managers create notices" ON public.notices FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Managers update notices" ON public.notices FOR UPDATE TO authenticated USING (public.is_manager_or_admin(auth.uid())) WITH CHECK (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Admins delete notices" ON public.notices FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Seed default attendance policy
INSERT INTO public.attendance_policies DEFAULT VALUES;