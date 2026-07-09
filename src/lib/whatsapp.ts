import { Linking } from "react-native";
import { whatsAppBusinessPhone } from "./config/env";

const normalizeWhatsAppPhone = (phone: string) => phone.replace(/[^\d]/g, "");

export async function openWhatsApp(message = "Здравствуйте! Мне нужна помощь с заказом.") {
  const phone = normalizeWhatsAppPhone(whatsAppBusinessPhone);

  if (!phone) {
    throw new Error("Не настроен номер WhatsApp поддержки.");
  }

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  await Linking.openURL(url);
}
