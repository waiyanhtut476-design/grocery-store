import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Promotion, SaleItem, Product } from '../types';

export function subscribePromotions(callback: (promotions: Promotion[]) => void) {
  const q = query(collection(db, 'promotions'));
  return onSnapshot(q, (snapshot) => {
    const list: Promotion[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() } as Promotion);
    });
    callback(list);
  }, (err) => {
    console.warn('Promotions subscription error:', err);
    handleFirestoreError(err, OperationType.LIST, 'promotions');
    callback([]);
  });
}

export async function createPromotion(promo: Omit<Promotion, 'id' | 'createdAt'>) {
  try {
    return await addDoc(collection(db, 'promotions'), {
      ...promo,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'promotions');
  }
}

export async function togglePromotionStatus(id: string, isActive: boolean) {
  try {
    return await updateDoc(doc(db, 'promotions', id), { isActive });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'promotions/' + id);
  }
}

export async function deletePromotion(id: string) {
  try {
    return await deleteDoc(doc(db, 'promotions', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'promotions/' + id);
  }
}

export interface AppliedPromoResult {
  promoId: string;
  promoTitle: string;
  discountAmount: number;
  description: string;
}

export function calculateCartPromotions(
  cart: SaleItem[],
  promotions: Promotion[],
  products: Product[]
): {
  totalPromoDiscount: number;
  appliedPromos: AppliedPromoResult[];
} {
  const activePromos = promotions.filter(p => p.isActive);
  if (activePromos.length === 0 || cart.length === 0) {
    return { totalPromoDiscount: 0, appliedPromos: [] };
  }

  const appliedPromos: AppliedPromoResult[] = [];
  let totalPromoDiscount = 0;

  for (const promo of activePromos) {
    if (promo.type === 'buy_x_get_y') {
      const buyQty = promo.buyQty || 2;
      const freeQty = promo.freeQty || 1;
      const threshold = buyQty + freeQty;

      // Check matching items in cart
      const matchingItems = cart.filter(item => {
        if (promo.targetProductId) return item.productId === promo.targetProductId;
        if (promo.targetCategory) {
          const prod = products.find(p => p.id === item.productId);
          return prod?.category?.trim().toLowerCase() === promo.targetCategory.trim().toLowerCase();
        }
        return false;
      });

      for (const item of matchingItems) {
        if (item.quantity >= threshold) {
          const sets = Math.floor(item.quantity / threshold);
          const discountForThis = sets * freeQty * item.price;
          if (discountForThis > 0) {
            totalPromoDiscount += discountForThis;
            appliedPromos.push({
              promoId: promo.id,
              promoTitle: promo.title,
              discountAmount: discountForThis,
              description: `${item.name}: Buy ${buyQty} Get ${freeQty} Free (-฿${discountForThis})`
            });
          }
        }
      }
    } else if (promo.type === 'bundle_price') {
      const bundleQty = promo.bundleQty || 3;
      const bundlePrice = promo.bundlePrice || 0;

      const matchingItems = cart.filter(item => {
        if (promo.targetProductId) return item.productId === promo.targetProductId;
        return false;
      });

      for (const item of matchingItems) {
        if (item.quantity >= bundleQty) {
          const bundles = Math.floor(item.quantity / bundleQty);
          const regularPriceForBundle = bundles * bundleQty * item.price;
          const discountedPriceForBundle = bundles * bundlePrice;
          const discountForThis = Math.max(0, regularPriceForBundle - discountedPriceForBundle);
          if (discountForThis > 0) {
            totalPromoDiscount += discountForThis;
            appliedPromos.push({
              promoId: promo.id,
              promoTitle: promo.title,
              discountAmount: discountForThis,
              description: `${item.name}: Bundle of ${bundleQty} for ฿${bundlePrice} (-฿${discountForThis})`
            });
          }
        }
      }
    } else if (promo.type === 'category_discount') {
      const percent = promo.discountPercent || 0;
      if (percent > 0 && promo.targetCategory) {
        const catTarget = promo.targetCategory.trim().toLowerCase();
        for (const item of cart) {
          const prod = products.find(p => p.id === item.productId);
          if (prod?.category?.trim().toLowerCase() === catTarget) {
            const itemSubtotal = item.price * item.quantity;
            const discountForThis = Math.round(itemSubtotal * (percent / 100));
            if (discountForThis > 0) {
              totalPromoDiscount += discountForThis;
              appliedPromos.push({
                promoId: promo.id,
                promoTitle: promo.title,
                discountAmount: discountForThis,
                description: `${item.name} (${promo.targetCategory}): ${percent}% off (-฿${discountForThis})`
              });
            }
          }
        }
      }
    }
  }

  return { totalPromoDiscount, appliedPromos };
}
