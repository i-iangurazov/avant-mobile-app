import {useState} from 'react';
import {Image,Text,View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {AppButton} from './AppButton';
import {useAuth} from '../hooks/useAuth';
import {appApiClient} from '../lib/api/client';
import {colors,spacing} from '../constants/theme';
export function PhotoAttachment({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const {session}=useAuth();const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 const choose=async()=>{setError('');setLoading(true);try{
  const selected=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:false,allowsEditing:true,quality:0.6,base64:true});
  if(selected.canceled)return;
  const data=selected.assets[0].base64;if(!data)throw new Error('Не удалось прочитать фотографию. Выберите JPEG или PNG.');
  if(data.length>2_800_000)throw new Error('Выберите фотографию размером до 2 МБ.');
  const response=await appApiClient.request<{data:{url:string}}>('/media',{method:'POST',headers:{Authorization:`Bearer ${session?.accessToken}`},body:JSON.stringify({dataBase64:data})});
  onChange(response.data.url);
 }catch(e){setError(e instanceof Error?e.message:'Не удалось прикрепить фото.');}finally{setLoading(false);}};
 return <View style={{gap:spacing.sm}}><Text style={{color:colors.text}}>Фотография (необязательно)</Text>
 {value?<><Image source={{uri:value}} accessibilityLabel="Прикреплённая фотография" style={{width:96,height:96,borderRadius:12}}/><AppButton title="Убрать фото из формы" variant="secondary" onPress={()=>onChange('')} /></>:null}
 <AppButton title={value?'Заменить фото':'Выбрать фото'} variant="secondary" onPress={()=>void choose()} loading={loading}/>
 {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
 </View>;
}
