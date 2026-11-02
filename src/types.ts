export interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock?: number;
  expiryDate?: string;
  categoryId?: string;
  unit?: string;
  category?: string;
  imageUrl?: string;
  description?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any;
}

export interface Category {
  id: string;
  name: string;
  createdAt: any;
}

export interface SaleItem {
  productId: string;
  name: string;
  price: number;
  costPrice: number;
  quantity: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  subtotal?: number;
  discountType?: 'none' | 'percent' | 'amount';
  discountValue?: number;
  discountAmount?: number;
  total: number;
  paymentMethod?: 'cash' | 'qr' | 'card' | 'credit';
  cashReceived?: number;
  changeDue?: number;
  staffId: string;
  staffName?: string;
  customerId?: string;
  customerName?: string;
  pointsEarned?: number;
  pointsRedeemed?: number;
  taxRate?: number;
  taxAmount?: number;
  shiftId?: string;
  status?: 'completed' | 'voided';
  voidReason?: string;
  voidedAt?: any;
  voidedBy?: string;
  createdAt: any;
}

export interface UserRole {
  uid: string;
  role: 'admin' | 'staff';
  email: string;
  updatedAt: any;
}

export interface Task {
  id: string;
  title: string;
  status: 'todo' | 'done';
  assignedTo?: string;
  dueDate?: any;
  createdAt: any;
}

export interface StoreSettings {
  storeName: string;
  address: string;
  phone: string;
  currencySymbol: string;
  taxEnabled: boolean;
  taxRate: number;
  receiptFooter: string;
  updatedAt?: any;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  points: number;
  creditBalance: number;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Shift {
  id: string;
  openedBy: string;
  openedByName: string;
  openingCash: number;
  openedAt: any;
  closedAt?: any;
  closedBy?: string;
  closedByName?: string;
  totalCashSales?: number;
  totalQrSales?: number;
  totalCardSales?: number;
  totalCreditSales?: number;
  totalSales?: number;
  expectedCash?: number;
  actualCash?: number;
  cashDifference?: number;
  status: 'open' | 'closed';
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  barcode?: string;
  quantity: number;
  costPrice: number;
  totalCost: number;
}

export interface PurchaseOrder {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  totalCost: number;
  notes?: string;
  receivedBy: string;
  receivedByName: string;
  createdAt: any;
}

export interface DamageRecord {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  costPrice: number;
  lossAmount: number;
  reason: 'expired' | 'damaged' | 'lost' | 'other';
  notes?: string;
  recordedBy: string;
  recordedByName: string;
  createdAt: any;
}
