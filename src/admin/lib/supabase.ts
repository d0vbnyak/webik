import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Понятная ошибка в консоли вместо «тихих» падающих запросов
  console.error(
    "[admin] Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Скопируйте .env.example в .env и подставьте значения из Supabase.",
  );
}

export const supabase = createClient(url ?? "", anon ?? "");
