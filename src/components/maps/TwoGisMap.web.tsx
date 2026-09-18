import React,{useEffect,useState} from 'react';
import {Linking,Text,View} from 'react-native';
import {AppButton} from '../AppButton';
import {colors,spacing} from '../../constants/theme';
import {buildMapUrl,externalMapUrl,type TwoGisMapProps} from './mapSource';
export function TwoGisMap({firmId,storeName='Авантехник'}:TwoGisMapProps){
 const [failed,setFailed]=useState(false);const [loaded,setLoaded]=useState(false);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{setFailed(false);setLoaded(false);},[firmId,attempt]);
 useEffect(()=>{if(loaded)return;const timer=setTimeout(()=>setFailed(true),20000);return()=>clearTimeout(timer);},[loaded,firmId,attempt]);
 return <View style={{gap:spacing.md}}>
 {failed?<View style={{padding:20,gap:12}}><Text>Карта временно недоступна. Адрес и контакты филиала доступны ниже.</Text><AppButton title="Повторить загрузку карты" onPress={()=>setAttempt(v=>v+1)} variant="secondary"/></View>:
 React.createElement('iframe',{key:`${firmId}-${attempt}`,src:buildMapUrl(firmId),title:`Карта 2GIS: ${storeName}`,onLoad:()=>setLoaded(true),onError:()=>setFailed(true),style:{width:'100%',height:390,border:0,background:colors.surfaceMuted},referrerPolicy:'no-referrer'})}
 <View style={{paddingHorizontal:spacing.xl}}><AppButton title="Открыть выбранный филиал в 2GIS" variant="secondary" onPress={()=>void Linking.openURL(externalMapUrl(firmId))}/></View>
 </View>;
}
