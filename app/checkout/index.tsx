import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { friendlyError, normalizePhone } from "../../src/lib/formatters";
import { safeBack } from "../../src/lib/navigation/safeBack";
import { openWhatsApp } from "../../src/lib/whatsapp";
import type { FulfillmentMethod } from "../../src/types";

type FieldErrors = Partial<Record<"name" | "phone" | "address" | "store", string>>;

export default function CheckoutScreen() {
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
    const nextErrors: FieldErrors = {
      name: name.trim() ? undefined : "Введите имя",
      phone: phone.trim() ? undefined : "Введите телефон",
      store: method === "pickup" && !storeId ? "Выберите магазин для самовывоза" : undefined,
      address: method === "delivery" && !address.trim() ? "Введите адрес доставки" : undefined
    };
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    if (!cart.data?.items.length) {
      Alert.alert("Корзина пуста", "Добавьте товары перед оформлением заказа.");
      return;
    }

    try {
      const result = await createOrder.mutateAsync({
        customerName: name.trim(),
        customerPhone: normalizePhone(phone),
        deliveryMethod: method,
        storeId: method === "pickup" ? storeId : null,
        deliveryAddress: method === "delivery" ? address.trim() : null,
        comment: comment.trim() || null
      });

      Alert.alert("Заказ оформлен", "Заказ оформлен. Менеджер свяжется с вами для подтверждения.");
      router.replace({ pathname: "/orders/[id]", params: { id: result.order_id } });
    } catch (error) {
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
    }
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
        <ScreenHeader title="Оформление заказа" subtitle="Менеджер подтвердит наличие и цену" onBack={() => safeBack("/cart")} />
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
              {[
                ["pickup", "Самовывоз"],
                ["delivery", "Доставка"]
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
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
              <Text style={styles.label}>Магазин для самовывоза</Text>
              <View style={styles.storeList}>
                {(stores.data ?? []).map((store) => (
                  <Pressable
                    key={store.id}
                    accessibilityRole="button"
                    onPress={() => setStoreId(store.id)}
                    style={[styles.storeOption, storeId === store.id && styles.storeOptionActive]}
                  >
                    <Text style={[styles.storeName, storeId === store.id && styles.storeNameActive]}>{store.name}</Text>
                    <Text style={styles.storeAddress}>{store.address}</Text>
                  </Pressable>
                ))}
              </View>
              {errors.store ? <Text style={styles.errorText}>{errors.store}</Text> : null}
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
            label="Комментарий"
            placeholder="Удобное время, детали доставки"
            value={comment}
            onChangeText={setComment}
            multiline
            style={styles.commentInput}
          />
          <AppButton title="Подтвердить заказ" onPress={() => void submit()} loading={createOrder.isPending} />
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
  }
});
