import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import Header from "./components/Header";
import Footer from "./sections/Footer";
import WhatsAppFab from "./sections/WhatsAppFab";
import Landing from "./pages/Landing";
import CatalogPage from "./pages/CatalogPage";
import CartPage from "./pages/CartPage";
import ComingSoon from "./pages/ComingSoon";
import { useSite } from "./site/SiteContext";

/** При смене маршрута — наверх; если в адресе якорь секции — скроллим к ней. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  const { status } = useSite();

  // Пока статус не загрузился — не мигаем сайтом (и не показываем заглушку раньше
  // времени). Режим обслуживания → заставка вместо всей витрины.
  if (status === "loading") return null;
  if (status === "down") return <ComingSoon />;

  return (
    <div className="site">
      <ScrollManager />
      <Header />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="*" element={<Landing />} />
      </Routes>
      <Footer />
      <WhatsAppFab />
    </div>
  );
}
