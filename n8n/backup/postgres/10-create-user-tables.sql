CREATE TABLE IF NOT EXISTS user_reports (
    user_id INTEGER PRIMARY KEY,
    file_name TEXT NOT NULL,
    report JSONB NOT NULL
); 

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (user_id, key)
);