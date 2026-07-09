import type { StoreLocation } from "../types";
import { twoGisSearchUrl, whatsAppBusinessPhone } from "../lib/config/env";

export const TWO_GIS_FIRM_IDS = [
  "70000001110867614",
  "70000001038613165",
  "70000001083497407",
  "70000001098957255",
  "70000001110867599",
  "70000001110867625"
];

export const TWO_GIS_OPEN_URL = twoGisSearchUrl;
const STORE_WORKING_HOURS = "9:00 - 18:00";
const STORE_PHONE = whatsAppBusinessPhone || "+996500991966";

export const stores: StoreLocation[] = [
  {
    id: "store-1",
    name: "Авантехник Ортосай",
    address: "Безымянная улица, 20/4, 6 ряд, 46С контейнер, Бишкек",
    working_hours: STORE_WORKING_HOURS,
    phone: STORE_PHONE,
    external_2gis_url: TWO_GIS_OPEN_URL,
    sort_order: 1,
    is_active: true
  },
  {
    id: "store-2",
    name: "Авантехник Мега Комфорт",
    address: "Улица Ибраимова, 66, 3 ряд, 73, 76 бутик, Бишкек",
    working_hours: STORE_WORKING_HOURS,
    phone: STORE_PHONE,
    external_2gis_url: TWO_GIS_OPEN_URL,
    sort_order: 2,
    is_active: true
  },
  {
    id: "store-3",
    name: "Авантехник Баткен базар",
    address: "Улица Льва Толстого, 19, 1 этаж, 46-48 контейнер, Бишкек",
    working_hours: STORE_WORKING_HOURS,
    phone: STORE_PHONE,
    external_2gis_url: TWO_GIS_OPEN_URL,
    sort_order: 3,
    is_active: true
  },
  {
    id: "store-4",
    name: "Авантехник Табылга",
    address: "Табылга, проспект Жибек-Жолу, 150, 1 этаж, Б16, Б17 бутик, Бишкек",
    working_hours: STORE_WORKING_HOURS,
    phone: STORE_PHONE,
    external_2gis_url: TWO_GIS_OPEN_URL,
    sort_order: 4,
    is_active: true
  },
  {
    id: "store-5",
    name: "Авантехник Курулуш Гранд",
    address: "Улица Орозбекова, 354, 1 этаж, Бишкек",
    working_hours: STORE_WORKING_HOURS,
    phone: STORE_PHONE,
    external_2gis_url: TWO_GIS_OPEN_URL,
    sort_order: 5,
    is_active: true
  },
  {
    id: "store-6",
    name: "Авантехник Дордой",
    address: "Улица Евразия, 4, 7 контейнер, Бишкек",
    working_hours: STORE_WORKING_HOURS,
    phone: STORE_PHONE,
    external_2gis_url: TWO_GIS_OPEN_URL,
    sort_order: 6,
    is_active: true
  }
];
