-- Налоговый вычет самозанятого: 10 000 ₽ на всё время работы. Тратится не
-- целиком с налога, а разницей между полной и льготной ставкой (для юрлиц —
-- 6% и 4%). Правила расчёта — src/admin/lib/finance.ts, taxWithDeduction.
alter table settings add column tax_reduced_rate numeric(5,2) not null default 4 check (tax_reduced_rate >= 0);
alter table settings add column tax_deduction_start numeric(14,2) not null default 10000 check (tax_deduction_start >= 0);

-- Инвариант «льготная ставка не выше полной» держим в базе, а не только в форме:
-- через /api/db настройки можно записать напрямую.
alter table settings add constraint settings_tax_rate_nonneg check (tax_rate >= 0);
alter table settings add constraint settings_reduced_not_above_full check (tax_reduced_rate <= tax_rate);
