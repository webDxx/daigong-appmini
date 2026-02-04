
export type OrderStatus = 'pending' | 'confirmed' | 'producing' | 'delivered' | 'received' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type TransactionType = 'in' | 'out' | 'adjust';

export interface Worker {
  id: number;
  name: string;
  wechat_nickname: string;
  phone: string;
  unit_price: number;
  bank_account: string;
  alipay_account?: string;
  status: 'active' | 'inactive';
  notes?: string;
  created_at?: string;
}

export interface Order {
  order_no: string; // 对应数据库的主键
  worker_id: number;
  quantity: number;
  unit_price: number;
  total_amount: number; // 数据库自动计算，前端仅展示
  order_date: string;
  expected_delivery?: string;
  actual_delivery?: string;
  receive_date?: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  chat_record?: string;
  remarks?: string;
  // 辅助字段（非数据库直接字段，通常通过 Join 获取）
  paid_amount?: number; 
}

export interface Transfer {
  id: number;
  worker_id: number;
  amount: number;
  transfer_date: string;
  payment_method: 'wechat' | 'alipay' | 'bank';
  screenshot_url?: string;
  wechat_remark?: string;
  verified: boolean;
}

export interface OrderPayment {
  id: number;
  order_no: string;
  transfer_id: number;
  amount: number;
}

export interface InventoryTransaction {
  id: number;
  transaction_date: string;
  transaction_type: TransactionType;
  quantity_change: number; // 对应数据库字段
  balance_quantity: number;
  related_order?: string; // 对应 order_no
  remarks?: string;
  created_at?: string;
}

/**
 * 销售收入记录
 */
export interface IncomeRecord {
  id: string;
  date: string;
  platform: string;
  amount: number;
  quantity: number;
}

export interface AppData {
  workers: Worker[];
  orders: Order[];
  transfers: Transfer[];
  inventory: InventoryTransaction[];
  incomes: IncomeRecord[]; // 新增：用于财务模块的收入流水
  settings: {
    material_cost_per_unit: number;
    sale_price_per_unit: number;
  };
}
