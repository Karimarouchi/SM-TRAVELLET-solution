CREATE DATABASE sm_travel;

\c sm_travel

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(40) NOT NULL,
  prenom VARCHAR(40) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  date_naissance DATE NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
