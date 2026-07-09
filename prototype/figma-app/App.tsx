import { useState } from "react";
import avantLogo from "@/imports/avant-logo.png";
import avantIcon from "@/imports/avant-icon.png";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen =
  | "splash"
  | "auth"
  | "register"
  | "login"
  | "catalog"
  | "category"
  | "imageSearch"
  | "product"
  | "cart"
  | "checkout"
  | "maps"
  | "orders"
  | "orderDetail"
  | "profile"
  | "editProfile";

type Tab = "catalog" | "cart" | "maps" | "orders" | "profile";

// ─── Data ─────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "mixers", name: "Смесители", count: 148, icon: "🚿" },
  { id: "sinks", name: "Раковины", count: 94, icon: "🪣" },
  { id: "showers", name: "Душевые системы", count: 67, icon: "🚿" },
  { id: "toilets", name: "Унитазы", count: 52, icon: "🚽" },
  { id: "pipes", name: "Трубы и фитинги", count: 312, icon: "⚙️" },
  { id: "heating", name: "Отопление", count: 203, icon: "🔥" },
  { id: "water", name: "Водоснабжение", count: 178, icon: "💧" },
  { id: "filters", name: "Фильтры", count: 89, icon: "🔵" },
  { id: "tools", name: "Инструменты", count: 156, icon: "🔧" },
  { id: "accessories", name: "Аксессуары", count: 241, icon: "📦" },
];

