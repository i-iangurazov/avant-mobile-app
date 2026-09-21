import {useEffect,useState} from 'react';
import {ScrollView} from "react-native";
import { AppText as Text } from "../src/components/AppText";
import {SafeAreaView} from 'react-native-safe-area-context';
import {router,useLocalSearchParams} from 'expo-router';
import {AppInput} from '../src/components/AppInput';
import {AppButton} from '../src/components/AppButton';
import {ScreenHeader} from '../src/components/ScreenHeader';
import {appApiClient} from '../src/lib/api/client';
import {handleKyrgyzPhoneInput,normalizePhone} from '../src/lib/formatters';
import {colors,spacing} from '../src/constants/theme';

export default function PasswordReset() {
  const params=useLocalSearchParams<{token?:string}>();
  const [phone,setPhone]=useState('');const [contact,setContact]=useState('');
  const [link,setLink]=useState(params.token || '');const [password,setPassword]=useState('');
  const [useLink,setUseLink]=useState(Boolean(params.token));const [sent,setSent]=useState(false);
  const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  useEffect(()=>{if(params.token){setLink(params.token);setUseLink(true);setPassword('');}},[params.token]);
  const submit=async()=>{setLoading(true);setError('');try{
    if(useLink){
      let token=link.trim();
      if(token.startsWith('avantehnik://password-reset?')) token=new URL(token).searchParams.get('token') || '';
      await appApiClient.request('/auth/password/reset',{method:'POST',body:JSON.stringify({token,password})});
      setPassword('');setLink('');router.replace('/login');
    }else{
      await appApiClient.request('/auth/recovery/request',{method:'POST',body:JSON.stringify({phone:normalizePhone(phone),contactNote:contact})});setSent(true);
    }
  }catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить запрос.');}finally{setLoading(false);}};
  return <SafeAreaView style={{flex:1,backgroundColor:colors.surface}}><ScreenHeader title="Восстановление доступа" onBack={()=>router.replace('/login')} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:spacing.xl,gap:spacing.lg}}>
      {useLink?<><Text>Используйте одноразовую ссылку, полученную от поддержки после проверки аккаунта. Она действует 30 минут. После смены пароля прежние сеансы завершатся.</Text>
        <AppInput label="Ссылка восстановления" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} />
        <AppInput label="Новый пароль" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" />
        <AppButton title="Изменить пароль" loading={loading} disabled={!link||password.length<8} onPress={()=>void submit()} /></>:
        sent?<Text accessibilityRole="alert">Если аккаунт с таким номером существует, заявка передана в поддержку. Дождитесь проверки владельца аккаунта. Это ещё не смена пароля.</Text>:
        <><Text>Отправьте заявку в поддержку. После ручной проверки владельца аккаунта сотрудник передаст вам ссылку для смены пароля. SMS-код не требуется.</Text>
          <AppInput label="Телефон аккаунта" value={phone} keyboardType="phone-pad" onChangeText={v=>setPhone(handleKyrgyzPhoneInput(v))} />
          <AppInput label="Как с вами связаться" value={contact} onChangeText={setContact} multiline maxLength={1000} placeholder="Доступный контакт и удобный способ связи" />
          <Text>Не отправляйте пароль, паспортные данные и реквизиты карты.</Text>
          <AppButton title="Отправить заявку" loading={loading} disabled={!phone||contact.trim().length<5} onPress={()=>void submit()} /></>}
      {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
      <AppButton title={useLink?'Обратиться в поддержку':'У меня есть ссылка восстановления'} variant="secondary" onPress={()=>{setUseLink(!useLink);setError('');}} />
    </ScrollView></SafeAreaView>;
}
