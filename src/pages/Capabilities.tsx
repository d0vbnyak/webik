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

// Шаблоны виджетов для сайта клиента (0 — CTA, 1-29 — интерактивы)
import OrderIdeaCard from "../components/demos/OrderIdeaCard";
import MortgageCalc from "../components/demos/MortgageCalc";
import PlanConfigurator from "../components/demos/PlanConfigurator";
import RoiCalculator from "../components/demos/RoiCalculator";
import CurrencyConverter from "../components/demos/CurrencyConverter";
import SavingsCompare from "../components/demos/SavingsCompare";
import PhotoBeforeAfter from "../components/demos/PhotoBeforeAfter";
import ColorCustomizer from "../components/demos/ColorCustomizer";
import ImageZoom from "../components/demos/ImageZoom";
import LightboxGallery from "../components/demos/LightboxGallery";
import FortuneWheel from "../components/demos/FortuneWheel";
import ScratchCard from "../components/demos/ScratchCard";
import MemoryGame from "../components/demos/MemoryGame";
import CountdownTimer from "../components/demos/CountdownTimer";
import GoalThermometer from "../components/demos/GoalThermometer";
import QuizSteps from "../components/demos/QuizSteps";
import LiveValidationForm from "../components/demos/LiveValidationForm";
import SlotBooking from "../components/demos/SlotBooking";
import FileDropzone from "../components/demos/FileDropzone";
import OfferWizard from "../components/demos/OfferWizard";
import MiniDashboard from "../components/demos/MiniDashboard";
import CatalogFilter from "../components/demos/CatalogFilter";
import SortableTable from "../components/demos/SortableTable";
import AutocompleteSearch from "../components/demos/AutocompleteSearch";
import WeatherWidget from "../components/demos/WeatherWidget";
import ParticleCursor from "../components/demos/ParticleCursor";
import ScrollDrawSVG from "../components/demos/ScrollDrawSVG";
import KanbanReorder from "../components/demos/KanbanReorder";
import SignaturePad from "../components/demos/SignaturePad";
import QRGenerator from "../components/demos/QRGenerator";

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
    text: "Живой бот, а не заготовки: отвечает нейросетью по базе знаний студии. Спросите что угодно о нас.",
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

