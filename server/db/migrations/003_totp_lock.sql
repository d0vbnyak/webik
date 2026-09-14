-- Повторный аудит (14.09.2026): неудачи второго фактора считаются в базе, а не
-- в памяти процесса — счётчик не сбрасывается деплоем и его не вытеснить флудом.
alter table users add column totp_failures int not null default 0;
alter table users add column totp_locked_until timestamptz;
