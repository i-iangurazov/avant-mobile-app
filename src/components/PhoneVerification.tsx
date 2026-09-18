import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { AppInput } from './AppInput';
import { appApiClient } from '../lib/api/client';
import { normalizePhone } from '../lib/formatters';
import { colors, spacing } from '../constants/theme';
export type PhoneProof = { challengeId: string; code: string };
export function PhoneVerification({ phone, action, token, onChange }: {
  phone: string; action: 'register' | 'login' | 'phone_change' | 'password_reset' | 'delete'; token?: string | null;
  onChange: (proof: PhoneProof | undefined) => void;
}) {
  const [challengeId,setChallengeId]=useState(''); const [code,setCode]=useState('');
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  useEffect(()=>{ setChallengeId(''); setCode(''); setError(''); onChange(undefined); },[phone,action,onChange]);
  const send=async()=>{
    setLoading(true); setError('');
    try {
      const result=await appApiClient.request<{challengeId:string}>('/auth/phone/challenge', {method:'POST',
        headers:token?{Authorization:`Bearer ${token}`}:undefined, body:JSON.stringify({phone:normalizePhone(phone),action})});
      setChallengeId(result.challengeId); setCode(''); onChange(undefined);
    } catch(e){setError(e instanceof Error?e.message:'Не удалось отправить код.');} finally{setLoading(false);}
  };
  return <View style={{gap:spacing.sm}}>
    <AppButton title={challengeId?'Отправить новый код':'Получить код подтверждения'} onPress={()=>void send()} loading={loading} variant="secondary" />
    {challengeId?<AppInput label="Код из SMS" value={code} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6}
      onChangeText={value=>{const next=value.replace(/\D/g,'');setCode(next);onChange({challengeId,code:next});}} />:null}
    {challengeId?<Text style={{color:colors.textMuted}}>Код действует 5 минут и подходит только для этого действия.</Text>:null}
    {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
  </View>;
}
