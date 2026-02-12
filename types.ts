
export type OrderStatus = 'pending' | 'confirmed' | 'producing' | 'delivered' | 'received' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type TransactionType = 'in' | 'out' | 'adjust';

export interface Worker {
  id: number;
  name: string;
  wechat_nickname: string;
  phone: string;
  unit_price: number;
  address?: string; // 对应数据库的 address 字段
  status: string; // 数据库是 varchar
  specialty_type?: string; // 擅长的手绳类型：完整、主绳、线圈
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
  paid_amount?: number; // 数据库中已有此字段 (float8)
  bank_card?: string; // 支付渠道：雪雪卡、中信卡、翕翕卡
  created_at?: string;
}

export interface Transfer {
  id: number;
  worker_id: number;
  amount: number;
  transfer_date: string; // 数据库中是 timestamp，会自动转换
  payment_method: 'wechat' | 'alipay' | 'bank';
  screenshot_url?: string;
  wechat_remark?: string;
  verified: boolean;
  created_at?: string;
}

export interface OrderPayment {
  id: number;
  order_no: string;
  transfer_id: number;
  amount: number;
  created_at?: string;
}

export interface InventoryTransaction {
  id: number;
  transaction_date: string;
  transaction_type: TransactionType;
  quantity_change: number; // 对应数据库字段
  balance_quantity: number;
  related_order?: string; // 对应 order_no
  remarks?: string;
  item_type?: string; // 手绳类型：完整、主绳、线圈
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
  bank_card?: string; // 收款银行卡：雪雪卡、中信卡、翕翕卡
}

/**
 * 其他支出记录
 */
export interface ExpenseRecord {
  id: string;
  date: string;
  purpose: string; // 用途
  amount: number;
  quantity: number;
  bank_card?: string; // 支付银行卡：雪雪卡、中信卡、翕翕卡
}

export interface AppData {
  workers: Worker[];
  orders: Order[];
  transfers: Transfer[];
  inventory: InventoryTransaction[];
  incomes: IncomeRecord[]; // 新增：用于财务模块的收入流水
  expenses: ExpenseRecord[]; // 新增：其他支出记录
  settings: {
    material_cost_per_unit: number;
    sale_price_per_unit: number;
  };
}
