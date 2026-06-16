import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { todayISO } from "../lib/dates";

interface PeriodValue {
  year: number;
  month: number; // 1-12
  setPeriod: (year: number, month: number) => void;
  prevMonth: () => void;
  nextMonth: () => void;
}

const PeriodContext = createContext<PeriodValue | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [y, m] = todayISO().split("-").map(Number);
  const [year, setYear] = useState(y);
  const [month, setMonth] = useState(m);

  function setPeriod(ny: number, nm: number) {
    setYear(ny);
    setMonth(nm);
  }
  function prevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }
  function nextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }

  return (
    <PeriodContext.Provider value={{ year, month, setPeriod, prevMonth, nextMonth }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod должен использоваться внутри PeriodProvider");
  return ctx;
}
