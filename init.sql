CREATE TABLE strings (
    id SERIAL PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO strings (value) VALUES ('hello world');
