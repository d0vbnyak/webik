import { motion } from "motion/react";
import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Тёмная часть заголовка */
  title: ReactNode;
  /** Серая часть заголовка */
  accent?: ReactNode;
  subtitle?: ReactNode;
};

export default function PageHeader({ title, accent, subtitle }: PageHeaderProps) {
  return (
    <div className="max-w-7xl w-full mx-auto px-8 md:px-16 lg:px-20 grid grid-cols-12 gap-x-4 md:gap-x-8 pt-32 sm:pt-40 md:pt-44">
      <div className="col-span-12 md:col-span-10 md:col-start-2">
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="font-display font-medium tracking-tight text-[2.35rem] leading-[1.12] sm:text-5xl lg:text-6xl"
        >
          <span className="text-[#1a1a1a]">{title}</span>
          {accent && <span className="text-[#8e8e8e]"> {accent}</span>}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed text-[#1a1a1a]/60"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </div>
  );
}
