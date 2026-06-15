import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

// ограничения: не больше 8 файлов и 5 МБ на файл
const MAX_FILES = 8;
const MAX_SIZE = 5 * 1024 * 1024;

type Item = {
  id: string;
  name: string;
  size: number;
  preview: string | null;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} кб`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} мб`;
}

/**
 * Drag-and-drop загрузка с превью изображений.
 * Эмуляция: файлы не уходят на сервер — превью читаются локально через FileReader.
 */
export default function FileDropzone() {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  // зеркало items для очистки objectURL при размонтировании
  const itemsRef = useRef<Item[]>(items);
  itemsRef.current = items;

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    // фильтруем по типу и размеру — и брошенные, и выбранные файлы
    const accepted = Array.from(fileList).filter(
      (file) => file.type.startsWith("image/") && file.size <= MAX_SIZE,
    );
    if (accepted.length === 0) return;

    setItems((prev) => {
      const room = MAX_FILES - prev.length;
      if (room <= 0) return prev;
      const next = accepted.slice(0, room).map<Item>((file) => ({
        id: `${uid}-${file.name}-${file.size}-${crypto.randomUUID()}`,
        name: file.name,
        size: file.size,
        // objectURL вместо тяжёлого data-URL; освобождаем при удалении/размонтировании
        preview: URL.createObjectURL(file),
      }));
      return [...prev, ...next];
    });
  };

  const remove = (id: string) =>
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((it) => it.id !== id);
    });

  // освобождаем все objectURL при размонтировании
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => {
        if (it.preview) URL.revokeObjectURL(it.preview);
      });
    };
  }, []);

  return (
    <div className="w-full max-w-[440px] mx-auto space-y-3">
      <label
        htmlFor={`${uid}-input`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e: React.DragEvent<HTMLLabelElement>) => {
          e.preventDefault();
          setOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-6 text-center cursor-pointer transition-colors ${
          over
            ? "border-brand-green bg-brand-green/10"
            : "border-black/15 bg-white hover:border-black/30"
        }`}
      >
        <span
          aria-hidden="true"
          className={`text-xl transition-colors ${over ? "text-[#1a1a1a]" : "text-[#1a1a1a]/40"}`}
        >
          ⤓
        </span>
        <span className="text-sm text-[#1a1a1a]/70">
          перетащите файлы или{" "}
          <span className="text-[#1a1a1a] underline underline-offset-2">
            выберите
          </span>
        </span>
        <span className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
          png, jpg — превью без загрузки на сервер
        </span>
        <input
          ref={inputRef}
          id={`${uid}-input`}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {items.length > 0 && (
        <ul className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.li
                key={it.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-3 rounded-xl border border-black/[0.05] bg-white p-2 shadow-sm"
              >
                <span className="grid place-items-center w-9 h-9 shrink-0 overflow-hidden rounded-lg bg-[#1a1a1a]/[0.04]">
                  {it.preview ? (
                    <img
                      src={it.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[#1a1a1a]/30 text-xs">img</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-[#1a1a1a]">
                    {it.name}
                  </span>
                  <span className="block text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
                    {formatSize(it.size)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  aria-label={`удалить ${it.name}`}
                  className="grid place-items-center w-6 h-6 shrink-0 rounded-full text-[#1a1a1a]/40 hover:bg-[#ef4444]/10 hover:text-[#ef4444] transition-colors"
                >
                  ✕
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
