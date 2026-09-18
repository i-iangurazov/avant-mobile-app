import {TWO_GIS_FIRM_IDS,TWO_GIS_OPEN_URL} from '../../data/stores';
export const externalMapUrl=(firmId?:string|null)=>firmId?`https://2gis.kg/bishkek/firm/${encodeURIComponent(firmId)}`:TWO_GIS_OPEN_URL;
export const buildMapUrl=(firmId?:string|null)=>`https://widgets.2gis.com/widget?type=firmsonmap&options=${encodeURIComponent(JSON.stringify({pos:{lat:42.88904574206037,lon:74.60369110107423,zoom:firmId?17:13},opt:{city:'bishkek'},org:firmId||TWO_GIS_FIRM_IDS.join(',')}))}`;
export type TwoGisMapProps={firmId?:string|null;storeName?:string;onInteractionChange?:(interacting:boolean)=>void};
