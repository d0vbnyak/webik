import { useId, useState } from "react";

import grafit from "../../assets/products/grafit.webp";
import korall from "../../assets/products/korall.webp";
import lime from "../../assets/products/lime.webp";
import peach from "../../assets/products/peach.webp";
import sirenivyi from "../../assets/products/sirenivyi.webp";
import sky from "../../assets/products/sky.webp";

type Variant = { id: string; label: string; swatch: string; img: string };

// Цвет-свотч подобран под кожу кроссовка на фото
const VARIANTS: Variant[] = [
  { id: "lime", label: "лайм", swatch: "#bdec00", img: lime },
  { id: "sky", label: "небо", swatch: "#8cc1e4", img: sky },
  { id: "sirenivyi", label: "сирень", swatch: "#d6abdf", img: sirenivyi },
  { id: "peach", label: "персик", swatch: "#f3ae8b", img: peach },
  { id: "korall", label: "коралл", swatch: "#f56a55", img: korall },
  { id: "grafit", label: "графит", swatch: "#41444a", img: grafit },
];

export default function ColorCustomizer() {
  const uid = useId();
  const [active, setActive] = useState<string>("lime");
  const current = VARIANTS.find((v) => v.id === active) ?? VARIANTS[0];

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Карточка товара: тонкая тёмная скруглённая обводка вокруг фото */}
      <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-[28px] border border-[#1a1a1a] bg-white shadow-sm">
        {/* Все варианты предзагружены и стопкой — клик даёт плавный кроссфейд */}
        {VARIANTS.map((v) => (
          <img
            key={v.id}
            src={v.img}
            alt={`кроссовки, цвет ${v.label}`}
            draggable={false}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              v.id === active ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>

      <div className="flex w-full max-w-[260px] items-center justify-between">
        <div className="leading-tight">
          <div className="font-display font-medium text-[#1a1a1a]">кроссовки</div>
          <div className="text-[11px] lowercase text-[#1a1a1a]/45">
            цвет: {current.label}
          </div>
        </div>
        <div className="font-display font-medium text-[#1a1a1a]">9 990 ₽</div>
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-2.5"
        role="radiogroup"
        aria-label="Выбор цвета кроссовок"
      >
        {VARIANTS.map((v) => {
          const isActive = v.id === active;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={v.label}
              id={`${uid}-${v.id}`}
              onClick={() => setActive(v.id)}
              className="group relative flex h-10 w-10 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#1a1a1a] focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
            >
              <span
                className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-transform ${
                  isActive
                    ? "scale-110 ring-2 ring-[#1a1a1a] ring-offset-2 ring-offset-bg-base"
                    : "group-hover:scale-105"
                }`}
                style={{
                  backgroundColor: v.swatch,
                  boxShadow: "inset 0 0 0 1px rgba(26,26,26,0.12)",
                }}
              >
                {isActive && (
                  // галочка с mix-blend-difference — контрастна на любом свотче
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-white mix-blend-difference"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