// 29 готовых виджет-интерактивов + карточка «закажи свою идею» в начале (CTA, не интерактив)
const WIDGETS: Demo[] = [
  {
    url: "your-idea",
    title: "Заказать свою идею",
    text: "Не нашли нужный виджет? Опишите задачу — соберём интерактив специально под ваш сайт.",
    component: <OrderIdeaCard />,
  },
  {
    url: "mortgage",
    title: "Ипотечный калькулятор",
    text: "Слайдеры суммы, ставки и срока пересчитывают платёж и переплату в реальном времени, с мини-графиком остатка.",
    component: <MortgageCalc />,
  },
  {
    url: "tariff",
    title: "Конфигуратор тарифа",
    text: "Тумблеры опций включают и выключают возможности — цена пересобирается с анимацией прямо на глазах.",
    component: <PlanConfigurator />,
  },
  {
    url: "roi",
    title: "ROI-калькулятор",
    text: "Введите вложения и доход — виджет покажет срок окупаемости и растущую полосу прибыли.",
    component: <RoiCalculator />,
  },
  {
    url: "currency",
    title: "Конвертер валют",
    text: "Мгновенный пересчёт по демо-курсам и переключение направления одной кнопкой.",
    component: <CurrencyConverter />,
  },
  {
    url: "savings",
    title: "Сколько сэкономите",
    text: "Два сценария рядом — разница в деньгах подсвечена и пересчитывается на ходу.",
    component: <SavingsCompare />,
  },
  {
    url: "before-after-photo",
    title: "Слайдер «было / стало»",
    text: "Перетащите разделитель по двум фото и сравните, как меняется кадр после обработки.",
    component: <PhotoBeforeAfter />,
  },
  {
    url: "color",
    title: "Кастомайзер цвета",
    text: "Клик по палитре мгновенно перекрашивает изделие — удобно для карточек товара.",
    component: <ColorCustomizer />,
  },
  {
    url: "zoom",
    title: "Лупа-зум по фото",
    text: "Наведите курсор — область под ним увеличивается, как настоящая лупа.",
    component: <ImageZoom />,
  },
  {
    url: "gallery",
    title: "Галерея с лайтбоксом",
    text: "Миниатюры открываются в крупном виде, между фото можно листать свайпом и стрелками.",
    component: <LightboxGallery />,
  },
  {
    url: "wheel",
    title: "Колесо фортуны",
    text: "Крутите барабан — выпадает скидка или промокод. Геймификация, которая поднимает конверсию.",
    component: <FortuneWheel />,
  },
  {
    url: "scratch",
    title: "Скретч-карта",
    text: "Сотрите серебристый слой пальцем или курсором — под ним прячется приз.",
    component: <ScratchCard />,
  },
  {
    url: "memory",
    title: "Игра «собери пары»",
    text: "Мемори на сетке карточек: переворачивайте и ищите совпадения. Удержит внимание на сайте.",
    component: <MemoryGame />,
  },
  {
    url: "countdown",
    title: "Таймер обратного отсчёта",
    text: "Тикает посекундно до нужной даты — создаёт ощущение срочности для акций.",
    component: <CountdownTimer />,
  },
  {
    url: "goal",
    title: "Термометр цели",
    text: "Шкала сбора заполняется по мере прогресса — наглядно для краудфандинга и акций.",
    component: <GoalThermometer />,
  },
  {
    url: "quiz",
    title: "Многошаговый квиз",
    text: "Прогресс-бар и плавные переходы ведут посетителя к подобранному решению.",
    component: <QuizSteps />,
  },
  {
    url: "form",
    title: "Живая валидация формы",
    text: "Поля подсвечиваются прямо при вводе — пользователь видит ошибки ещё до отправки.",
    component: <LiveValidationForm />,
  },
  {
    url: "booking",
    title: "Запись на приём",
    text: "Кликните по свободному слоту в расписании — и время забронировано.",
    component: <SlotBooking />,
  },
  {
    url: "upload",
    title: "Загрузка файлов",
    text: "Перетащите изображения в зону — появятся превью. Всё без перезагрузки страницы.",
    component: <FileDropzone />,
  },
  {
    url: "offer",
    title: "Визард предложения",
    text: "Пошаговый выбор собирает итоговую смету — клиент видит цену сразу.",
    component: <OfferWizard />,
  },
  {
    url: "dashboard",
    title: "Дашборд с графиками",
    text: "Анимированные метрики и графики с тултипами при наведении — личный кабинет в миниатюре.",
    component: <MiniDashboard />,
  },
  {
    url: "filter",
    title: "Живой фильтр каталога",
    text: "Чекбоксы и слайдер цены перестраивают сетку товаров без перезагрузки.",
    component: <CatalogFilter />,
  },
  {
    url: "table",
    title: "Сортируемая таблица",
    text: "Клик по заголовку переупорядочивает строки с плавной анимацией.",
    component: <SortableTable />,
  },
  {
    url: "search",
    title: "Поиск с автодополнением",
    text: "Подсказки фильтруются по мере ввода, навигация стрелками и Enter.",
    component: <AutocompleteSearch />,
  },
  {
    url: "weather",
    title: "Виджет погоды",
    text: "Температура, условия и прогноз на несколько дней с анимированными иконками.",
    component: <WeatherWidget />,
  },
  {
    url: "particles-cursor",
    title: "Частицы за курсором",
    text: "Canvas-фон: точки притягиваются к курсору и закручиваются вокруг него.",
    component: <ParticleCursor />,
  },
  {
    url: "svg-draw",
    title: "Отрисовка по скроллу",
    text: "Линии SVG прорисовываются по мере прокрутки страницы — эффектные акценты в сторителлинге.",
    component: <ScrollDrawSVG />,
  },
  {
    url: "kanban",
    title: "Канбан-доска",
    text: "Перетаскивайте карточки между колонками — задачи меняют статус на лету.",
    component: <KanbanReorder />,
  },
  {
    url: "signature",
    title: "Поле для подписи",
    text: "Распишитесь пальцем или мышью прямо на сайте, с кнопкой очистки.",
    component: <SignaturePad />,
  },
  {
    url: "qr",
    title: "Генератор QR-кода",
    text: "Введите текст — код мгновенно перерисовывается (демо-визуализация).",
    component: <QRGenerator />,
  },
];

/** Карточка одного демо: «окно браузера» + подпись снизу. */
function PreviewCard({ demo, i }: { demo: Demo; i: number }) {
  return (
    <motion.div
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
  );
}

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
              <PreviewCard key={demo.url} demo={demo} i={i} />
            ))}
          </div>

          {/* Каталог готовых виджет-шаблонов */}
          <div className="mt-24 md:mt-32">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-xs uppercase tracking-[0.2em] text-[#1a1a1a]/40">
                каталог
              </span>
              <h2 className="mt-3 font-display font-medium tracking-tight text-3xl sm:text-4xl lg:text-5xl leading-[1.12]">
                <span className="text-[#1a1a1a]">Шаблоны виджетов</span>
                <span className="text-[#8e8e8e]"> для вашего сайта.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-base md:text-lg leading-relaxed text-[#1a1a1a]/60">
                29 готовых интерактивов — калькуляторы, игры, формы, графики. Любой
                встроим в ваш проект и настроим под задачу. Нужного нет? Закажите свой.
              </p>
            </motion.div>

            <div className="mt-12 md:mt-14 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-start">
              {WIDGETS.map((demo, i) => (
                <PreviewCard key={demo.url} demo={demo} i={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
