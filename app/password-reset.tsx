import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppInput } from '../src/components/AppInput';
import { AppButton } from '../src/components/AppButton';
import { PhoneVerification, type PhoneProof } from '../src/components/PhoneVerification';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { appApiClient } from '../src/lib/api/client';
import { handleKyrgyzPhoneInput, normalizePhone } from '../src/lib/formatters';
import { colors, spacing } from '../src/constants/theme';
export default function PasswordReset() {
 const [phone,setPhone]=useState('');const [password,setPassword]=useState('');const [proof,setProof]=useState<PhoneProof>();
 const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 const submit=async()=>{setLoading(true);setError('');try{
  await appApiClient.request('/auth/password/reset',{method:'POST',body:JSON.stringify({phone:normalizePhone(phone),password,phoneProof:proof})});router.replace('/login');
 }catch(e){setError(e instanceof Error?e.message:'Не удалось изменить пароль.');}finally{setLoading(false);}};
 return <SafeAreaView style={{flex:1,backgroundColor:colors.surface}}><ScreenHeader title="Восстановление доступа" onBack={()=>router.replace('/login')} />
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:spacing.xl,gap:spacing.lg}}>
   <Text>Подтвердите номер телефона. После смены пароля все прежние сеансы завершатся.</Text>
   <AppInput label="Телефон" value={phone} keyboardType="phone-pad" onChangeText={v=>setPhone(handleKyrgyzPhoneInput(v))} />
   <PhoneVerification phone={phone} action="password_reset" onChange={setProof} />
   <AppInput label="Новый пароль" value={password} onChangeText={setPassword} secureTextEntry />
   {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
   <AppButton title="Изменить пароль" onPress={()=>void submit()} loading={loading} disabled={!proof || password.length<8} />
  </ScrollView></SafeAreaView>;
}
