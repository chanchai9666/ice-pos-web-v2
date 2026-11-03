/**
 * TypeScript definitions mapping Swagger 2.0 API for ICE POS v2
 * Note: All monetary amounts are integers in Satang (1 Baht = 100 Satang).
 */

export interface User {
  id: string;
  username: string;
  full_name?: string;
  display_name?: string;
  role: "admin" | "cashier" | string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MeData {
  user: User;
}

export interface AuthDataResponse {
  data: {
    access_token: string;
    refresh_token?: string;
    user: User;
  };
  message?: string;
  success: boolean;
}

export interface PinLoginRequest {
  pin: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface Category {
  id: string;
  name: string;
  sort_order?: number;
  description?: string;
  color?: string;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCategoryRequest {
  name: string;
  sort_order?: number;
}

export interface UpdateCategoryRequest {
  name: string;
  sort_order?: number;
}

export interface Product {
  id: string;
  category_id: string;
  category?: Category;
  name: string;
  barcode?: string;
  code?: string;
  unit_price?: number; // Satang
  price?: number; // Satang
  cost_price?: number; // Satang
  unit?: string;
  image_url?: string;
  is_active?: boolean;
  stock_quantity?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreditAccount {
  id: string;
  customer_id: string;
  credit_limit: number; // Satang
  outstanding_balance: number; // Satang
  status: "OK" | "OVER_LIMIT" | "OVERDUE" | string;
  version?: number;
  updated_at?: string;
}

export interface CreditTransaction {
  id: string;
  account_id: string;
  customer_id: string;
  type: "SALE_CREDIT" | "PAYMENT" | "ADJUSTMENT" | "WRITE_OFF" | string;
  amount: number; // Satang (+ increase debt, - pay debt)
  balance_after: number; // Satang
  ref_type?: "SALE" | "PAYMENT" | string;
  ref_id?: string;
  payment_method?: string;
  note?: string;
  idempotency_key?: string;
  occurred_at: string;
  created_by?: string;
  created_at?: string;
}

export interface ARAgingItem {
  customer_id: string;
  customer_name: string;
  phone: string;
  credit_limit: number; // Satang
  outstanding_balance: number; // Satang
  current_due: number; // 0-30 days (Satang)
  due_30_to_60: number; // 31-60 days (Satang)
  due_60_to_90: number; // 61-90 days (Satang)
  over_90: number; // 90+ days (Satang)
  status: string;
}

export interface CreateCustomerRequest {
  name: string;
  phone?: string;
  email?: string;
  is_member?: boolean;
  initial_credit_limit?: number; // Satang
  credit_limit?: number; // Satang
}

export interface UpdateCustomerRequest {
  name: string;
  phone?: string;
  email?: string;
  is_member?: boolean;
}

export interface SetCreditLimitRequest {
  credit_limit: number; // Satang
}

export interface PayCreditRequest {
  amount: number; // Satang
  payment_method: string;
  note?: string;
  idempotency_key?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  is_member?: boolean;
  points?: number;
  credit_account?: CreditAccount;
  credit_limit?: number; // Satang (compatibility)
  current_balance?: number; // Satang (compatibility)
  created_at?: string;
  updated_at?: string;
}

export interface SaleItem {
  id?: string;
  product_id: string;
  product_name: string;
  product_code?: string;
  unit_price: number; // Satang
  cost_price?: number; // Satang
  qty: number;
  gross_total: number; // Satang
  line_discount?: number; // Satang
  net_total: number; // Satang
}

export interface CheckoutRequest {
  lines: SaleItem[];
  payment_method: "CASH" | "CREDIT";
  tendered_amount?: number; // Satang (for CASH)
  bill_discount?: number; // Satang
  customer_id?: string; // (for CREDIT)
}

export interface Sale {
  id: string;
  sale_no: string;
  cashier_id: string;
  cashier_name: string;
  customer_id?: string;
  customer_name?: string;
  payment_method: "CASH" | "CREDIT";
  subtotal: number; // Satang
  bill_discount: number; // Satang
  grand_total: number; // Satang
  tendered_amount: number; // Satang
  change_amount: number; // Satang
  credit_amount?: number; // Satang
  status: "COMPLETED" | "VOIDED" | string;
  lines: SaleItem[];
  occurred_at: string;
  created_at?: string;
  updated_at?: string;
  void_reason?: string;
  voided_at?: string;
}

export interface ReceiptItem {
  product_name: string;
  qty: number;
  unit_price: number; // Satang
  net_total: number; // Satang
}

export interface Receipt {
  receipt_no: string;
  sale_no: string;
  cashier_name: string;
  customer_name?: string;
  payment_method: "CASH" | "CREDIT";
  subtotal: number; // Satang
  discount: number; // Satang
  grand_total: number; // Satang
  tendered: number; // Satang
  change: number; // Satang
  items: ReceiptItem[];
  occurred_at: string;
  status: string;
}

export interface CheckoutData {
  sale: Sale;
  receipt: Receipt;
}

export interface CheckoutResponse {
  data: CheckoutData;
  message?: string;
  success: boolean;
}

export interface DailySalesSummary {
  date: string;
  total_sales: number; // Satang
  total_cost?: number; // Satang
  gross_profit?: number; // Satang
  total_cash_collected?: number; // Satang
  bill_count?: number;
  void_count?: number;
}

export interface BestSellerItem {
  product_id: string;
  product_name: string;
  product_code?: string;
  total_qty_sold: number;
  total_revenue: number; // Satang
}

export interface SyncChangesResponse {
  categories: Category[];
  products: Product[];
  server_time: string;
  since?: string;
}

export interface SyncBatchRequest {
  sales: Sale[];
}

export interface SyncBatchResponse {
  synced_sales: number;
  skipped_sales: number;
  failed_sales: number;
  errors?: string[];
}

export interface VoidSaleRequest {
  reason: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface CreateCashierRequest {
  username: string;
  password: string;
  pin: string;
  display_name: string;
}

export interface ResetPinRequest {
  new_pin: string;
}

export interface ProductInput {
  name: string;
  code: string;
  barcode?: string;
  price: number; // Satang
  cost_price?: number; // Satang
  category_id: string;
  image_url?: string;
  is_active?: boolean;
}

export interface ErrorResponse {
  code?: number;
  message: string;
  success?: boolean;
}
