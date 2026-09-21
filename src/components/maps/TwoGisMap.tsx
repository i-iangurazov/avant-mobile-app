import {useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,Linking,View,useWindowDimensions} from "react-native";
import { AppText as Text } from "../AppText";
import {WebView} from 'react-native-webview';
import {AppButton} from '../AppButton';
import {colors,spacing} from '../../constants/theme';
import {buildMapHtml,externalMapUrl,mapFirmIsKnown,type TwoGisMapProps} from './mapSource';
export function TwoGisMap({firmId,onInteractionChange,onSelectFirm}:TwoGisMapProps){
 const {height:windowHeight}=useWindowDimensions();const mapHeight=Math.max(260,Math.min(390,windowHeight-310));
 const [failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false),[attempt,setAttempt]=useState(0);
 const html=useMemo(()=>buildMapHtml(firmId),[firmId]);
 useEffect(()=>{setFailed(false);setLoaded(false);onInteractionChange?.(false);},[firmId,attempt,onInteractionChange]);
 useEffect(()=>{if(loaded)return;const timer=setTimeout(()=>{setFailed(true);onInteractionChange?.(false);},20000);return()=>clearTimeout(timer);},[loaded,firmId,attempt,onInteractionChange]);
 const open=(url=externalMapUrl(firmId))=>void Linking.openURL(url).catch(()=>Alert.alert('Карта','Не удалось открыть ссылку.'));
 return <View style={{gap:spacing.md}}>
 {failed?<View style={{padding:20,gap:12}}><Text>Карта временно недоступна. Адрес и контакты филиала доступны ниже.</Text><AppButton title="Повторить загрузку карты" onPress={()=>setAttempt(v=>v+1)} variant="secondary"/></View>:
 <View style={{height:mapHeight}} onTouchStart={()=>onInteractionChange?.(true)} onTouchEnd={()=>onInteractionChange?.(false)} onTouchCancel={()=>onInteractionChange?.(false)}>
 <WebView key={`${firmId}-${attempt}`} source={{html,baseUrl:'https://www.avantehnik.kg/'}} javaScriptEnabled domStorageEnabled cacheEnabled nestedScrollEnabled mixedContentMode="never" originWhitelist={['https://*','about:blank']}
  userAgent="Avantehnik/1.0 (+https://www.avantehnik.kg)"
  onMessage={({nativeEvent})=>{try{const m=JSON.parse(nativeEvent.data);if(m.channel!=='avantehnik-map')return;if(m.type==='ready')setLoaded(true);if(m.type==='failed'){setFailed(true);onInteractionChange?.(false);}if(m.type==='select'&&mapFirmIsKnown(m.id))onSelectFirm?.(m.id);}catch{}}}
  onError={()=>{setFailed(true);onInteractionChange?.(false);}}
  onShouldStartLoadWithRequest={request=>{if(request.url==='about:blank'||request.url==='https://www.avantehnik.kg/')return true;if(!request.isTopFrame)return true;try{const url=new URL(request.url);if(url.protocol==='https:'&&['2gis.kg','www.openstreetmap.org','leafletjs.com'].includes(url.hostname))open(url.toString());}catch{}return false;}}
  onOpenWindow={({nativeEvent})=>{try{const url=new URL(nativeEvent.targetUrl);if(url.protocol==='https:'&&['2gis.kg','www.openstreetmap.org','leafletjs.com'].includes(url.hostname))open(url.toString());}catch{}}}
  startInLoadingState renderLoading={()=><ActivityIndicator color={colors.primary}/>} />
 </View>}
 <View style={{paddingHorizontal:spacing.xl}}><AppButton title="Открыть выбранный филиал в 2GIS" variant="secondary" onPress={()=>open()}/></View>
 </View>;
}
