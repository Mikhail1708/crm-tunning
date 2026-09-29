import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { RequestWithUser } from '../types';

const prisma = new PrismaClient();
const includeKit = {
  product: { include: { categories: { include: { category: true } } } },
  items: { orderBy: { sortOrder: 'asc' as const }, include: { component: true } },
};
const normalizeItems = (raw: unknown) => {
  if (!Array.isArray(raw) || !raw.length) return null;
  const seen = new Set<number>();
  const items: Array<{ componentProductId:number; quantity:number; sortOrder:number }> = [];
  for (let i=0;i<raw.length;i++) {
    const productId=Number((raw[i] as any)?.productId), quantity=Number((raw[i] as any)?.quantity);
    if (!Number.isSafeInteger(productId)||productId<=0||!Number.isSafeInteger(quantity)||quantity<=0||seen.has(productId)) return null;
    seen.add(productId); items.push({componentProductId:productId,quantity,sortOrder:i});
  }
  return items;
};
const calculated = (kit:any) => {
  const cost=kit.items.reduce((s:number,i:any)=>s+i.component.cost_price*i.quantity,0);
  const retail=kit.items.reduce((s:number,i:any)=>s+i.component.retail_price*i.quantity,0);
  // Комплект виртуальный: собственного складского остатка у него нет.
  return {...kit, product:{...kit.product,categoryIds:kit.product.categories?.map((c:any)=>c.categoryId)||[],cost_price:cost,retail_price:retail,stock:0}, items:kit.items.map((i:any)=>({...i,product:i.component}))};
};
export const getProductKits=async(_req:RequestWithUser,res:Response)=>{try{const rows=await prisma.productKit.findMany({include:includeKit,orderBy:{createdAt:'desc'}});res.json(rows.map(calculated));}catch(e){console.error(e);res.status(500).json({error:'Ошибка получения комплектов'});}};
export const getProductKitById=async(req:RequestWithUser,res:Response)=>{try{const id=Number(req.params.id);const row=await prisma.productKit.findUnique({where:{id},include:includeKit});if(!row){res.status(404).json({error:'Комплект не найден'});return;}res.json(calculated(row));}catch(e){res.status(500).json({error:'Ошибка получения комплекта'});}};
export const getProductKitByProductId=async(req:RequestWithUser,res:Response)=>{try{const productId=Number(req.params.productId);const row=await prisma.productKit.findUnique({where:{productId},include:includeKit});if(!row){res.status(404).json({error:'Комплект не найден'});return;}res.json(calculated(row));}catch(e){res.status(500).json({error:'Ошибка получения комплекта'});}};
async function validateComponents(tx:Prisma.TransactionClient,items:any[],kitProductId?:number){const ps=await tx.product.findMany({where:{id:{in:items.map(i=>i.componentProductId)}},select:{id:true,isKit:true}});if(ps.length!==items.length)throw new Error('Один или несколько товаров не найдены');if(ps.some(p=>p.isKit||p.id===kitProductId))throw new Error('Комплект нельзя добавлять внутрь другого комплекта');return ps;}
export const createProductKit=async(req:RequestWithUser,res:Response)=>{try{const name=String(req.body?.name||'').trim(),article=String(req.body?.article||'').trim(),description=String(req.body?.description||'').trim()||null,categoryId=Number(req.body?.categoryId),items=normalizeItems(req.body?.items);if(!name||!article||!Number.isSafeInteger(categoryId)||categoryId<=0||!items){res.status(400).json({error:'Заполните название, артикул, категорию и состав комплекта'});return;}const row=await prisma.$transaction(async tx=>{if(await tx.product.findFirst({where:{article}}))throw new Error('Артикул уже существует');await validateComponents(tx,items);const components=await tx.product.findMany({where:{id:{in:items.map(i=>i.componentProductId)}}});const by=new Map(components.map(p=>[p.id,p]));const cost=items.reduce((s,i)=>s+(by.get(i.componentProductId)?.cost_price||0)*i.quantity,0),retail=items.reduce((s,i)=>s+(by.get(i.componentProductId)?.retail_price||0)*i.quantity,0);const product=await tx.product.create({data:{name,article,description,isKit:true,cost_price:cost,retail_price:retail,stock:0,min_stock:0,categories:{create:{categoryId}}}});return tx.productKit.create({data:{productId:product.id,items:{create:items}},include:includeKit});});res.status(201).json(calculated(row));}catch(e:any){console.error(e);res.status(400).json({error:e?.message||'Ошибка создания комплекта'});}};
export const updateProductKit=async(req:RequestWithUser,res:Response)=>{try{const id=Number(req.params.id),name=String(req.body?.name||'').trim(),article=String(req.body?.article||'').trim(),description=String(req.body?.description||'').trim()||null,categoryId=Number(req.body?.categoryId),items=normalizeItems(req.body?.items);if(!name||!article||!Number.isSafeInteger(categoryId)||categoryId<=0||!items){res.status(400).json({error:'Заполните название, артикул, категорию и состав комплекта'});return;}const row=await prisma.$transaction(async tx=>{const existing=await tx.productKit.findUnique({where:{id}});if(!existing)throw new Error('Комплект не найден');if(await tx.product.findFirst({where:{article,id:{not:existing.productId}}}))throw new Error('Артикул уже существует');await validateComponents(tx,items,existing.productId);const components=await tx.product.findMany({where:{id:{in:items.map(i=>i.componentProductId)}}});const by=new Map(components.map(p=>[p.id,p]));const cost=items.reduce((s,i)=>s+(by.get(i.componentProductId)?.cost_price||0)*i.quantity,0),retail=items.reduce((s,i)=>s+(by.get(i.componentProductId)?.retail_price||0)*i.quantity,0);await tx.product.update({where:{id:existing.productId},data:{name,article,description,cost_price:cost,retail_price:retail,categories:{deleteMany:{},create:{categoryId}}}});await tx.productKitItem.deleteMany({where:{kitId:id}});return tx.productKit.update({where:{id},data:{items:{create:items}},include:includeKit});});res.json(calculated(row));}catch(e:any){console.error(e);res.status(400).json({error:e?.message||'Ошибка обновления комплекта'});}};
export const deleteProductKit=async(req:RequestWithUser,res:Response)=>{try{const id=Number(req.params.id);const kit=await prisma.productKit.findUnique({where:{id}});if(!kit){res.status(404).json({error:'Комплект не найден'});return;}await prisma.product.delete({where:{id:kit.productId}});res.json({message:'Комплект удалён'});}catch(e){console.error(e);res.status(500).json({error:'Не удалось удалить комплект. Возможно, товар уже используется в истории продаж.'});}};
