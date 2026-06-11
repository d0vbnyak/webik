import { motion } from "motion/react";
import type { ReactNode } from "react";
import PageHeader from "../components/PageHeader";
import PreviewWindow from "../components/PreviewWindow";
import TiltCard from "../components/demos/TiltCard";
import ParticleField from "../components/demos/ParticleField";
import ChatBot from "../components/demos/ChatBot";
import PriceCalculator from "../components/demos/PriceCalculator";
import Typewriter from "../components/demos/Typewriter";
import Accordion from "../components/demos/Accordion";
import DragBoard from "../components/demos/DragBoard";
import StatsCounter from "../components/demos/StatsCounter";
import BeforeAfter from "../components/demos/BeforeAfter";
import ThemeSwitch from "../components/demos/ThemeSwitch";

type Demo = {
  url: string;
  title: string;
  text: string;
  component: ReactNode;
};

const DEMOS: Demo[] = [
  {
    url: "3d-card",
    title: "3D-карточки",
    text: "Карточка следит за курсором и наклоняется в пространстве — живой акцент для тарифов и товаров.",
    component: <TiltCard />,
  },
  {
    url: "particles",
    title: "Живой фон из частиц",
    text: "Canvas-анимация в 60 fps реагирует на движение мыши. Эффектный фон для hero-секций.",
    component: <ParticleField />,
  },
  {
    url: "ai-chat",
    title: "AI-чат",
    text: "Мини-диалог с ботом: напишите сообщение — он ответит. Так выглядят наши боты для сайтов.",
    component: <ChatBot />,
  },
  {
    url: "calculator",
    title: "Калькулятор стоимости",
    text: "Слайдеры и опции пересчитывают цену мгновенно — посетитель сам собирает свой заказ.",
    component: <PriceCalculator />,
  },
  {
    url: "typewriter",
    title: "Печатающийся текст",
    text: "Заголовок набирает и стирает фразы по кругу — классика, которая всё ещё цепляет взгляд.",
    component: <Typewriter />,
  },
  {
    url: "faq",
    title: "Аккордеон FAQ",
    text: "Плавное раскрытие ответов с анимацией высоты — аккуратные FAQ-блоки без скачков вёрстки.",
    component: <Accordion />,
  },
  {
    url: "drag-board",
    title: "Drag-доска",
    text: "Стикеры можно хватать и перетаскивать внутри окна — физика и инерция из коробки.",
    component: <DragBoard />,
  },
  {
    url: "counters",
    title: "Анимированные счётчики",
    text: "Цифры оживают, когда блок попадает в кадр — идеален для секций «о компании в цифрах».",
    component: <StatsCounter />,
  },
  {
    url: "before-after",
    title: "До / после",
    text: "Слайдер сравнения: потяните ручку и посмотрите, как редизайн меняет восприятие сайта.",
    component: <BeforeAfter />,
  },
  {
    url: "dark-mode",
    title: "Тёмная тема",
    text: "Один клик — и интерфейс плавно перекрашивается. Делаем дизайн-системы с обеими темами.",
    component: <ThemeSwitch />,
  },
];

export default function Capabilities() {
  return (
    <section className="relative bg-bg-base pb-24 md:pb-32 overflow-hidden">
      <PageHeader
        title="Наши возможности"
        accent="— потрогайте вёрстку руками."
        subtitle="10 интерактивных мини-проектов прямо на этой странице: каждое окно — живой код, а не картинка. Всё это мы встраиваем в сайты клиентов."
      />

      <div className="max-w-7xl mx-auto px-8 md:px-16 lg:px-20 grid grid-cols-12 gap-x-4 md:gap-x-8">
        <div className="col-span-12 md:col-span-10 md:col-start-2">
          <div className="mt-14 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-start">
            {DEMOS.map((demo, i) => (
              <motion.div
                key={demo.url}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: (i % 2) * 0.1 }}
              >
                <PreviewWindow url={demo.url}>{demo.component}</PreviewWindow>
                <div className="px-2 pt-4">
                  <h2 className="font-display font-medium text-lg text-[#1a1a1a]">
                    {demo.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#1a1a1a]/55 max-w-md">
                    {demo.text}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
