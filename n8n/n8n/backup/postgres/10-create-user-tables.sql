CREATE TABLE IF NOT EXISTS user_reports (
    user_id INTEGER PRIMARY KEY,
    file_name TEXT NOT NULL,
    report JSONB NOT NULL
); 
