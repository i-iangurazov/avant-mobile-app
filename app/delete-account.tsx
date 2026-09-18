import AsyncStorage from "@react-native-async-storage/async-storage";
import {rewardAttemptKey} from "../src/lib/rewards/rewardAttempt";
import {useEffect,useState} from 'react';
import {router} from 'expo-router';
import {ScrollView,Text,Pressable} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AppInput} from '../src/components/AppInput';
import {AppButton} from '../src/components/AppButton';
import {PhoneVerification,type PhoneProof} from '../src/components/PhoneVerification';
import {ScreenHeader} from '../src/components/ScreenHeader';
import {useAuth} from '../src/hooks/useAuth';
import {useDocuments} from '../src/hooks/useDocuments';
import {appApiClient} from '../src/lib/api/client';
import {colors,spacing} from '../src/constants/theme';
import {safeBack} from '../src/lib/navigation/safeBack';
export default function DeleteAccount(){const {user,session,signOut}=useAuth();const docs=useDocuments();
 const [password,setPassword]=useState('');const [proof,setProof]=useState<PhoneProof>();const [confirmed,setConfirmed]=useState(false);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 const policy=docs.data?.find(d=>d.kind==='deletion');
 useEffect(()=>setConfirmed(false),[policy?.version]);
 const submit=async()=>{setLoading(true);setError('');try{
  await appApiClient.request('/profile',{method:'DELETE',headers:{Authorization:`Bearer ${session?.accessToken}`},body:JSON.stringify({password,phoneProof:proof,deletionDocumentVersion:policy?.version})});
  if(user)await AsyncStorage.removeItem(rewardAttemptKey(user.id));
  await signOut();router.replace('/welcome');
 }catch(e){setError(e instanceof Error?e.message:'Аккаунт не удалён. Попробуйте снова.');}finally{setLoading(false);}};
 return <SafeAreaView style={{flex:1,backgroundColor:colors.surface}}><ScreenHeader title="Удалить аккаунт" onBack={()=>safeBack('/profile')} />
 <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:spacing.xl,gap:spacing.lg}}>
 <Text>Авантехник — удаление аккаунта и связанных данных. Этот путь доступен в приложении и в браузере.</Text>
 {policy?<Text selectable>{policy.body}</Text>:<Text>Порядок удаления и хранения данных ещё не опубликован. Завершение удаления заблокировано до его утверждения.</Text>}
 {!user?<><Text>Войдите, чтобы подтвердить личность и удалить аккаунт. Устанавливать приложение для этого не требуется.</Text><AppButton title="Войти" onPress={()=>router.push('/login')} /></>:<>
 <Text>Проверяем аккаунт {user.phone}. Удаление нельзя отменить.</Text>
 <AppInput label="Текущий пароль" secureTextEntry value={password} onChangeText={setPassword} />
 <PhoneVerification phone={user.phone} action="delete" token={session?.accessToken} onChange={setProof} />
 <Pressable accessibilityRole="checkbox" aria-checked={confirmed} accessibilityState={{checked:confirmed}} onPress={()=>setConfirmed(!confirmed)} style={{minHeight:48,justifyContent:'center'}}><Text>{confirmed?'☑':'☐'} Я прочитал порядок удаления и подтверждаю удаление аккаунта и связанных данных.</Text></Pressable>
 {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
 <AppButton title="Удалить аккаунт и данные" variant="danger" disabled={!policy||!confirmed||!proof||!password} loading={loading} onPress={()=>void submit()} /></>}
 <AppButton title="Связаться с поддержкой" variant="secondary" onPress={()=>router.push('/profile/about')} />
 </ScrollView></SafeAreaView>;
}
