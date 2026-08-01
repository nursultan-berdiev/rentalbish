import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// Шрифты self-host (без внешних CDN): Manrope — текст, Playfair Display — заголовки
// и акценты (в т.ч. italic для цен, бегущей строки, адреса).
import "@fontsource-variable/manrope";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";

import App from "./App";
import { CartProvider } from "./cart/CartContext";
import { ProductModalProvider } from "./product/productModal";
import { SiteProvider } from "./site/SiteContext";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SiteProvider>
        <CartProvider>
          <ProductModalProvider>
            <App />
          </ProductModalProvider>
        </CartProvider>
      </SiteProvider>
    </BrowserRouter>
  </StrictMode>
);
