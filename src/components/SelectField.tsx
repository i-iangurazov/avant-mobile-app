import Ionicons from '@expo/vector-icons/Ionicons';
import {useMemo,useState} from 'react';
import {FlatList,KeyboardAvoidingView,Modal,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AppInput} from './AppInput';
import {colors,radius,spacing} from '../constants/theme';
export function SelectField<T extends string>({label,value,options,onChange,searchable=false,error,disabled=false}:{label:string;value:T|null;options:{value:T;label:string;description?:string}[];onChange:(value:T)=>void;searchable?:boolean;error?:string;disabled?:boolean}){
 const [open,setOpen]=useState(false);const [search,setSearch]=useState('');
 const selected=options.find(o=>o.value===value);const visible=useMemo(()=>options.filter(o=>`${o.label} ${o.description||''}`.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))),[options,search]);
 const close=()=>{setOpen(false);setSearch('');};
 return <View style={{gap:8}}><Text style={styles.label}>{label}</Text>
 <Pressable accessibilityRole="combobox" accessibilityLabel={`${label}: ${selected?.label || 'Выберите'}`} aria-expanded={open} aria-disabled={disabled} accessibilityState={{expanded:open,disabled}} disabled={disabled} onPress={()=>setOpen(true)} style={[styles.control,disabled&&{opacity:0.6},Boolean(error)&&{borderColor:colors.danger}]}>
 <Text style={styles.value}>{selected?.label || 'Выберите'}</Text><Ionicons name="chevron-down" size={20} color={colors.textMuted}/></Pressable>
 {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
 <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
 <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}><Pressable accessibilityLabel="Закрыть выбор" accessibilityRole="button" onPress={close} style={StyleSheet.absoluteFill}/>
 <SafeAreaView style={styles.sheet} accessibilityViewIsModal><View style={styles.heading}><Text style={[styles.label,{flex:1,fontSize:20}]}>{label}</Text><Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Закрыть" style={styles.close}><Ionicons name="close" size={24}/></Pressable></View>
 {searchable?<AppInput label="Поиск" placeholder="Название или адрес" value={search} onChangeText={setSearch}/>:null}
 <FlatList data={visible} keyboardShouldPersistTaps="handled" keyExtractor={o=>o.value} ListEmptyComponent={<Text style={{padding:16}}>Ничего не найдено</Text>} renderItem={({item})=><Pressable accessibilityRole="radio" accessibilityLabel={[item.label,item.description].filter(Boolean).join(', ')} aria-checked={item.value===value} accessibilityState={{checked:item.value===value}} onPress={()=>{onChange(item.value);close();}} style={[styles.option,item.value===value&&{backgroundColor:colors.primarySoft}]}><View style={{flex:1}}><Text style={styles.value}>{item.label}</Text>{item.description?<Text style={{color:colors.textMuted,marginTop:4}}>{item.description}</Text>:null}</View>{item.value===value?<Ionicons accessible={false} name="checkmark" size={22} color={colors.primary}/>:null}</Pressable>}/>
 </SafeAreaView></KeyboardAvoidingView></Modal></View>;
}
const styles=StyleSheet.create({label:{color:colors.text,fontSize:14,fontWeight:'700'},value:{color:colors.text,fontSize:15,flexShrink:1},control:{minHeight:52,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,backgroundColor:colors.surface},backdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.35)',justifyContent:'flex-end'},sheet:{maxHeight:'85%',minHeight:260,backgroundColor:colors.surface,borderTopLeftRadius:20,borderTopRightRadius:20,padding:20,gap:12},heading:{flexDirection:'row',alignItems:'center'},close:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},option:{minHeight:56,padding:12,borderRadius:12,flexDirection:'row',alignItems:'center',gap:12}});
