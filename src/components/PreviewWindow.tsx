import { useEffect, useRef, useState, type ReactNode } from "react";

type PreviewWindowProps = {
  url: string;
  children: ReactNode;
};

/** Рамка в виде браузерного окна для живых демо.
 *
 *  Содержимое монтируется, когда окно подходит к экрану, и дальше остаётся
 *  на месте. Раньше оно размонтировалось при уходе за экран: высота окна
 *  схлопывалась до заглушки, и страница прыгала под пальцем при прокрутке
 *  (CLS 0.4–0.6 на «Возможностях»). Бесконечные canvas-циклы сами встают на
 *  паузу вне экрана — см. demos/useCanvasLoop.ts. */
export default function PreviewWindow({ url, children }: PreviewWindowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setMounted(true);
        io.disconnect();
      },
      // С запасом: тяжёлое демо успевает смонтироваться до того, как окно видно
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-black/[0.05] shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.05]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 flex justify-center">
          <span className="text-[10px] tracking-wide text-[#1a1a1a]/40 bg-zinc-100 rounded-full px-3 py-1 truncate max-w-[200px]">
            webik.ru/{url}
          </span>
        </div>
        <div className="w-10" aria-hidden="true" />
      </div>
      <div
        ref={ref}
        className="p-4 md:p-5 bg-zinc-50/60 min-h-[260px] flex flex-col justify-center"
      >
        {mounted ? children : null}
      </div>
    </div>
  );
}
