CREATE TABLE IF NOT EXISTS avis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name VARCHAR(120) NOT NULL,
  author_country VARCHAR(80),
  author_photo TEXT,
  programme VARCHAR(120),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5) DEFAULT 5,
  content TEXT NOT NULL,
  source VARCHAR(20) DEFAULT 'manual', -- 'manual' | 'student'
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
