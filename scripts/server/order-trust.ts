import type pg from 'pg';
import type { NewOrder } from './orders';
import { fail } from './security';
export type OrderContext = { organizationId: string; deliveryBranchId?: string; catalogSource?: string; fulfilmentMode?: 'inventory' | 'inquiry' };
export async function trustedOrder(client: pg.Pool | pg.PoolClient, payload: NewOrder, context: OrderContext, hold: boolean) {
 if (!context.organizationId) fail('Сервис заказов ещё не настроен.',503);
 const inquiry=context.fulfilmentMode==='inquiry';
 if(inquiry&&context.catalogSource!=='database')fail('Режим заявок требует действующий каталог сайта.',503);
 const branchId=payload.deliveryMethod==='pickup'?payload.storeId:context.deliveryBranchId;
 if (!branchId) fail('Способ получения временно недоступен.',409);
 const branches=await client.query(`SELECT * FROM app_order_branches WHERE organization_id=$1 AND id=$2 AND is_active AND orders_enabled`,[context.organizationId,branchId]);
 const branch=branches.rows[0];
 if(!branch || (payload.deliveryMethod==='delivery'&&!branch.delivery_enabled)) fail('Этот филиал недоступен для заказа.',409);
 if (!payload.items.length || payload.items.length>100) fail('Проверьте состав заказа.');
 const seen=new Set<string>();
 const items=[];
 for(const item of [...payload.items].sort((a,b)=>(a.productId||'').localeCompare(b.productId||''))) {
  if(!item.productId || seen.has(item.productId) || !Number.isSafeInteger(item.quantity) || item.quantity<1 || item.quantity>999) fail('Проверьте товары и количество.');
  seen.add(item.productId);
  let price:number|null=null;
  let productName='';
  if(!inquiry){
   const result=await client.query(`SELECT * FROM app_order_offers WHERE organization_id=$1 AND branch_id=$2 AND product_id=$3 ${hold?'FOR UPDATE':''}`,[context.organizationId,branchId,item.productId]);
   const offer=result.rows[0];
   if(!offer || !offer.is_active || new Date(offer.valid_until).getTime()<=Date.now()) fail('Данные товара устарели или товар недоступен. Обновите корзину.',409);
   if(offer.stock_quantity-offer.reserved_quantity<item.quantity) fail(`Недостаточно товара «${offer.product_name}» в выбранном филиале.`,409);
   price=offer.unit_price_minor===null?null:Number(offer.unit_price_minor)/100;
   productName=offer.product_name as string;
  }
  if(context.catalogSource==='database'){
   // Catalogue prices and active variants come from the same DB as the website.
   // The branch offer remains the authority for inventory/reservations only.
   const current=await client.query(`SELECT v.price, v."priceRetail", pt.name, vt.label
    FROM "Variant" v JOIN "Product" p ON p.id=v."productId"
    JOIN "Category" c ON c.id=p."categoryId"
    LEFT JOIN "Subcategory" s ON s.id=p."subcategoryId"
    LEFT JOIN LATERAL (SELECT name FROM "ProductTranslation" WHERE "productId"=p.id ORDER BY CASE locale WHEN 'ru' THEN 0 WHEN 'en' THEN 1 ELSE 2 END LIMIT 1) pt ON true
    LEFT JOIN LATERAL (SELECT label FROM "VariantTranslation" WHERE "variantId"=v.id ORDER BY CASE locale WHEN 'ru' THEN 0 WHEN 'en' THEN 1 ELSE 2 END LIMIT 1) vt ON true
    WHERE v.id=$1 AND v."isActive" AND p."isActive" AND c."isActive"
      AND (p."subcategoryId" IS NULL OR s."isActive") ${hold?'FOR SHARE OF v,p,c':''}`,[item.productId]);
   const variant=current.rows[0];if(!variant)fail('Вариант товара недоступен. Обновите корзину.',409);
   const retail=Number(variant.priceRetail),base=Number(variant.price);
   const value=Number.isFinite(retail)&&retail>0?retail:base;
   price=Number.isFinite(value)&&value>0?Math.round((value+Number.EPSILON)*100)/100:null;
   productName=[variant.name,variant.label].filter(Boolean).join(' · ')||productName;
  }
  if(hold && item.unitPrice!==price) fail('Цена изменилась. Обновите расчёт и подтвердите заказ снова.',409);
  if(hold&&!inquiry) await client.query('UPDATE app_order_offers SET reserved_quantity=reserved_quantity+$4 WHERE organization_id=$1 AND branch_id=$2 AND product_id=$3',[context.organizationId,branchId,item.productId,item.quantity]);
  items.push({...item,productName,unitPrice:price,unitPriceLabel:price===null?'Уточняется менеджером':null});
 }
 return {...payload,storeId:branch.id as string,storeName:branch.name as string,storeAddress:branch.address as string,items};
}
export function trustedTotal(items: NewOrder['items']) {
 if(items.some(i=>i.unitPrice===null)) return null;
 const minor=items.reduce((sum,i)=>sum+BigInt(Math.round(i.unitPrice!*100))*BigInt(i.quantity),0n);
 return `${minor/100n}.${String(minor%100n).padStart(2,'0')}`;
}
