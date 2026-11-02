export interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  stock: number;
  categoryId?: string;
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
  quantity: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  staffId: string;
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
