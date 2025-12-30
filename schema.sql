-- ============================================
-- Music Studio Portal - Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create a Profile table to store user roles
-- Links to Supabase auth.users table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT,
  role TEXT CHECK (role IN ('teacher', 'student')) DEFAULT 'student',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create the Appointments table (The "Gatekeeper")
-- Controls access to lessons based on booking and payment status
CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id),
  student_id UUID REFERENCES profiles(id),
  starts_at TIMESTAMP WITH TIME ZONE,
  is_paid BOOLEAN DEFAULT FALSE,
  room_name TEXT, -- LiveKit room name for this appointment
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 4. Profiles Policies
-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE USING (auth.uid() = id);

-- 5. Appointments Policies
-- Teachers can see ALL appointments (admin view)
CREATE POLICY "Teachers see all" ON appointments
FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher'
);

-- Students can only see their OWN appointments
CREATE POLICY "Students see own" ON appointments
FOR SELECT USING (
  auth.uid() = student_id
);

-- ============================================
-- Optional: Auto-create profile on user signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'student');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile when a new user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
