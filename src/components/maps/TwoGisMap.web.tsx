import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Linking,Text,View,useWindowDimensions} from 'react-native';
import {AppButton} from '../AppButton';
import {spacing} from '../../constants/theme';
import {buildMapHtml,externalMapUrl,mapFirmIsKnown,type TwoGisMapProps} from './mapSource';
export function TwoGisMap({firmId,storeName='Авантехник',onSelectFirm}:TwoGisMapProps){
 const {height:windowHeight}=useWindowDimensions();const mapHeight=Math.max(260,Math.min(390,windowHeight-310));
 const [failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false),[attempt,setAttempt]=useState(0);
 const frame=useRef<HTMLIFrameElement>(null);const html=useMemo(()=>buildMapHtml(firmId),[firmId]);
 useEffect(()=>{setFailed(false);setLoaded(false);},[firmId,attempt]);
 useEffect(()=>{if(loaded)return;const timer=setTimeout(()=>setFailed(true),20000);return()=>clearTimeout(timer);},[loaded,firmId,attempt]);
 useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.source!==frame.current?.contentWindow||typeof event.data!=='string')return;try{const m=JSON.parse(event.data);if(m.channel!=='avantehnik-map')return;if(m.type==='ready')setLoaded(true);if(m.type==='failed')setFailed(true);if(m.type==='select'&&mapFirmIsKnown(m.id))onSelectFirm?.(m.id);}catch{}};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[onSelectFirm]);
 return <View style={{gap:spacing.md}}>
 {failed?<View style={{padding:20,gap:12}}><Text>Карта временно недоступна. Адрес и контакты филиала доступны ниже.</Text><AppButton title="Повторить загрузку карты" onPress={()=>setAttempt(v=>v+1)} variant="secondary"/></View>:
 React.createElement('iframe',{ref:frame,key:`${firmId}-${attempt}`,srcDoc:html,title:`Карта филиалов: ${storeName}`,onError:()=>setFailed(true),style:{width:'100%',height:mapHeight,border:0},referrerPolicy:'strict-origin-when-cross-origin'})}
 <View style={{paddingHorizontal:spacing.xl}}><AppButton title="Открыть выбранный филиал в 2GIS" variant="secondary" onPress={()=>void Linking.openURL(externalMapUrl(firmId))}/></View>
 </View>;
}
