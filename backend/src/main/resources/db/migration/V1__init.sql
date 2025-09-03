-- Create table for storing expenses
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  category VARCHAR(64) NOT NULL,
  note VARCHAR(255),
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(16) NOT NULL CHECK (type IN ('INCOME','EXPENSE')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tx_date ON transactions(date);
CREATE INDEX idx_tx_category ON transactions(category);

