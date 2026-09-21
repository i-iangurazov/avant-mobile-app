import type {Product} from '../../types';
import {formatPrice} from '../formatters';

export function selectProductOption(product:Product, optionId?:string):Product {
  const options=product.purchaseOptions ?? [];
  if(!options.length) return product;
  const option=optionId?options.find(p=>p.id===optionId):options.length===1?options[0]:undefined;
  if(!option) throw new Error('Выберите вариант товара.');
  const name=`${product.name} · ${option.label}`;
  return {...product,id:option.id,parentProductId:product.id,name,sku:option.sku,price:option.price,
    priceLabel:formatPrice(option.price),price_label:formatPrice(option.price),purchaseOptions:[]};
}
