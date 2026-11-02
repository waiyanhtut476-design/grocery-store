import { Product, Sale } from '../types';

const PRODUCTS_CACHE_KEY = 'grocery_flow_offline_products';
const PENDING_SALES_KEY = 'grocery_flow_pending_sales';

export function cacheProductsLocally(products: Product[]) {
  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
  } catch (err) {
    console.warn('Failed to cache products locally:', err);
  }
}

export function getCachedProducts(): Product[] {
  try {
    const cached = localStorage.getItem(PRODUCTS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (err) {
    console.warn('Failed to retrieve cached products:', err);
    return [];
  }
}

export function queueOfflineSale(sale: Omit<Sale, 'id' | 'createdAt'>) {
  try {
    const pending = getPendingSales();
    const newPending = [...pending, { ...sale, offlineAt: new Date().toISOString() }];
    localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(newPending));
  } catch (err) {
    console.warn('Failed to queue offline sale:', err);
  }
}

export function getPendingSales(): any[] {
  try {
    const cached = localStorage.getItem(PENDING_SALES_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (err) {
    console.warn('Failed to retrieve pending sales:', err);
    return [];
  }
}

export function clearPendingSales() {
  try {
    localStorage.removeItem(PENDING_SALES_KEY);
  } catch (err) {
    console.warn('Failed to clear pending sales:', err);
  }
}
