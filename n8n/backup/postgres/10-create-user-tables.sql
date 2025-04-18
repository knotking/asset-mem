CREATE TABLE IF NOT EXISTS user_reports (
    user_id BIGINT PRIMARY KEY,
    file_name TEXT NOT NULL,
    report JSONB NOT NULL
); 

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id BIGINT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (user_id, key)
);