/**
 * Статичные данные лендинга (тексты и декоративные фото) — в одном месте,
 * чтобы секции рендерились через map() без копипасты и «магических» строк.
 */
import heroImg from "./assets/hero.png";
import catPosuda from "./assets/cat-posuda.jpg";
import catShatry from "./assets/cat-shatry.jpg";
import catMebel from "./assets/cat-mebel.jpg";
import catDecor from "./assets/cat-decor.jpg";
import catKomplekty from "./assets/cat-komplekty.jpg";
import galTable from "./assets/gal-table.jpg";
import galChairs from "./assets/gal-chairs.jpg";
import galTents from "./assets/gal-tents.jpg";
import galDecor from "./assets/gal-decor.jpg";

export const HERO_IMG = heroImg;

export const WHY_US: { n: string; title: string; text: string }[] = [
  { n: "01", title: "Быстрый подбор", text: "Соберём комплект под ваше мероприятие и число гостей." },
  { n: "02", title: "Всё в одном месте", text: "Посуда, шатры, столы, стулья и декор — без лишних поставщиков." },
  { n: "03", title: "Красиво и выгодно", text: "Эстетичная сервировка без покупки лишней посуды." },
  { n: "04", title: "Для любого тоя", text: "Свадьбы, кыз узатуу, тушоо той, фуршеты и юбилеи." },
  { n: "05", title: "Связь в WhatsApp", text: "Быстрый ответ и помощь с подбором в один клик." },
  { n: "06", title: "Чисто и готово", text: "Аккуратная посуда, готовая к вашему мероприятию." },
];

export const CATEGORIES: { img: string; title: string; subtitle: string }[] = [
  { img: catPosuda, title: "Посуда", subtitle: "Тарелки, бокалы, приборы, блюда" },
  { img: catShatry, title: "Шатры", subtitle: "Для выездных мероприятий" },
  { img: catMebel, title: "Столы и стулья", subtitle: "Банкеты и фуршеты" },
  { img: catDecor, title: "Элементы декора", subtitle: "Свечи, текстиль, акценты" },
  { img: catKomplekty, title: "Готовые комплекты", subtitle: "Под число гостей" },
];

export const HOW_TO: string[] = [
  "Выбираете посуду, мебель или декор в каталоге",
  "Добавляете нужные товары в заявку",
  "Указываете дату и количество гостей",
  "Мы подтверждаем наличие в WhatsApp",
  "Забираете заказ или оформляете доставку",
  "Возвращаете после мероприятия",
];

/** Варианты для селекта «Мероприятие» в форме заявки. */
export const EVENT_OPTIONS: string[] = [
  "Свадьба",
  "Кыз узатуу",
  "Тушоо той",
  "Жентек той",
  "Девичник",
  "Юбилей",
  "Фуршет",
  "Банкет",
  "Корпоратив",
];

/** Бегущая строка типов тоя. */
export const MARQUEE_ITEMS: string[] = [
  "Кыз узатуу",
  "Свадьба",
  "Тушоо той",
  "Жентек той",
  "Девичники",
  "Юбилеи",
  "Фуршеты",
  "Банкеты",
];

export const GALLERY: { img: string; title: string; wide: boolean }[] = [
  { img: galTable, title: "Свадебный стол", wide: true },
  { img: galChairs, title: "Стулья", wide: false },
  { img: galTents, title: "Шатры", wide: false },
  { img: galDecor, title: "Декор и свечи", wide: true },
];

export const SCHEDULE: { label: string; value: string }[] = [
  { label: "Понедельник — Пятница", value: "9:00 – 20:00" },
  { label: "Суббота", value: "10:00 – 18:00" },
  { label: "Воскресенье", value: "10:00 – 16:00" },
  { label: "Приём заявок онлайн", value: "24 / 7" },
];

export const CONTACTS = {
  phone: "+996 552 080 610",
  address: "Арча-Бешик, ул. Тогуз-Тутун, 1 б",
  note: "Склад-шоурум · выдача и возврат · Бишкек",
  mapSrc:
    "https://www.openstreetmap.org/export/embed.html?bbox=74.5300%2C42.9130%2C74.5670%2C42.9330&layer=mapnik&marker=42.9231%2C74.5486",
};

export const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Каталог", href: "#catalog" },
  { label: "Как арендовать", href: "#how" },
  { label: "Контакты", href: "#contacts" },
];
