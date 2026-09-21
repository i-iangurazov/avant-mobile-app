import type { Product } from '../../types';

export type ProductSort = 'recommended' | 'name' | 'price_asc' | 'price_desc';

// Owner-approved order, resolved against the official storefront on 2026-09-21.
// IDs identify actual products; this list never creates products, prices or stock.
export const FEATURED_PRODUCTS = [
  { id: "cmq9cf7kn0001kz04lcw9os2s", name: "Отвод Иранский" },
  { id: "cmkqrvnn10021l504ykhd04ji", name: "Отвод шовный Россия" },
  { id: "cmkqqyv6v0001jv04m6smetjh", name: "Гибкий шланг" },
  { id: "cmlqb4w490001le04jtjw1paz", name: "Арматура для унитаза УКЛАД нижняя подача" },
  { id: "cmlq9r8s50001ju04hmyssg0v", name: "Сифоны для раковины А3013 Орио Россия" },
  { id: "cmlkfgvjb0001l104wwp4dd9x", name: "Фланцы стальные" },
  { id: "cmozcii2s000ml2045npc84k4", name: "Кран шаровой YHHG" },
  { id: "cmkqsrv140001l704v6xlpryv", name: "Задвижка (чугунная,клиновая) Россия" },
  { id: "cmmoqxree0006ie045v286zas", name: "Композитный газовый баллон 24,5л" },
  { id: "cmlj9kzrf0005l504ud6yc3b1", name: "Тэн Термекс" },
  { id: "cmmk7rj6o000gjv042ff75bv3", name: "Смеситель для ванны Авантехник" },
  { id: "cmlta82gf000qjx04ak2kt9ii", name: "Труба полипропиленовая PN20" },
  { id: "cmlt75vy60001jo042acrjnbt", name: "Муфта комбинированная разъёмная с наружной резьбой" },
  { id: "cmmbmp4py0001ky043lkqmnrk", name: "Разбрызгиватель SD1036" },
  { id: "cmlkrf5rp0001jv04rwdnaku9", name: "Счетчик воды Геррида" },
] as const;
const rank = new Map<string, number>(FEATURED_PRODUCTS.map((item, index) => [item.id, index]));

export function compareProducts(a: Product, b: Product, sort: ProductSort = 'recommended'): number {
  if (sort === 'recommended') {
    const photoOrder = Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl));
    if (photoOrder) return photoOrder;
    if (a.imageUrl && b.imageUrl) {
      const featuredOrder = (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity);
      if (featuredOrder) return featuredOrder;
    }
  }
  if (sort === 'price_asc' || sort === 'price_desc') {
    if (a.price === null && b.price !== null) return 1;
    if (b.price === null && a.price !== null) return -1;
    const priceOrder = (a.price ?? 0) - (b.price ?? 0);
    if (priceOrder) return sort === 'price_desc' ? -priceOrder : priceOrder;
  }
  return a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id);
}
