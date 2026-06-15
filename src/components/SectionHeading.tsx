import { motion } from "motion/react";
import type { ComponentProps } from "react";

type MotionH2Props = ComponentProps<typeof motion.h2>;

type SectionHeadingProps = {
  /** Тёмная часть заголовка (#1a1a1a) */
  title: string;
  /** Серая часть-продолжение (#8e8e8e) */
  accent?: string;
} & MotionH2Props;

/**
 * Двухцветный секционный заголовок: первая часть text-[#1a1a1a],
 * продолжение text-[#8e8e8e]. Прокидывает motion-пропсы (initial/whileInView/…)
 * и className, чтобы заменять ручные заголовки без потери анимаций.
 */
export default function SectionHeading({
  title,
  accent,
  className = "",
  ...rest
}: SectionHeadingProps) {
  return (
    <motion.h2
      className={`font-display font-medium tracking-tight ${className}`}
      {...rest}
    >
      <span className="text-[#1a1a1a]">{title}</span>
      {accent && <span className="text-[#8e8e8e]"> {accent}</span>}
    </motion.h2>
  );
}
