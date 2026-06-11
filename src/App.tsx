import { BrowserRouter, Routes, Route } from "react-router";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import Home from "./pages/Home";
import About from "./pages/About";
import Templates from "./pages/Templates";
import Capabilities from "./pages/Capabilities";
import Works from "./pages/Works";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg-base selection:bg-brand-green selection:text-black">
        <ScrollToTop />
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/capabilities" element={<Capabilities />} />
            <Route path="/works" element={<Works />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
