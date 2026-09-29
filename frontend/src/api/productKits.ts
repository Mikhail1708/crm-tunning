import { api } from './client';
import { Product } from '../types';
export interface ProductKitItem { id:number; kitId:number; componentProductId:number; quantity:number; sortOrder:number; product:Product; }
export interface ProductKit { id:number; productId:number; product:Product; createdAt:string; updatedAt:string; items:ProductKitItem[]; }
export interface ProductKitPayload { name:string; article:string; categoryId:number; description?:string; items:Array<{productId:number;quantity:number}>; }
export const productKitsApi={
 getAll:()=>api.get<ProductKit[]>('/product-kits'), getById:(id:number)=>api.get<ProductKit>(`/product-kits/${id}`),
 getByProductId:(productId:number)=>api.get<ProductKit>(`/product-kits/product/${productId}`),
 create:(data:ProductKitPayload)=>api.post<ProductKit>('/product-kits',data), update:(id:number,data:ProductKitPayload)=>api.put<ProductKit>(`/product-kits/${id}`,data), delete:(id:number)=>api.delete(`/product-kits/${id}`)
};
