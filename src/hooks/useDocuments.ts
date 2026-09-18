import {useQuery} from '@tanstack/react-query';
import {appApiClient} from '../lib/api/client';
export type PublicDocument={kind:string;version:string;title:string;body:string};
export function useDocuments(){return useQuery({queryKey:['public-documents'],queryFn:async()=>{
 const result=await appApiClient.request<{data:PublicDocument[]}>('/public/documents');return result.data;
}});}
