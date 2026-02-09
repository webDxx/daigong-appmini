
import { createClient } from '@supabase/supabase-js';
import { AppData, Worker, Order, Transfer, InventoryTransaction, IncomeRecord } from './types';

const SUPABASE_URL = 'https://nckbudymjczjbrvhavxa.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ja2J1ZHltamN6amJydmhhdnhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTgwODIsImV4cCI6MjA4NTczNDA4Mn0.UHnc5j7uHrrtQggX4ro6P8p3RcM5nW_R9XBv_54chck';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 清洗数据对象，确保不发送无效的字段给 Supabase
 */
const cleanObject = (obj: any) => {
  const newObj = { ...obj };
  
  // 核心修复：如果是新记录，id 字段必须从对象中彻底移除
  if (newObj.id === undefined || newObj.id === null || newObj.id === '' || newObj.id === 0) {
    delete newObj.id;
  }
  
  // 移除数据库自动生成的字段
  delete newObj.created_at; // 时间戳由数据库自动生成
  
  // 转换数字类型
  if ('unit_price' in newObj) newObj.unit_price = Number(newObj.unit_price) || 0;
  if ('quantity' in newObj) newObj.quantity = Number(newObj.quantity) || 0;
  if ('amount' in newObj) newObj.amount = Number(newObj.amount) || 0;
  if ('quantity_change' in newObj) newObj.quantity_change = Number(newObj.quantity_change) || 0;
  if ('paid_amount' in newObj) newObj.paid_amount = Number(newObj.paid_amount) || 0;
  if ('total_amount' in newObj) newObj.total_amount = Number(newObj.total_amount) || 0;
  
  return newObj;
};

export const generateId = (prefix: string) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${date}${random}`;
};

export const loadDataFromServer = async (): Promise<AppData> => {
  try {
    const [
      { data: workers, error: wErr },
      { data: orders, error: oErr },
      { data: transfers, error: tErr },
      { data: inventory, error: iErr },
      { data: incomes, error: incErr }
    ] = await Promise.all([
      supabase.from('workers').select('*').order('id', { ascending: true }),
      supabase.from('orders').select('*, order_payments(amount)').order('order_date', { ascending: false }),
      supabase.from('transfers').select('*').order('transfer_date', { ascending: false }),
      supabase.from('inventory').select('*').order('id', { ascending: true }),
      supabase.from('incomes').select('*').order('date', { ascending: false })
    ]);

    if (wErr || oErr || tErr || iErr || incErr) {
      console.error("【数据库查询失败】", { wErr, oErr, tErr, iErr, incErr });
    }

    const processedOrders = (orders || []).map(o => ({
      ...o,
      // 如果数据库中有 paid_amount 字段则优先使用，否则从 order_payments 汇总
      paid_amount: o.paid_amount !== undefined ? o.paid_amount : (o.order_payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0)
    }));

    return {
      workers: workers || [],
      orders: processedOrders || [],
      transfers: transfers || [],
      inventory: inventory || [],
      incomes: incomes || [],
      settings: { material_cost_per_unit: 2.0, sale_price_per_unit: 15.0 }
    };
  } catch (e) {
    console.error("数据库加载异常:", e);
    return { workers: [], orders: [], transfers: [], inventory: [], incomes: [], settings: { material_cost_per_unit: 2, sale_price_per_unit: 15 } };
  }
};

export const db = {
  async upsertWorker(worker: Partial<Worker>) {
    const dataToSave = cleanObject(worker);
    console.group("💾 数据库操作: Upsert Worker");
    const result = await supabase.from('workers').upsert(dataToSave).select();
    console.groupEnd();
    return result;
  },

  async createOrder(order: Partial<Order>) {
    const dataToSave = cleanObject(order);
    if (!dataToSave.order_no) dataToSave.order_no = generateId('ORD');
    // 如果没有提供 total_amount，自动计算
    if (!dataToSave.total_amount) {
      dataToSave.total_amount = (dataToSave.quantity || 0) * (dataToSave.unit_price || 0);
    }
    console.group("💾 数据库操作: Create Order");
    const result = await supabase.from('orders').insert(dataToSave).select();
    console.groupEnd();
    return result;
  },

  async updateOrder(order: Partial<Order>) {
    const dataToSave = cleanObject(order);
    const order_no = dataToSave.order_no;
    // 移除不应直接通过 update 更新的关联列
    delete dataToSave.order_payments;
    // 如果没有提供 total_amount，自动计算
    if (!dataToSave.total_amount && dataToSave.quantity && dataToSave.unit_price) {
      dataToSave.total_amount = dataToSave.quantity * dataToSave.unit_price;
    }
    console.group("💾 数据库操作: Update Order");
    const result = await supabase.from('orders').update(dataToSave).eq('order_no', order_no).select();
    console.groupEnd();
    return result;
  },

  async updateOrderStatus(order_no: string, status: string, receive_date?: string) {
    const updateData: any = { order_status: status };
    if (receive_date) updateData.receive_date = receive_date;
    return await supabase.from('orders').update(updateData).eq('order_no', order_no).select();
  },

  async addInventoryRecord(record: Partial<InventoryTransaction>) {
    const dataToSave = cleanObject(record);
    return await supabase.from('inventory').insert(dataToSave).select();
  },

  async addIncomeRecord(income: Partial<IncomeRecord>) {
    const dataToSave = cleanObject(income);
    console.group("💾 数据库操作: Add Income Record");
    const result = await supabase.from('incomes').insert(dataToSave).select();
    console.groupEnd();
    return result;
  }
};

export const saveDataToServer = async (data: AppData) => true;
export const getStorageStatus = () => ({ usage: 0, limit: 100 });
