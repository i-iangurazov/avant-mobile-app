import type { ComponentProps } from "react";
import { AppInput } from "./AppInput";
import { formatKyrgyzPhoneInput, nationalPhoneToAccount } from "../lib/formatters";

type Props = Omit<ComponentProps<typeof AppInput>, "value" | "onChangeText" | "prefix"> & {
  value: string;
  onChangeText: (phone: string) => void;
};

export function PhoneInput({ value, onChangeText, ...props }: Props) {
  const formatted = formatKyrgyzPhoneInput(value);
  const national = formatted.startsWith("+996") ? formatted.slice(4).trimStart() : formatted;
  return <AppInput {...props} prefix="+996" placeholder="700 000 000"
    keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel-national"
    accessibilityHint="Код страны +996 уже указан. Введите 9 цифр номера."
    value={national} onChangeText={text => onChangeText(nationalPhoneToAccount(text))} />;
}
