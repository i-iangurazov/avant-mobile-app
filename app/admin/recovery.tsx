import {useEffect,useState} from 'react';
import {ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AppInput} from '../../src/components/AppInput';
import {AppButton} from '../../src/components/AppButton';
import {ScreenHeader} from '../../src/components/ScreenHeader';
import {useAuth} from '../../src/hooks/useAuth';
import {appApiClient} from '../../src/lib/api/client';
import {safeBack} from '../../src/lib/navigation/safeBack';
import {colors,spacing} from '../../src/constants/theme';
type Request={id:string;name:string;phone:string;contactNote:string;status:string};
export default function RecoveryAdministration(){
  const {user,session}=useAuth();const [requests,setRequests]=useState<Request[]>([]);
  const [selected,setSelected]=useState('');const [note,setNote]=useState('');const [password,setPassword]=useState('');
  const [link,setLink]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const headers={Authorization:`Bearer ${session?.accessToken}`};
  const load=async()=>{setError('');try{const data=await appApiClient.request<{data:Request[]}>('/admin/account-recovery',{headers});setRequests(data.data);}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить заявки.');}};
  useEffect(()=>{if(user?.isAdmin)void load();else{setRequests([]);setLink('');setPassword('');}},[user?.id,user?.isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
  const approve=async()=>{setBusy(true);setError('');try{
    const result=await appApiClient.request<{url:string}>('/admin/account-recovery/approve',{method:'POST',headers,body:JSON.stringify({requestId:selected,reviewNote:note,password})});
    setLink(result.url);setPassword('');setSelected('');setNote('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Не удалось обработать заявку.');}finally{setBusy(false);}};
  return <SafeAreaView style={{flex:1,backgroundColor:colors.surface}}><ScreenHeader title="Восстановление аккаунтов" onBack={()=>safeBack('/admin')} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:spacing.lg,gap:spacing.lg}}>
      {!user?.isAdmin?<Text>Доступно только администратору.</Text>:<>
        <Text>Проверьте владельца по утверждённой процедуре поддержки. Введённый номер и текст заявки не доказывают владение аккаунтом. Передавайте ссылку только проверенному владельцу, не публикуйте её.</Text>
        <AppButton title="Обновить заявки" variant="secondary" onPress={()=>void load()} />
        {requests.length===0?<Text>Открытых заявок нет.</Text>:requests.map(r=><View key={r.id} style={{padding:spacing.md,gap:spacing.sm,backgroundColor:colors.surfaceMuted}}>
          <Text>{r.name} · {r.phone}</Text><Text>{r.contactNote}</Text>
          {r.status==='pending'?<AppButton title="Проверить владельца" variant="secondary" onPress={()=>{setSelected(r.id);setNote('');setPassword('');setLink('');}} />:<Text>Ссылка выдана. Срок действия —30 минут.</Text>}
        </View>)}
        {selected?<><AppInput label="Основание и результат проверки" value={note} onChangeText={setNote} multiline maxLength={1000} />
          <AppInput label="Текущий пароль администратора" value={password} onChangeText={setPassword} secureTextEntry />
          <AppButton title="Выдать одноразовую ссылку" disabled={note.trim().length<10||!password} loading={busy} onPress={()=>void approve()} /></>:null}
        {link?<><Text>Передайте проверенному владельцу. Ссылка показывается один раз и действует 30 минут.</Text><Text selectable>{link}</Text><AppButton title="Скрыть ссылку" variant="secondary" onPress={()=>setLink('')} /></>:null}
      </>}
      {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
    </ScrollView></SafeAreaView>;
}
