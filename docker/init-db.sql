-- Automatically create test database alongside default development database
SELECT 'CREATE DATABASE rakamin_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rakamin_test')\gexec

