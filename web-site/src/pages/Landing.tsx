/** Главная. Порядок секций — по Figma (2:2). Шапка/футер/FAB — в общем макете. */
import Hero from "../sections/Hero";
import Categories from "../sections/Categories";
import WhyUs from "../sections/WhyUs";
import Catalog from "../sections/Catalog";
import RequestForm from "../sections/RequestForm";
import HowTo from "../sections/HowTo";
import Marquee from "../sections/Marquee";
import Gallery from "../sections/Gallery";
import CtaBanner from "../sections/CtaBanner";
import Contacts from "../sections/Contacts";

export default function Landing() {
  return (
    <main>
      <Hero />
      <Categories />
      <WhyUs />
      <Catalog />
      <RequestForm />
      <HowTo />
      <Marquee />
      <Gallery />
      <CtaBanner />
      <Contacts />
    </main>
  );
}
