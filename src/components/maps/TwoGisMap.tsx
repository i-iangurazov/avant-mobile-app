import {useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Linking,Text,View} from 'react-native';
import {WebView} from 'react-native-webview';
import {AppButton} from '../AppButton';
import {colors,spacing} from '../../constants/theme';
import {buildMapUrl,externalMapUrl,type TwoGisMapProps} from './mapSource';
export function TwoGisMap({firmId,onInteractionChange}:TwoGisMapProps){
 const [failed,setFailed]=useState(false);const [loaded,setLoaded]=useState(false);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{setFailed(false);setLoaded(false);onInteractionChange?.(false);},[firmId,attempt,onInteractionChange]);
 useEffect(()=>{if(loaded)return;const timer=setTimeout(()=>{setFailed(true);onInteractionChange?.(false);},20000);return()=>clearTimeout(timer);},[loaded,firmId,attempt,onInteractionChange]);
 const open=()=>void Linking.openURL(externalMapUrl(firmId)).catch(()=>Alert.alert('Карта','Не удалось открыть 2GIS.'));
 return <View style={{gap:spacing.md}}>
 {failed?<View style={{padding:20,gap:12}}><Text>Карта временно недоступна. Адрес и контакты филиала доступны ниже.</Text><AppButton title="Повторить загрузку карты" onPress={()=>setAttempt(v=>v+1)} variant="secondary"/></View>:
 <View style={{height:390}} onTouchStart={()=>onInteractionChange?.(true)} onTouchEnd={()=>onInteractionChange?.(false)} onTouchCancel={()=>onInteractionChange?.(false)}>
 <WebView key={`${firmId}-${attempt}`} source={{uri:buildMapUrl(firmId)}} javaScriptEnabled domStorageEnabled nestedScrollEnabled mixedContentMode="never" originWhitelist={['https://*']}
  onLoadEnd={()=>setLoaded(true)} onError={()=>{setFailed(true);onInteractionChange?.(false);}} onHttpError={()=>{setFailed(true);onInteractionChange?.(false);}}
  onShouldStartLoadWithRequest={request=>{try{const url=new URL(request.url);return url.protocol==='https:'&&(url.hostname==='2gis.kg'||url.hostname.endsWith('.2gis.kg')||url.hostname==='2gis.com'||url.hostname.endsWith('.2gis.com'));}catch{return false;}}}
  startInLoadingState renderLoading={()=><ActivityIndicator color={colors.primary}/>} />
 </View>}
 <View style={{paddingHorizontal:spacing.xl}}><AppButton title="Открыть выбранный филиал в 2GIS" variant="secondary" onPress={open}/></View>
 </View>;
}
