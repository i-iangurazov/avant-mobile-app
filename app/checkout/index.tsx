import {SelectField} from "../../src/components/SelectField";
import { useAuth } from "../../src/hooks/useAuth";
import { quoteOrder, hasPendingOrder, type OrderQuote } from "../../src/lib/api/orders";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../src/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../src/components/AppButton";
import { AppInput } from "../../src/components/AppInput";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, spacing, typography } from "../../src/constants/theme";
import { useCart } from "../../src/hooks/useCart";
import { useCreateOrderFromCart } from "../../src/hooks/useOrders";
import { useProfile } from "../../src/hooks/useProfile";
import { useStores } from "../../src/hooks/useStores";
import { formatPrice, friendlyError, isValidKyrgyzPhone, normalizePhone, phoneValidationMessage } from "../../src/lib/formatters";
import { safeBack } from "../../src/lib/navigation/safeBack";
import { openWhatsApp } from "../../src/lib/whatsapp";
import type { FulfillmentMethod } from "../../src/types";

type FieldErrors = Partial<Record<"name" | "phone" | "address" | "store", string>>;

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const {session,user} = useAuth();
  const [quote,setQuote] = useState<OrderQuote | null>(null);
  const [pending,setPending] = useState(false);
  const [quoting,setQuoting] = useState(false);
  const [serverError,setServerError] = useState("");
  const profile = useProfile();
  const stores = useStores();
  const cart = useCart();
  const createOrder = useCreateOrderFromCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<FulfillmentMethod>("pickup");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(()=>{ if(user) void hasPendingOrder(user.id).then(setPending); },[user]);
  useEffect(()=>{setQuote(null);},[name,phone,method,storeId,address,comment,cart.data]);
  const isReservation = params.mode === "reservation";

  useEffect(() => {
    if (profile.data) {
      setName((current) => current || profile.data.name);
      setPhone((current) => current || profile.data.phone);
      setAddress((current) => current || profile.data.address || "");
    }
  }, [profile.data]);

  useEffect(() => {
    if (!storeId && stores.data?.[0]) {
      setStoreId(stores.data[0].id);
    }
  }, [storeId, stores.data]);

  const submit = async () => {
    if (isReservation && profile.data?.plumber?.applicationStatus !== "approved") {
      Alert.alert("Резерв недоступен", "Быстрый резерв доступен после подтверждения анкеты сантехника.");
      return;
    }
    const nextErrors: FieldErrors = {
      name: name.trim() ? undefined : "Введите имя",
      phone: !phone.trim() ? "Введите телефон" : !isValidKyrgyzPhone(phone) ? phoneValidationMessage : undefined,
      store: method === "pickup" && !storeId ? "Выберите магазин для самовывоза" : undefined,
      address: method === "delivery" && !address.trim() ? "Введите адрес доставки" : undefined
    };
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    if (!pending && !cart.data?.items.length) {
      Alert.alert("Корзина пуста", "Добавьте товары перед оформлением заказа.");
      return;
    }

    try {
      const selectedStore = stores.data?.find((store) => store.id === storeId);
      const payload = {
        customerName: name.trim(),
        customerPhone: normalizePhone(phone),
        deliveryMethod: method,
        storeId: method === "pickup" ? storeId : null,
        storeName: method === "pickup" ? selectedStore?.name ?? null : null,
        storeAddress: method === "pickup" ? selectedStore?.address ?? null : null,
        deliveryAddress: method === "delivery" ? address.trim() : null,
        comment: comment.trim() || null,
        orderKind: isReservation ? "reservation" as const : "order" as const,
        projectNote: isReservation ? comment.trim() || null : null
      };
      setServerError('');
      if (!quote && !pending) {
        setQuoting(true);
        setQuote(await quoteOrder({...payload,items:cart.data?.items || []},session?.accessToken));
        return;
      }
      const result = await createOrder.mutateAsync({...payload,quote});

      Alert.alert(isReservation ? "Резерв создан" : "Заказ оформлен", isReservation ? "Это резерв, а не оплата. Менеджер проверит остатки и подтвердит готовность к самовывозу." : "Заказ оформлен. Менеджер свяжется с вами для подтверждения.");
      router.replace({ pathname: "/orders/[id]", params: { id: result.order_id } });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Не удалось оформить заказ.');
      setQuote(null);
      const unresolved = user ? await hasPendingOrder(user.id) : false;
      setPending(unresolved);
      if (unresolved) {
        Alert.alert("Ответ сервера не получен", "Заказ мог сохраниться. Нажмите «Проверить результат отправки», чтобы открыть его без повторного оформления.");
        return;
      }
      Alert.alert("Не удалось оформить заказ", friendlyError(error instanceof Error ? error.message : undefined), [
        { text: "Закрыть", style: "cancel" },
        {
          text: "Написать в WhatsApp",
          onPress: () =>
            void openWhatsApp("Здравствуйте! Не удалось оформить заказ в приложении, помогите пожалуйста.").catch(
              (whatsAppError) =>
                Alert.alert("WhatsApp", friendlyError(whatsAppError instanceof Error ? whatsAppError.message : undefined))
            )
        }
      ]);
    } finally { setQuoting(false); }
  };

  if (profile.isLoading || stores.isLoading || cart.isLoading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <LoadingState text="Готовим оформление..." />
      </SafeAreaView>
    );
  }

  if (profile.isError || stores.isError || cart.isError) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ErrorState
          message={profile.error?.message ?? stores.error?.message ?? cart.error?.message}
          onRetry={() => {
            void profile.refetch();
            void stores.refetch();
            void cart.refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScreenHeader title={isReservation ? "Быстрый резерв" : "Оформление заказа"} subtitle={isReservation ? "Резерв не является оплатой" : "Менеджер подтвердит наличие и цену"} onBack={() => safeBack("/cart")} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AppInput label="Имя" placeholder="Ваше имя" value={name} onChangeText={setName} error={errors.name} />
          <AppInput
            label="Телефон"
            placeholder="+996 700 000 000"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
          />
          <View style={styles.segmentBlock}>
            <Text style={styles.label}>Способ получения</Text>
            <View style={styles.segment}>
              {(isReservation ? [
                ["pickup", "Самовывоз"]
              ] : [
                ["pickup", "Самовывоз"],
                ["delivery", "Доставка"]
              ]).map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  aria-checked={method===value} accessibilityState={{checked:method===value}}
                  onPress={() => setMethod(value as FulfillmentMethod)}
                  style={[styles.segmentItem, method === value && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentText, method === value && styles.segmentTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {method === "pickup" ? (
            <View style={styles.segmentBlock}>
              <SelectField label="Магазин для самовывоза" value={storeId} options={(stores.data??[]).map(store=>({value:store.id,label:store.name,description:store.address}))} onChange={setStoreId} searchable error={errors.store}/>
            </View>
          ) : (
            <AppInput
              label="Адрес доставки"
              placeholder="Улица, дом, квартира"
              value={address}
              onChangeText={setAddress}
              error={errors.address}
            />
          )}

          <AppInput
            label={isReservation ? "Проект / клиент (необязательно)" : "Комментарий"}
            placeholder={isReservation ? "Например: объект на ул. Киевской" : "Удобное время, детали доставки"}
            value={comment}
            onChangeText={setComment}
            multiline
            style={styles.commentInput}
          />
          {isReservation ? <View style={styles.reservationNotice}><Ionicons name="information-circle-outline" size={20} color={colors.secondary} /><Text style={styles.reservationNoticeText}>Товары будут отложены только после подтверждения менеджером. Оплата выполняется отдельно.</Text></View> : null}
          {quote ? <Text style={styles.label}>Итог по данным сервера: {formatPrice(quote.totalAmount, 'Уточняется менеджером')}. Оплата отдельно.</Text> : null}
          {pending ? <Text style={styles.label}>Есть незавершённая отправка. Проверим её результат по прежнему номеру запроса.</Text> : null}
          {serverError ? <Text accessibilityRole="alert" style={styles.errorText}>{serverError}</Text> : null}
          <AppButton title={pending ? "Проверить результат отправки" : quote ? "Подтвердить заказ" : "Проверить итог"} onPress={() => void submit()} loading={createOrder.isPending || quoting} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface
  },
  flex: {
    flex: 1
  },
  content: {
    padding: spacing.xxl,
    gap: spacing.lg
  },
  segmentBlock: {
    gap: spacing.sm
  },
  label: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800"
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: 4
  },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentItemActive: {
    backgroundColor: colors.surface
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: colors.primary
  },
  storeList: {
    gap: spacing.sm
  },
  storeOption: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 3
  },
  storeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  storeName: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "900"
  },
  storeNameActive: {
    color: colors.primary
  },
  storeAddress: {
    color: colors.textMuted,
    fontSize: typography.tiny,
    lineHeight: 16
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.tiny,
    fontWeight: "700"
  },
  commentInput: {
    minHeight: 92,
    textAlignVertical: "top",
    paddingTop: spacing.md
  },
  reservationNotice: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.secondarySoft },
  reservationNoticeText: { flex: 1, color: colors.textMuted, fontSize: typography.small, lineHeight: 19 }
});
