DROP TABLE IF EXISTS pending_request;

CREATE TABLE pending_request (
    gate_dept_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    type VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    establishment_id INTEGER NOT NULL
);
