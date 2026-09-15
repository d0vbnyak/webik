import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import AssistantWidget from "./components/assistant/AssistantWidget";
import Home from "./pages/Home";
import About from "./pages/About";
import Templates from "./pages/Templates";
import Capabilities from "./pages/Capabilities";
import Prices from "./pages/Prices";
import Works from "./pages/Works";
import NotFound from "./pages/NotFound";
import { SECTIONS } from "../shared/visibility";

// Лендинги-шаблоны — крупные компоненты, грузим лениво (не нужны на остальных страницах)
const CoffeeLanding = lazy(() => import("./coffe-01/CoffeeLanding"));
const PhotoLanding = lazy(() => import("./photo-01/PhotoLanding"));
const PortfolioLanding = lazy(() => import("./portfolio-01/PortfolioLanding"));
// Закрытая админ-панель — отдельный раздел, грузим лениво (на публичный сайт не влияет)
const AdminApp = lazy(() => import("./admin/AdminApp"));

/** Основной сайт WebIK — с общим navbar и footer */
function SiteLayout() {
  return (
    <div className="min-h-screen bg-bg-base selection:bg-brand-green selection:text-black">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          {/* Скрытые разделы — см. shared/visibility.ts. Без флага путь уходит в NotFound */}
          {SECTIONS.about && <Route path="/about" element={<About />} />}
          {SECTIONS.templates && <Route path="/templates" element={<Templates />} />}
          <Route path="/capabilities" element={<Capabilities />} />
          <Route path="/prices" element={<Prices />} />
          {SECTIONS.works && <Route path="/works" element={<Works />} />}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <AssistantWidget />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Шаблоны-лендинги скрыты флагом SECTIONS.templates */}
        {SECTIONS.templates && (
          <>
            {/* Шаблон кофейни — полноэкранный, без общего лейаута сайта; грузится лениво */}
            <Route
              path="/templates/coffe-01"
              element={
                <Suspense fallback={<div className="min-h-screen bg-[#15100c]" />}>
                  <CoffeeLanding />
                </Suspense>
              }
            />
            {/* Шаблон фотографа — полноэкранный, без общего лейаута сайта; грузится лениво */}
            <Route
              path="/templates/photo-01"
              element={
                <Suspense fallback={<div className="min-h-screen bg-white" />}>
                  <PhotoLanding />
                </Suspense>
              }
            />
            {/* Шаблон портфолио моушн/3D — полноэкранный, тёмный, без общего лейаута; грузится лениво */}
            <Route
              path="/templates/portfolio-01"
              element={
                <Suspense fallback={<div className="min-h-screen bg-[#07070a]" />}>
                  <PortfolioLanding />
                </Suspense>
              }
            />
          </>
        )}
        {/* Закрытая админ-панель — тёмная, со своей навигацией, без общего лейаута */}
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
              <AdminApp />
            </Suspense>
          }
        />
        {/* Весь остальной сайт */}
        <Route path="/*" element={<SiteLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
