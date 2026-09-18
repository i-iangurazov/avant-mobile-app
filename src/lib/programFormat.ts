export const formatMinor = (value: string | number, suffix = "сом") => {
  try {
    const amount = BigInt(String(value));
    const sign = amount < 0n ? "−" : "";
    const absolute = amount < 0n ? -amount : amount;
    const whole = absolute / 100n;
    const fraction = absolute % 100n;
    return `${sign}${whole.toLocaleString("ru-RU")}${fraction ? `,${fraction.toString().padStart(2, "0")}` : ""} ${suffix}`;
  } catch {
    return `0 ${suffix}`;
  }
};

export const formatBonus = (value: string | number) => formatMinor(value, "бонусов");

export const plumberStatusLabels: Record<string, string> = {
  pending: "На проверке",
  approved: "Подтверждён",
  rejected: "Нужно уточнение",
  suspended: "Приостановлен"
};

export const loyaltyStatusLabels: Record<string, string> = {
  pending: "Ожидает",
  available: "Доступно",
  spent: "Использовано",
  reversed: "Возврат",
  cancelled: "Отменено"
};

export const leadStatusLabels: Record<string, string> = {
  new: "Новая",
  viewed: "Просмотрена",
  accepted: "Принята",
  declined: "Отклонена",
  in_progress: "В работе",
  completed: "Завершена",
  cancelled: "Отменена",
  expired: "Истекла"
};
