import {router} from 'expo-router';
import {Pressable,Text,View} from 'react-native';
import {colors,spacing} from '../constants/theme';
export function LegalLinks(){return <View style={{gap:spacing.sm}}>{[
 ['privacy','Политика конфиденциальности'],['terms','Условия использования'],['loyalty','Правила программы лояльности'],['deletion','Удаление аккаунта и данных']
].map(([kind,label])=><Pressable key={kind} accessibilityRole="link" onPress={()=>router.push({pathname:'/legal/[kind]',params:{kind}})} style={{paddingVertical:8,minHeight:44,justifyContent:'center'}}><Text style={{color:colors.secondary,fontSize:14}}>{label}</Text></Pressable>)}</View>;}
