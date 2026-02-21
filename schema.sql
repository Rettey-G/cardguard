-- Create tables for CardGuard on Vercel Postgres

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  issuer VARCHAR(255),
  expiryDate DATE NOT NULL,
  kind VARCHAR(100) NOT NULL,
  profileId VARCHAR(255),
  renewalProviderId VARCHAR(255),
  renewUrl TEXT,
  notes TEXT,
  createdAt BIGINT NOT NULL,
  updatedAt BIGINT NOT NULL
);

-- Card types table
CREATE TABLE IF NOT EXISTS cardKinds (
  name VARCHAR(100) PRIMARY KEY,
  createdAt BIGINT NOT NULL
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  createdAt BIGINT NOT NULL
);

-- Renewal providers table
CREATE TABLE IF NOT EXISTS renewalProviders (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  createdAt BIGINT NOT NULL
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(50) PRIMARY KEY,
  reminderDays INTEGER DEFAULT 30,
  notificationsEnabled BOOLEAN DEFAULT false
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cards_expiry ON cards(expiryDate);
CREATE INDEX IF NOT EXISTS idx_cards_kind ON cards(kind);

-- Insert default card types
INSERT INTO cardKinds (name, createdAt) VALUES 
  ('Passport', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('National ID', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('Driving License', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('Credit Card', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('Debit Card', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('Insurance Card', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('Membership Card', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('Other', EXTRACT(EPOCH FROM NOW()) * 1000)
ON CONFLICT (name) DO NOTHING;

-- Insert default settings
INSERT INTO settings (key, reminderDays, notificationsEnabled) VALUES 
  ('app', 30, false)
ON CONFLICT (key) DO NOTHING;
