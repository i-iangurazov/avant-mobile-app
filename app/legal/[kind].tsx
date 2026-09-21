import {router,useLocalSearchParams} from 'expo-router';
import {ScrollView} from "react-native";
import { AppText as Text } from "../../src/components/AppText";
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScreenHeader} from '../../src/components/ScreenHeader';
import {AppButton} from '../../src/components/AppButton';
import {ErrorState} from '../../src/components/ErrorState';
import {LoadingState} from '../../src/components/LoadingState';
import {useDocuments} from '../../src/hooks/useDocuments';
import {colors,spacing} from '../../src/constants/theme';
import {safeBack} from '../../src/lib/navigation/safeBack';
export default function LegalDocument(){const {kind}=useLocalSearchParams<{kind:string}>();const docs=useDocuments();const doc=docs.data?.find(d=>d.kind===kind);
 return <SafeAreaView style={{flex:1,backgroundColor:colors.surface}}><ScreenHeader title={doc?.title || 'Документы'} onBack={()=>safeBack('/profile/about')} />
 <ScrollView contentContainerStyle={{padding:spacing.xl,gap:spacing.lg}}>
 {docs.isLoading?<LoadingState />:docs.isError?<ErrorState message={docs.error.message} onRetry={()=>void docs.refetch()} />:doc?<><Text style={{color:colors.textMuted}}>Версия {doc.version}</Text><Text selectable style={{color:colors.text,fontSize:16,lineHeight:24}}>{doc.body}</Text></>:<Text>Действующая версия документа ещё не опубликована. Уточните условия у поддержки.</Text>}
 {kind==='deletion'?<AppButton title="Перейти к удалению аккаунта" onPress={()=>router.push('/delete-account')} />:null}
 <AppButton title="Поддержка" variant="secondary" onPress={()=>router.push('/profile/about')} />
 </ScrollView></SafeAreaView>;
}