const PRODUCTS = [
  { id: 1, name: "Фильтр дисковый 100 мкм", category: "Фильтры", price: null, inStock: true, image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop&auto=format" },
  { id: 2, name: "Смеситель для раковины однорычажный", category: "Смесители", price: 2490, inStock: true, image: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=300&h=300&fit=crop&auto=format" },
  { id: 3, name: "Труба PPR 25 мм PN20", category: "Трубы", price: 185, inStock: true, image: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=300&h=300&fit=crop&auto=format" },
  { id: 4, name: "Фитинг угловой 90° 25мм", category: "Фитинги", price: 45, inStock: true, image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop&auto=format" },
  { id: 5, name: "Душевая стойка со смесителем", category: "Душевые", price: null, inStock: false, image: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=300&h=300&fit=crop&auto=format" },
  { id: 6, name: "Радиатор биметаллический 8 секций", category: "Отопление", price: 8900, inStock: true, image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=300&h=300&fit=crop&auto=format" },
];

const ORDERS = [
  { id: "1042", date: "12 июня 2025", items: 4, status: "Завершён", statusIndex: 4 },
  { id: "1089", date: "18 июня 2025", items: 2, status: "В пути", statusIndex: 3 },
  { id: "1103", date: "19 июня 2025", items: 6, status: "Собирается", statusIndex: 1 },
];

const ORDER_STEPS = ["Заказ создан", "Менеджер подтвердил", "Заказ собирается", "Готов к выдаче", "Завершён"];

const STORES = [
  { name: "Авантехник — Центр", address: "ул. Токтогула 123, Бишкек", hours: "Пн–Сб: 9:00–19:00", phone: "+996 312 555 100" },
  { name: "Авантехник — Северный", address: "пр. Манаса 45, Бишкек", hours: "Пн–Сб: 9:00–18:00", phone: "+996 312 555 200" },
  { name: "Авантехник — Восток", address: "ул. Байтик Баатыра 88, Бишкек", hours: "Пн–Пт: 9:00–18:00", phone: "+996 312 555 300" },
];

// ─── Brand colors ──────────────────────────────────────────────────────────────
const RED = "#E8380D";
const RED_LIGHT = "#fff0ed";

// ─── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({ active, onTab }: { active: Tab; onTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: (a: boolean) => JSX.Element }[] = [
    {
      id: "catalog", label: "Каталог",
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? RED : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      id: "cart", label: "Корзина",
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? RED : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      ),
    },
    {
      id: "maps", label: "Карты",
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? RED : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
      ),
    },
    {
      id: "orders", label: "Заказы",
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? RED : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      ),
    },
    {
      id: "profile", label: "Профиль",
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? RED : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 px-3 pb-4 pt-2 pointer-events-none" style={{ zIndex: 50 }}>
      <div className="pointer-events-auto flex items-center justify-around bg-white rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.14)] px-2 py-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all"
            style={{ background: active === t.id ? RED_LIGHT : "transparent" }}
          >
            {t.icon(active === t.id)}
            <span className="text-[10px] font-medium leading-tight" style={{ color: active === t.id ? RED : "#9ca3af" }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Phone Shell ───────────────────────────────────────────────────────────────
function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-8 px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div
        className="relative bg-white overflow-hidden"
        style={{
          width: 390,
          height: 844,
          borderRadius: 48,
          boxShadow: "0 32px 80px rgba(0,0,0,0.22), 0 0 0 8px #1a1a1a, 0 0 0 10px #333",
        }}
      >
        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 h-11 flex items-center justify-between px-8 z-50" style={{ background: "transparent" }}>
          <span className="text-[13px] font-semibold text-gray-800">9:41</span>
          <div className="w-28 h-7 bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-0" />
          <div className="flex items-center gap-1">
            <svg width="16" height="12" viewBox="0 0 16 12" fill="#1a1a1a"><rect x="0" y="3" width="3" height="9" rx="1"/><rect x="4.5" y="2" width="3" height="10" rx="1"/><rect x="9" y="0" width="3" height="12" rx="1"/><rect x="13.5" y="1" width="2.5" height="11" rx="1"/></svg>
            <svg width="15" height="12" viewBox="0 0 15 12" fill="#1a1a1a"><path d="M7.5 2.5C9.8 2.5 11.9 3.5 13.3 5.1L14.7 3.7C12.9 1.8 10.3.7 7.5.7 4.7.7 2.1 1.8.3 3.7L1.7 5.1C3.1 3.5 5.2 2.5 7.5 2.5Z"/><path d="M7.5 5.5C9 5.5 10.3 6.1 11.3 7.1L12.7 5.7C11.3 4.4 9.5 3.6 7.5 3.6 5.5 3.6 3.7 4.4 2.3 5.7L3.7 7.1C4.7 6.1 6 5.5 7.5 5.5Z"/><circle cx="7.5" cy="10" r="1.5"/></svg>
            <div className="flex items-center gap-0.5">
              <div className="w-6 h-3 border border-gray-700 rounded-sm relative"><div className="absolute inset-0.5 bg-gray-700 rounded-[1px]" style={{ width: "75%" }} /></div>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Splash ────────────────────────────────────────────────────────────────────
function SplashScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="absolute inset-0 bg-white flex flex-col items-center justify-center gap-6" onClick={onDone}>
      <div className="flex flex-col items-center gap-4">
        <ImageWithFallback src={avantLogo} alt="Авантехник логотип" className="w-64 object-contain" />
      </div>
      <p className="text-sm text-gray-400 text-center px-8 leading-relaxed">
        Сантехника, отопление и товары для ремонта
      </p>
      <div className="absolute bottom-16 left-0 right-0 flex justify-center px-8">
        <button
          className="w-full py-4 rounded-2xl text-white font-semibold text-base shadow-md active:scale-[0.98] transition-transform"
          style={{ background: RED }}
        >
          Начать
        </button>
      </div>
    </div>
  );
}

// ─── Auth Choice ───────────────────────────────────────────────────────────────
function AuthScreen({ onLogin, onRegister, onGuest }: { onLogin: () => void; onRegister: () => void; onGuest: () => void }) {
  return (
    <div className="absolute inset-0 bg-white flex flex-col pt-20 pb-12 px-6">
      <div className="flex flex-col items-center mb-10">
        <ImageWithFallback src={avantIcon} alt="Авантехник" className="w-14 h-14 object-contain mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 text-center leading-tight">Добро пожаловать</h1>
        <p className="text-sm text-gray-500 text-center mt-3 leading-relaxed px-4">
          Покупайте сантехнику и товары для ремонта в пару касаний
        </p>
      </div>
      <div className="flex-1 flex flex-col justify-center gap-3">
        <button
          onClick={onLogin}
          className="w-full py-4 rounded-2xl text-white font-semibold text-base shadow-sm active:scale-[0.98] transition-transform"
          style={{ background: RED }}
        >
          Войти
        </button>
        <button
          onClick={onRegister}
          className="w-full py-4 rounded-2xl font-semibold text-base border-2 transition-transform active:scale-[0.98]"
          style={{ borderColor: RED, color: RED }}
        >
          Зарегистрироваться
        </button>
        <button onClick={onGuest} className="w-full py-3 text-gray-400 text-sm">
          Продолжить как гость
        </button>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs text-gray-300">или</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      <p className="text-center text-xs text-gray-400 mt-4 leading-relaxed">
        Продолжая, вы соглашаетесь с условиями использования
      </p>
    </div>
  );
}

// ─── Input Field ───────────────────────────────────────────────────────────────
function Field({ label, placeholder, type = "text", value, onChange }: {
  label: string; placeholder: string; type?: string;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3.5 rounded-xl border text-gray-900 text-base placeholder-gray-400 outline-none focus:ring-2 transition-all"
        style={{ borderColor: "rgba(0,0,0,0.1)", background: "#f9f9fb" }}
        onFocus={(e) => (e.target.style.borderColor = RED)}
        onBlur={(e) => (e.target.style.borderColor = "rgba(0,0,0,0.1)")}
      />
    </div>
  );
}

// ─── Register ─────────────────────────────────────────────────────────────────
function RegisterScreen({ onDone, onLogin, onBack }: { onDone: () => void; onLogin: () => void; onBack: () => void }) {
  const [v, setV] = useState({ name: "", phone: "", address: "", pass: "", pass2: "" });
  return (
    <div className="absolute inset-0 bg-white overflow-y-auto" style={{ paddingTop: 48 }}>
      <div className="px-6 pb-10">
        <button onClick={onBack} className="flex items-center gap-2 mt-3 mb-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          <span className="text-sm text-gray-500">Назад</span>
        </button>
        <h1 className="text-xl font-bold text-gray-900 mt-2 mb-1">Создать аккаунт</h1>
        <p className="text-sm text-gray-500 mb-6">Введите данные для регистрации</p>
        <div className="flex flex-col gap-4">
          <Field label="Имя" placeholder="Ваше имя" value={v.name} onChange={(x) => setV({ ...v, name: x })} />
          <Field label="Телефон" placeholder="+996 700 000 000" type="tel" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} />
          <Field label="Адрес" placeholder="Улица, дом, квартира" value={v.address} onChange={(x) => setV({ ...v, address: x })} />
          <Field label="Пароль" placeholder="Минимум 8 символов" type="password" value={v.pass} onChange={(x) => setV({ ...v, pass: x })} />
          <Field label="Повторите пароль" placeholder="Повторите пароль" type="password" value={v.pass2} onChange={(x) => setV({ ...v, pass2: x })} />
        </div>
        <button
          onClick={onDone}
          className="w-full py-4 rounded-2xl text-white font-semibold text-base mt-6 shadow-sm active:scale-[0.98] transition-transform"
          style={{ background: RED }}
        >
          Создать аккаунт
        </button>
        <p className="text-center text-sm text-gray-500 mt-4">
          Уже есть аккаунт?{" "}
          <button onClick={onLogin} className="font-semibold" style={{ color: RED }}>
            Войти
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onDone, onRegister, onBack }: { onDone: () => void; onRegister: () => void; onBack: () => void }) {
  const [v, setV] = useState({ phone: "", pass: "" });
  return (
    <div className="absolute inset-0 bg-white flex flex-col" style={{ paddingTop: 48 }}>
      <div className="px-6 flex-1">
        <button onClick={onBack} className="flex items-center gap-2 mt-3 mb-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          <span className="text-sm text-gray-500">Назад</span>
        </button>
        <h1 className="text-xl font-bold text-gray-900 mt-2 mb-1">Вход в аккаунт</h1>
        <p className="text-sm text-gray-500 mb-6">Введите телефон и пароль</p>
        <div className="flex flex-col gap-4">
          <Field label="Телефон" placeholder="+996 700 000 000" type="tel" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} />
          <Field label="Пароль" placeholder="Ваш пароль" type="password" value={v.pass} onChange={(x) => setV({ ...v, pass: x })} />
        </div>
        <button className="text-sm mt-3" style={{ color: RED }}>Забыли пароль?</button>
        <button
          onClick={onDone}
          className="w-full py-4 rounded-2xl text-white font-semibold text-base mt-6 shadow-sm active:scale-[0.98] transition-transform"
          style={{ background: RED }}
        >
          Войти
        </button>
        <p className="text-center text-sm text-gray-500 mt-4">
          Нет аккаунта?{" "}
          <button onClick={onRegister} className="font-semibold" style={{ color: RED }}>
            Зарегистрироваться
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── Catalog ──────────────────────────────────────────────────────────────────
function CatalogScreen({ onCategory }: { onCategory: (id: string, name: string) => void }) {
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: "#f5f5f7", paddingTop: 48, paddingBottom: 90 }}>
      {/* Header */}
      <div className="bg-white px-5 pb-4">
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Каталог</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="text-xs text-gray-400">Бишкек</span>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>
        {/* Banner */}
        <div className="mt-4 rounded-2xl p-4 flex items-center gap-3" style={{ background: `linear-gradient(120deg, ${RED} 0%, #ff6b35 100%)` }}>
          <div className="flex-1">
            <p className="text-white font-bold text-base leading-tight">Всё для ванной, отопления и ремонта</p>
            <p className="text-white/80 text-xs mt-1">Более 2000 позиций в наличии</p>
            <button className="mt-3 bg-white text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ color: RED }}>
              Смотреть каталог →
            </button>
          </div>
          <ImageWithFallback src={avantIcon} alt="" className="w-14 h-14 object-contain opacity-90" />
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 mt-4">
        <h2 className="text-base font-bold text-gray-800 mb-3">Категории</h2>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategory(cat.id, cat.name)}
              className="bg-white rounded-2xl p-4 flex flex-col gap-2 text-left shadow-sm active:scale-[0.97] transition-transform"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <span className="text-2xl">{cat.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 leading-tight">{cat.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{cat.count} товаров</p>
              </div>
              <div className="h-0.5 rounded-full w-8" style={{ background: RED_LIGHT }}>
                <div className="h-full w-1/2 rounded-full" style={{ background: RED }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Category / Product Listing ───────────────────────────────────────────────
function CategoryScreen({
  name, onBack, onProduct, onImageSearch,
}: { name: string; onBack: () => void; onProduct: (id: number) => void; onImageSearch: () => void }) {
  const [search, setSearch] = useState("");
  const [activeChip, setActiveChip] = useState("В наличии");
  const chips = ["В наличии", "Популярные", "Цена уточняется", "Новинки"];
  const [favs, setFavs] = useState<number[]>([]);

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: "#f5f5f7", paddingTop: 48, paddingBottom: 90 }}>
      {/* Header */}
      <div className="bg-white px-4 pb-3">
        <div className="flex items-center gap-3 mt-3">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{name}</h1>
            <p className="text-xs text-gray-400">Товары в наличии и под заказ</p>
          </div>
        </div>
        {/* Search */}
        <div className="flex gap-2 mt-3">
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по товарам"
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            />
          </div>
          <button
            onClick={onImageSearch}
            className="flex items-center gap-1.5 px-3 rounded-xl border-2 font-medium text-xs transition-all active:scale-95"
            style={{ borderColor: RED, color: RED }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>Фото</span>
          </button>
        </div>
        {/* Filter row */}
        <div className="flex items-center gap-2 mt-2.5 overflow-x-auto pb-1 scrollbar-hide">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium whitespace-nowrap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Фильтр
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium whitespace-nowrap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            Сортировка
          </button>
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => setActiveChip(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
              style={activeChip === c ? { background: RED, color: "#fff" } : { background: "#f0f0f3", color: "#6b7280" }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="px-3 mt-3 grid grid-cols-2 gap-3">
        {PRODUCTS.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div className="relative">
              <div className="w-full h-36 bg-gray-100 overflow-hidden">
                <ImageWithFallback src={p.image} alt={p.name} className="w-full h-full object-cover" />
              </div>
              <button
                onClick={() => setFavs(favs.includes(p.id) ? favs.filter((x) => x !== p.id) : [...favs, p.id])}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={favs.includes(p.id) ? RED : "none"} stroke={favs.includes(p.id) ? RED : "#9ca3af"} strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
              <span
                className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={p.inStock ? { background: "#ecfdf5", color: "#059669" } : { background: "#f3f4f6", color: "#9ca3af" }}
              >
                {p.inStock ? "В наличии" : "Под заказ"}
              </span>
            </div>
            <div className="p-3">
              <button onClick={() => onProduct(p.id)} className="text-left w-full">
                <p className="text-xs text-gray-400">{p.category}</p>
                <p className="text-sm font-semibold text-gray-900 leading-tight mt-0.5 line-clamp-2">{p.name}</p>
                <p className="text-sm font-bold mt-1.5" style={{ color: RED }}>
                  {p.price ? `${p.price.toLocaleString()} сом` : "Цена уточняется"}
                </p>
              </button>
              <button
                className="w-full mt-2.5 py-2 rounded-xl text-white text-xs font-semibold active:scale-95 transition-transform"
                style={{ background: RED }}
              >
                В корзину
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Image Search ─────────────────────────────────────────────────────────────
function ImageSearchScreen({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<"pick" | "searching" | "results">("pick");
  return (
    <div className="absolute inset-0 bg-white flex flex-col" style={{ paddingTop: 48 }}>
      <div className="px-4 mt-3 flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Поиск по фото</h1>
      </div>

      {phase === "pick" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
          <div className="w-28 h-28 rounded-3xl flex items-center justify-center" style={{ background: RED_LIGHT }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900">Поиск по фото</h2>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Сфотографируйте товар или загрузите изображение, чтобы найти похожие позиции
            </p>
          </div>
          <div className="w-full flex flex-col gap-3 mt-2">
            <button
              onClick={() => setPhase("searching")}
              className="w-full py-4 rounded-2xl text-white font-semibold text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              style={{ background: RED }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              Сделать фото
            </button>
            <button
              onClick={() => setPhase("searching")}
              className="w-full py-4 rounded-2xl font-semibold text-base border-2 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              style={{ borderColor: RED, color: RED }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Загрузить из галереи
            </button>
          </div>
        </div>
      )}

      {phase === "searching" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-40 h-40 rounded-3xl bg-gray-100 overflow-hidden">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop&auto=format"
              alt="Загруженное фото"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: RED, animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <p className="text-sm text-gray-500">Анализируем изображение...</p>
          </div>
          <button onClick={() => setPhase("results")} className="text-xs text-gray-400 underline mt-2">
            Пропустить
          </button>
        </div>
      )}

      {phase === "results" && (
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              <h2 className="text-base font-bold text-gray-900">Мы нашли похожие товары</h2>
            </div>
            <p className="text-xs text-gray-400">По вашему фото найдено 4 позиции</p>
          </div>
          <div className="px-3 grid grid-cols-2 gap-3">
            {PRODUCTS.slice(0, 4).map((p) => (
              <div key={p.id} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <div className="w-full h-36 bg-gray-100">
                  <ImageWithFallback src={p.image} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-sm font-bold mt-1" style={{ color: RED }}>
                    {p.price ? `${p.price.toLocaleString()} сом` : "Цена уточняется"}
                  </p>
                  <button className="w-full mt-2 py-1.5 rounded-xl text-white text-xs font-semibold" style={{ background: RED }}>
                    В корзину
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Product Detail ────────────────────────────────────────────────────────────
function ProductScreen({ productId, onBack }: { productId: number; onBack: () => void }) {
  const p = PRODUCTS.find((x) => x.id === productId) || PRODUCTS[0];
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"desc" | "specs" | "stores">("desc");
  const [fav, setFav] = useState(false);

  return (
    <div className="absolute inset-0 bg-white overflow-y-auto" style={{ paddingTop: 48, paddingBottom: 80 }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 mt-2">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button onClick={() => setFav(!fav)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100">
          <svg width="16" height="16" viewBox="0 0 24 24" fill={fav ? RED : "none"} stroke={fav ? RED : "#374151"} strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>

      {/* Image */}
      <div className="w-full h-56 bg-gray-100 mt-3">
        <ImageWithFallback src={p.image} alt={p.name} className="w-full h-full object-cover" />
      </div>

      {/* Info */}
      <div className="px-5 mt-4">
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={p.inStock ? { background: "#ecfdf5", color: "#059669" } : { background: "#f3f4f6", color: "#9ca3af" }}
        >
          {p.inStock ? "В наличии" : "Под заказ"}
        </span>
        <h1 className="text-xl font-bold text-gray-900 mt-2 leading-tight">{p.name}</h1>
        <p className="text-2xl font-bold mt-2" style={{ color: RED }}>
          {p.price ? `${p.price.toLocaleString()} сом` : "Цена уточняется"}
        </p>

        {/* Tabs */}
        <div className="flex gap-0 mt-5 border-b border-gray-100">
          {(["desc", "specs", "stores"] as const).map((t, i) => {
            const labels = ["Описание", "Характеристики", "Наличие"];
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 pb-2.5 text-sm font-medium transition-colors"
                style={{ borderBottom: tab === t ? `2px solid ${RED}` : "2px solid transparent", color: tab === t ? RED : "#9ca3af" }}
              >
                {labels[i]}
              </button>
            );
          })}
        </div>

        {tab === "desc" && (
          <p className="text-sm text-gray-600 mt-4 leading-relaxed">
            Высококачественный сантехнический товар для применения в жилых и коммерческих помещениях. Изготовлен из прочных материалов, соответствует стандартам качества. Подходит для монтажа в системах водоснабжения и отопления.
          </p>
        )}
        {tab === "specs" && (
          <div className="mt-4 flex flex-col gap-0">
            {[
              ["Размер", "25 мм"],
              ["Материал", "Полипропилен"],
              ["Производитель", "VALTEC"],
              ["Назначение", "Холодное/горячее водоснабжение"],
              ["Рабочая температура", "до 95°C"],
              ["Рабочее давление", "PN 20"],
            ].map(([k, v], i) => (
              <div key={k} className={`flex items-center justify-between py-3 ${i < 5 ? "border-b border-gray-100" : ""}`}>
                <span className="text-sm text-gray-500">{k}</span>
                <span className="text-sm font-medium text-gray-900">{v}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "stores" && (
          <div className="mt-4 flex flex-col gap-3">
            {STORES.map((s) => (
              <div key={s.name} className="p-3 bg-gray-50 rounded-xl">
                <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.address}</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-xs text-green-600 font-medium">В наличии</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[390px] bg-white border-t border-gray-100 px-5 py-4 flex items-center gap-3" style={{ zIndex: 40 }}>
        <div className="flex items-center gap-0 border border-gray-200 rounded-xl overflow-hidden">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50">−</button>
          <span className="w-8 text-center text-sm font-semibold text-gray-900">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50">+</button>
        </div>
        <button className="flex-1 py-3.5 rounded-2xl text-white font-semibold text-base active:scale-[0.98] transition-transform" style={{ background: RED }}>
          Добавить в корзину
        </button>
      </div>
    </div>
  );
}

// ─── Cart ──────────────────────────────────────────────────────────────────────
function CartScreen({ onCheckout }: { onCheckout: () => void }) {
  const [items, setItems] = useState([
    { ...PRODUCTS[0], qty: 1 },
    { ...PRODUCTS[1], qty: 2 },
    { ...PRODUCTS[2], qty: 3 },
  ]);

  const removeItem = (id: number) => setItems(items.filter((x) => x.id !== id));
  const changeQty = (id: number, delta: number) =>
    setItems(items.map((x) => (x.id === id ? { ...x, qty: Math.max(1, x.qty + delta) } : x)));

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: "#f5f5f7", paddingTop: 48, paddingBottom: 160 }}>
      <div className="px-4 mt-4">
        <h1 className="text-xl font-bold text-gray-900">Корзина</h1>
        <p className="text-sm text-gray-400 mt-0.5">{items.length} товара</p>
      </div>
      <div className="px-4 mt-4 flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl p-3 flex gap-3 shadow-sm">
            <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
              <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 flex-1 mr-2">{item.name}</p>
                <button onClick={() => removeItem(item.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <p className="text-sm font-bold mt-1" style={{ color: RED }}>
                {item.price ? `${item.price.toLocaleString()} сом` : "Цена уточняется"}
              </p>
              <div className="flex items-center gap-0 mt-2 border border-gray-200 rounded-xl w-fit overflow-hidden">
                <button onClick={() => changeQty(item.id, -1)} className="w-8 h-7 flex items-center justify-center text-gray-600 text-sm">−</button>
                <span className="w-6 text-center text-xs font-semibold text-gray-900">{item.qty}</span>
                <button onClick={() => changeQty(item.id, 1)} className="w-8 h-7 flex items-center justify-center text-gray-600 text-sm">+</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[390px] bg-white border-t border-gray-100 px-5 py-4" style={{ zIndex: 40 }}>
        <div className="flex justify-between mb-1">
          <span className="text-sm text-gray-500">Товары: {items.length}</span>
          <span className="text-sm text-gray-500">Доставка: уточняется</span>
        </div>
        <div className="flex justify-between mb-3">
          <span className="text-base font-bold text-gray-900">Итого</span>
          <span className="text-base font-bold" style={{ color: RED }}>уточняется</span>
        </div>
        <button onClick={onCheckout} className="w-full py-4 rounded-2xl text-white font-semibold text-base active:scale-[0.98] transition-transform" style={{ background: RED }}>
          Оформить заказ
        </button>
      </div>
    </div>
  );
}

// ─── Checkout ─────────────────────────────────────────────────────────────────
function CheckoutScreen({ onBack, onConfirm }: { onBack: () => void; onConfirm: () => void }) {
  const [delivery, setDelivery] = useState<"pickup" | "delivery">("delivery");
  const [v, setV] = useState({ name: "Асан Бекович", phone: "+996 700 123 456", address: "", comment: "" });
  return (
    <div className="absolute inset-0 bg-white overflow-y-auto" style={{ paddingTop: 48, paddingBottom: 100 }}>
      <div className="px-4 mt-3 flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Оформление заказа</h1>
      </div>
      <div className="px-4 mt-5 flex flex-col gap-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Контактные данные</h2>
          <div className="flex flex-col gap-3">
            <Field label="Имя" placeholder="Ваше имя" value={v.name} onChange={(x) => setV({ ...v, name: x })} />
            <Field label="Телефон" placeholder="+996 700 000 000" type="tel" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} />
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Способ получения</h2>
          <div className="flex gap-3">
            {(["delivery", "pickup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setDelivery(m)}
                className="flex-1 py-3 rounded-xl text-sm font-medium border-2 transition-all"
                style={delivery === m ? { borderColor: RED, color: RED, background: RED_LIGHT } : { borderColor: "#e5e7eb", color: "#6b7280", background: "#fff" }}
              >
                {m === "delivery" ? "Доставка" : "Самовывоз"}
              </button>
            ))}
          </div>
        </div>
        {delivery === "delivery" && (
          <Field label="Адрес доставки" placeholder="Улица, дом, квартира" value={v.address} onChange={(x) => setV({ ...v, address: x })} />
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Комментарий к заказу</label>
          <textarea
            value={v.comment}
            onChange={(e) => setV({ ...v, comment: e.target.value })}
            placeholder="Уточните детали или пожелания..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border text-gray-900 text-sm placeholder-gray-400 outline-none resize-none"
            style={{ borderColor: "rgba(0,0,0,0.1)", background: "#f9f9fb" }}
          />
        </div>
      </div>
      <div className="px-4 mt-6">
        <button onClick={onConfirm} className="w-full py-4 rounded-2xl text-white font-semibold text-base active:scale-[0.98] transition-transform" style={{ background: RED }}>
          Подтвердить заказ
        </button>
      </div>
    </div>
  );
}

// ─── Maps ─────────────────────────────────────────────────────────────────────
function MapsScreen() {
  const [selected, setSelected] = useState(0);
  const pins = [
    { x: 155, y: 130 },
    { x: 220, y: 90 },
    { x: 290, y: 160 },
  ];
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: "#f5f5f7", paddingTop: 48, paddingBottom: 90 }}>
      <div className="px-4 mt-4">
        <h1 className="text-xl font-bold text-gray-900">Магазины</h1>
        <p className="text-sm text-gray-400 mt-0.5">Авантехник в Бишкеке</p>
      </div>
      {/* Map placeholder */}
      <div className="mx-4 mt-4 rounded-3xl overflow-hidden relative" style={{ height: 220, background: "#e8eff5" }}>
        {/* Stylized map grid */}
        <svg width="100%" height="100%" viewBox="0 0 358 220" xmlns="http://www.w3.org/2000/svg">
          <rect width="358" height="220" fill="#e8eff5"/>
          {/* Roads */}
          <line x1="0" y1="110" x2="358" y2="110" stroke="#fff" strokeWidth="8"/>
          <line x1="0" y1="70" x2="358" y2="70" stroke="#fff" strokeWidth="4"/>
          <line x1="0" y1="160" x2="358" y2="160" stroke="#fff" strokeWidth="4"/>
          <line x1="80" y1="0" x2="80" y2="220" stroke="#fff" strokeWidth="4"/>
          <line x1="180" y1="0" x2="180" y2="220" stroke="#fff" strokeWidth="8"/>
          <line x1="280" y1="0" x2="280" y2="220" stroke="#fff" strokeWidth="4"/>
          {/* Blocks */}
          <rect x="90" y="20" width="80" height="40" rx="4" fill="#d0dce8"/>
          <rect x="90" y="80" width="80" height="22" rx="4" fill="#d0dce8"/>
          <rect x="190" y="20" width="80" height="40" rx="4" fill="#d0dce8"/>
          <rect x="190" y="80" width="80" height="22" rx="4" fill="#d0dce8"/>
          <rect x="90" y="120" width="80" height="30" rx="4" fill="#d0dce8"/>
          <rect x="190" y="120" width="80" height="30" rx="4" fill="#d0dce8"/>
          <rect x="10" y="20" width="60" height="40" rx="4" fill="#d0dce8"/>
          <rect x="295" y="20" width="55" height="40" rx="4" fill="#d0dce8"/>
          <text x="14" y="165" fill="#b0c0cc" fontSize="9" fontFamily="Inter,sans-serif">Чуйский пр.</text>
          <text x="100" y="108" fill="#b0c0cc" fontSize="9" fontFamily="Inter,sans-serif">Токтогула</text>
          <text x="185" y="108" fill="#b0c0cc" fontSize="9" fontFamily="Inter,sans-serif">Манаса</text>
          {/* Pins */}
          {pins.map((pin, i) => (
            <g key={i} onClick={() => setSelected(i)} style={{ cursor: "pointer" }}>
              <circle cx={pin.x} cy={pin.y} r={i === selected ? 14 : 10} fill={i === selected ? RED : "#fff"} stroke={RED} strokeWidth="2.5" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}/>
              <text x={pin.x} y={pin.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={i === selected ? "#fff" : RED} fontFamily="Inter,sans-serif">{i + 1}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Store cards */}
      <div className="px-4 mt-4 flex flex-col gap-3">
        {STORES.map((s, i) => (
          <div
            key={s.name}
            onClick={() => setSelected(i)}
            className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer transition-all"
            style={{ border: `2px solid ${i === selected ? RED : "transparent"}`, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: RED }}>
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.address}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="text-xs text-gray-500">{s.hours}</span>
              </div>
              <div className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5 2 2 0 0 1 3.6 3h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 10.9a16 16 0 0 0 6 6l.81-.81a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 18z"/></svg>
                <span className="text-xs text-gray-500">{s.phone}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: RED }}>
                Построить маршрут
              </button>
              <button className="flex-1 py-2 rounded-xl text-xs font-semibold border" style={{ borderColor: RED, color: RED }}>
                Позвонить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Orders ────────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  "Оформляется": { bg: "#fff7ed", color: "#f97316" },
  "Собирается": { bg: "#eff6ff", color: "#3b82f6" },
  "Готов к выдаче": { bg: "#f0fdf4", color: "#22c55e" },
  "В пути": { bg: "#faf5ff", color: "#a855f7" },
  "Завершён": { bg: "#f3f4f6", color: "#6b7280" },
};

function OrdersScreen({ onOrder }: { onOrder: (id: string) => void }) {
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: "#f5f5f7", paddingTop: 48, paddingBottom: 90 }}>
      <div className="px-4 mt-4">
        <h1 className="text-xl font-bold text-gray-900">Мои заказы</h1>
        <p className="text-sm text-gray-400 mt-0.5">{ORDERS.length} заказа</p>
      </div>
      <div className="px-4 mt-4 flex flex-col gap-3">
        {ORDERS.map((o) => {
          const sc = STATUS_COLORS[o.status] || STATUS_COLORS["Оформляется"];
          return (
            <button key={o.id} onClick={() => onOrder(o.id)} className="bg-white rounded-2xl p-4 text-left shadow-sm w-full active:scale-[0.99] transition-transform" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">Заказ №{o.id}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{o.date} · {o.items} товара</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                  {o.status}
                </span>
              </div>
              <div className="mt-3 flex gap-1">
                {ORDER_STEPS.map((_, i) => (
                  <div key={i} className="flex-1 h-1 rounded-full" style={{ background: i <= o.statusIndex ? RED : "#e5e7eb" }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrderDetailScreen({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const o = ORDERS.find((x) => x.id === orderId) || ORDERS[0];
  return (
    <div className="absolute inset-0 bg-white overflow-y-auto" style={{ paddingTop: 48, paddingBottom: 40 }}>
      <div className="px-4 mt-3 flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Заказ №{o.id}</h1>
          <p className="text-xs text-gray-400">{o.date}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-5 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Статус заказа</h2>
        <div className="flex flex-col gap-0">
          {ORDER_STEPS.map((step, i) => {
            const done = i <= o.statusIndex;
            const current = i === o.statusIndex;
            return (
              <div key={step} className="flex gap-4 items-start">
                <div className="flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: done ? RED : "#f3f4f6", border: current ? `3px solid ${RED}` : "none" }}
                  >
                    {done ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-gray-300" />
                    )}
                  </div>
                  {i < ORDER_STEPS.length - 1 && (
                    <div className="w-0.5 h-8 mt-1" style={{ background: i < o.statusIndex ? RED : "#e5e7eb" }} />
                  )}
                </div>
                <div className="pt-1.5 pb-6">
                  <p className="text-sm font-semibold" style={{ color: done ? "#1a1a1a" : "#9ca3af" }}>{step}</p>
                  {current && <p className="text-xs mt-0.5" style={{ color: RED }}>Текущий статус</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items summary */}
      <div className="mx-4 mt-2 p-4 bg-gray-50 rounded-2xl">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Состав заказа</h2>
        {PRODUCTS.slice(0, o.items > 3 ? 3 : o.items).map((p) => (
          <div key={p.id} className="flex gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
              <ImageWithFallback src={p.image} alt={p.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-800 line-clamp-1">{p.name}</p>
              <p className="text-xs text-gray-400">{p.price ? `${p.price} сом` : "Цена уточняется"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────
function ProfileScreen({ onEdit, onLogout }: { onEdit: () => void; onLogout: () => void }) {
  const actions = [
    { label: "Мои адреса", icon: "📍" },
    { label: "Поддержка", icon: "💬" },
    { label: "О приложении", icon: "ℹ️" },
  ];
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: "#f5f5f7", paddingTop: 48, paddingBottom: 90 }}>
      <div className="px-4 mt-4">
        <h1 className="text-xl font-bold text-gray-900">Профиль</h1>
      </div>
      {/* User card */}
      <div className="mx-4 mt-4 bg-white rounded-3xl p-5 shadow-sm" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white" style={{ background: `linear-gradient(135deg, ${RED}, #ff6b35)` }}>А</div>
          <div className="flex-1">
            <p className="text-base font-bold text-gray-900">Асан Бекович</p>
            <p className="text-sm text-gray-500 mt-0.5">+996 700 123 456</p>
            <p className="text-xs text-gray-400 mt-0.5">ул. Токтогула 123, кв. 14</p>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold border-2 active:scale-[0.98] transition-transform"
          style={{ borderColor: RED, color: RED }}
        >
          Редактировать профиль
        </button>
      </div>

      {/* Actions */}
      <div className="mx-4 mt-4 bg-white rounded-3xl overflow-hidden shadow-sm">
        {actions.map((a, i) => (
          <button key={a.label} className={`w-full flex items-center gap-3 px-5 py-4 text-left ${i < actions.length - 1 ? "border-b border-gray-100" : ""}`}>
            <span className="text-lg">{a.icon}</span>
            <span className="text-sm font-medium text-gray-800 flex-1">{a.label}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ))}
      </div>

      <div className="mx-4 mt-4">
        <button
          onClick={onLogout}
          className="w-full py-4 rounded-2xl font-semibold text-base border-2 active:scale-[0.98] transition-transform"
          style={{ borderColor: RED, color: RED }}
        >
          Выйти
        </button>
      </div>
    </div>
  );
}

function EditProfileScreen({ onBack }: { onBack: () => void }) {
  const [v, setV] = useState({ name: "Асан Бекович", phone: "+996 700 123 456", address: "ул. Токтогула 123, кв. 14" });
  return (
    <div className="absolute inset-0 bg-white" style={{ paddingTop: 48 }}>
      <div className="px-4 mt-3 flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Редактировать профиль</h1>
      </div>
      <div className="px-4 mt-6 flex flex-col gap-4">
        <Field label="Имя" placeholder="Ваше имя" value={v.name} onChange={(x) => setV({ ...v, name: x })} />
        <Field label="Телефон" placeholder="+996 700 000 000" type="tel" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} />
        <Field label="Адрес" placeholder="Улица, дом, квартира" value={v.address} onChange={(x) => setV({ ...v, address: x })} />
      </div>
      <div className="px-4 mt-6">
        <button onClick={onBack} className="w-full py-4 rounded-2xl text-white font-semibold text-base active:scale-[0.98] transition-transform" style={{ background: RED }}>
          Сохранить
        </button>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [tab, setTab] = useState<Tab>("catalog");
  const [selectedCategory, setSelectedCategory] = useState({ id: "", name: "" });
  const [selectedProduct, setSelectedProduct] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState("");

  const inApp = !["splash", "auth", "register", "login"].includes(screen);

  const handleTab = (t: Tab) => {
    setTab(t);
    if (t === "catalog") setScreen("catalog");
    else if (t === "cart") setScreen("cart");
    else if (t === "maps") setScreen("maps");
    else if (t === "orders") setScreen("orders");
    else if (t === "profile") setScreen("profile");
  };

  const renderScreen = () => {
    switch (screen) {
      case "splash":
        return <SplashScreen onDone={() => setScreen("auth")} />;
      case "auth":
        return <AuthScreen onLogin={() => setScreen("login")} onRegister={() => setScreen("register")} onGuest={() => setScreen("catalog")} />;
      case "register":
        return <RegisterScreen onDone={() => setScreen("catalog")} onLogin={() => setScreen("login")} onBack={() => setScreen("auth")} />;
      case "login":
        return <LoginScreen onDone={() => setScreen("catalog")} onRegister={() => setScreen("register")} onBack={() => setScreen("auth")} />;
      case "catalog":
        return <CatalogScreen onCategory={(id, name) => { setSelectedCategory({ id, name }); setScreen("category"); }} />;
      case "category":
        return <CategoryScreen name={selectedCategory.name} onBack={() => setScreen("catalog")} onProduct={(id) => { setSelectedProduct(id); setScreen("product"); }} onImageSearch={() => setScreen("imageSearch")} />;
      case "imageSearch":
        return <ImageSearchScreen onBack={() => setScreen("category")} />;
      case "product":
        return <ProductScreen productId={selectedProduct} onBack={() => setScreen("category")} />;
      case "cart":
        return <CartScreen onCheckout={() => setScreen("checkout")} />;
      case "checkout":
        return <CheckoutScreen onBack={() => setScreen("cart")} onConfirm={() => { setScreen("orders"); setTab("orders"); }} />;
      case "maps":
        return <MapsScreen />;
      case "orders":
        return <OrdersScreen onOrder={(id) => { setSelectedOrder(id); setScreen("orderDetail"); }} />;
      case "orderDetail":
        return <OrderDetailScreen orderId={selectedOrder} onBack={() => setScreen("orders")} />;
      case "profile":
        return <ProfileScreen onEdit={() => setScreen("editProfile")} onLogout={() => { setScreen("auth"); setTab("catalog"); }} />;
      case "editProfile":
        return <EditProfileScreen onBack={() => setScreen("profile")} />;
    }
  };

  return (
    <PhoneShell>
      {renderScreen()}
      {inApp && <BottomNav active={tab} onTab={handleTab} />}
    </PhoneShell>
  );
}
