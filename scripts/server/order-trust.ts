import type pg from 'pg';
import type { NewOrder } from './orders';
import { fail } from './security';
export type OrderContext = { organizationId: string; deliveryBranchId?: string };
export async function trustedOrder(client: pg.Pool | pg.PoolClient, payload: NewOrder, context: OrderContext, hold: boolean) {
 if (!context.organizationId) fail('Сервис заказов ещё не подключён к учёту остатков.',503);
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
  const result=await client.query(`SELECT * FROM app_order_offers WHERE organization_id=$1 AND branch_id=$2 AND product_id=$3 ${hold?'FOR UPDATE':''}`,[context.organizationId,branchId,item.productId]);
  const offer=result.rows[0];
  if(!offer || !offer.is_active || new Date(offer.valid_until).getTime()<=Date.now()) fail('Данные товара устарели или товар недоступен. Обновите корзину.',409);
  if(offer.stock_quantity-offer.reserved_quantity<item.quantity) fail(`Недостаточно товара «${offer.product_name}» в выбранном филиале.`,409);
  const price=offer.unit_price_minor===null?null:Number(offer.unit_price_minor)/100;
  if(hold && item.unitPrice!==price) fail('Цена изменилась. Обновите расчёт и подтвердите заказ снова.',409);
  if(hold) await client.query('UPDATE app_order_offers SET reserved_quantity=reserved_quantity+$4 WHERE organization_id=$1 AND branch_id=$2 AND product_id=$3',[context.organizationId,branchId,item.productId,item.quantity]);
  items.push({...item,productName:offer.product_name as string,unitPrice:price,unitPriceLabel:price===null?'Уточняется менеджером':null});
 }
 return {...payload,storeId:branch.id as string,storeName:branch.name as string,storeAddress:branch.address as string,items};
}
export function trustedTotal(items: NewOrder['items']) {
 if(items.some(i=>i.unitPrice===null)) return null;
 const minor=items.reduce((sum,i)=>sum+BigInt(Math.round(i.unitPrice!*100))*BigInt(i.quantity),0n);
 return `${minor/100n}.${String(minor%100n).padStart(2,'0')}`;
}
