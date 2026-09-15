import { useEffect, type RefObject } from "react";

export type CanvasSize = { width: number; height: number };

/**
 * Цикл отрисовки canvas, который работает только пока холст виден.
 *
 * - Размер холста кэшируется и обновляется ResizeObserver'ом: getBoundingClientRect
 *   на каждом кадре заставлял браузер пересчитывать раскладку посреди прокрутки.
 * - Вне экрана requestAnimationFrame не крутится: десяток демо на странице не
 *   отнимает кадры у прокрутки.
 *
 * `setup` вызывается один раз и возвращает функцию кадра и, если нужно, уборку.
 */
export function useCanvasLoop(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  setup: (
    ctx: CanvasRenderingContext2D,
    size: CanvasSize,
  ) => { frame: () => void; resize?: () => void; cleanup?: () => void },
  deps: unknown[] = [],
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size: CanvasSize = { width: 0, height: 0 };
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      size.width = rect.width;
      size.height = rect.height;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    measure();

    const { frame, resize, cleanup } = setup(ctx, size);

    let raf = 0;
    let visible = false;
    const tick = () => {
      frame();
      raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(() => {
      measure();
      resize?.();
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !visible) {
        visible = true;
        raf = requestAnimationFrame(tick);
      } else if (!entry.isIntersecting && visible) {
        visible = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
