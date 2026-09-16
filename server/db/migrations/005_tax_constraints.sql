-- Инвариант «льготная ставка не выше полной» держим в базе, а не только в форме:
-- через /api/db настройки можно записать напрямую.
--
-- Отдельным файлом, а не правкой 004: 004 к этому моменту уже была применена в
-- локальной базе разработки, а применённые миграции не переписывают — иначе
-- базы разойдутся молча.
alter table settings add constraint settings_tax_rate_nonneg check (tax_rate >= 0);
alter table settings add constraint settings_reduced_not_above_full check (tax_reduced_rate <= tax_rate);
