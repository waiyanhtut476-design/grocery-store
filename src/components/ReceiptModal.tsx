import React from 'react';
import { Printer, X, Receipt as ReceiptIcon, Award, UserCheck, Bluetooth, Loader2 } from 'lucide-react';
import { Sale, StoreSettings } from '../types';
import { useLanguage } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { printReceiptViaBluetooth, isBluetoothSupported } from '../lib/bluetoothPrinter';

interface ReceiptModalProps {
  sale: Sale | null;
  settings?: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiptModal({ sale, settings, isOpen, onClose }: ReceiptModalProps) {
  const { t } = useLanguage();

  if (!isOpen || !sale) return null;

  const [isPrintingBt, setIsPrintingBt] = React.useState(false);
  const [btSuccess, setBtSuccess] = React.useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleBluetoothPrint = async () => {
    if (!settings) return;
    setIsPrintingBt(true);
    try {
      await printReceiptViaBluetooth(sale, settings);
      setBtSuccess(true);
      setTimeout(() => setBtSuccess(false), 2500);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        alert(err.message || 'Bluetooth printer error. Make sure printer is turned on.');
      }
    } finally {
      setIsPrintingBt(false);
    }
  };

  const formattedDate = sale.createdAt?.toDate 
    ? sale.createdAt.toDate().toLocaleString() 
    : sale.createdAt instanceof Date 
    ? sale.createdAt.toLocaleString() 
    : new Date().toLocaleString();

  const currency = settings?.currencySymbol || '฿';
  const subtotal = sale.subtotal ?? sale.total;
  const discountAmount = sale.discountAmount ?? 0;
  
  const paymentMethodLabel = 
    sale.paymentMethod === 'qr' ? t('promptpay_qr') :
    sale.paymentMethod === 'card' ? t('card') :
    sale.paymentMethod === 'credit' ? t('on_credit') :
    t('cash');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm print:p-0 print:bg-white print:fixed print:inset-0">
        <style>
          {`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #thermal-receipt-container, #thermal-receipt-container * {
                visibility: visible !important;
              }
              #thermal-receipt-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 auto !important;
                padding: 10px !important;
                box-shadow: none !important;
                border: none !important;
                background: white !important;
                color: black !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}
        </style>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200"
        >
          {/* Modal Toolbar (hidden when printing) */}
          <div className="no-print p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <ReceiptIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{t('receipt')}</h3>
                <p className="text-[11px] text-slate-400 font-mono">#{sale.id.slice(0, 10)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isBluetoothSupported() && (
                <button
                  type="button"
                  onClick={handleBluetoothPrint}
                  disabled={isPrintingBt}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-100 active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Direct print to 58mm/80mm Bluetooth Thermal Printer"
                >
                  {isPrintingBt ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bluetooth className="w-4 h-4" />
                  )}
                  <span>{btSuccess ? 'Sent to Printer!' : 'Bluetooth Print'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100 active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{t('print_receipt')}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Thermal Slip Content */}
          <div className="overflow-y-auto p-4 sm:p-6 bg-slate-100/50 flex justify-center">
            <div 
              id="thermal-receipt-container"
              className="w-full max-w-[340px] bg-white p-5 rounded-2xl border border-slate-200 shadow-sm font-mono text-slate-800 text-xs leading-relaxed"
            >
              {/* Store Header */}
              {sale.status === 'voided' && (
                <div className="mb-3 py-1.5 px-3 bg-rose-100 text-rose-700 font-sans font-black text-center text-xs tracking-widest uppercase border border-rose-300 rounded-lg">
                  *** {t('voided')} ***
                  {sale.voidReason && (
                    <div className="text-[10px] font-normal normal-case mt-0.5 text-rose-600">
                      Reason: {sale.voidReason}
                    </div>
                  )}
                </div>
              )}
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h2 className="text-base font-black text-slate-900 tracking-tight font-sans uppercase">
                  {settings?.storeName || t('store_name')}
                </h2>
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                  {settings?.address || t('store_address')}
                </p>
                <p className="text-[10px] text-slate-400">
                  {settings?.phone || t('store_tel')}
                </p>
              </div>

              {/* Transaction Metadata */}
              <div className="py-2.5 text-[11px] space-y-1 border-b border-dashed border-slate-300 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('voucher_no')}:</span>
                  <span className="font-bold text-slate-800">#{sale.id.slice(0, 10).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('date_time')}:</span>
                  <span className="text-[10px] text-slate-700">{formattedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('cashier')}:</span>
                  <span>{sale.staffName || (sale.staffId ? sale.staffId.slice(0, 8) : 'Staff')}</span>
                </div>

                {/* Customer / Loyalty Info */}
                {sale.customerName && (
                  <div className="flex justify-between pt-1 border-t border-dotted border-slate-200 text-indigo-700 font-semibold">
                    <span>Member:</span>
                    <span>{sale.customerName}</span>
                  </div>
                )}
                {sale.pointsEarned && sale.pointsEarned > 0 ? (
                  <div className="flex justify-between text-amber-700 font-semibold text-[10px]">
                    <span>Points Earned:</span>
                    <span>+{sale.pointsEarned} pts</span>
                  </div>
                ) : null}
              </div>

              {/* Items List */}
              <div className="py-3 border-b border-dashed border-slate-300 space-y-2">
                <div className="flex justify-between font-bold text-[10px] text-slate-400 uppercase tracking-wider pb-1">
                  <span>{t('items')}</span>
                  <span>{t('total')}</span>
                </div>
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-[11px]">
                    <div className="flex-1 pr-2">
                      <p className="font-bold text-slate-800 font-sans leading-tight">{item.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {item.quantity} x {currency}{item.price.toLocaleString()}
                      </p>
                    </div>
                    <div className="font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {currency}{(item.quantity * item.price).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Subtotal, Discount, Tax & Totals */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>{t('subtotal')}:</span>
                  <span className="tabular-nums font-semibold">{currency}{subtotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>
                      {t('discount')}
                      {sale.discountType === 'percent' && ` (${sale.discountValue}%)`}:
                    </span>
                    <span className="tabular-nums">-{currency}{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                {settings?.taxEnabled && (
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>Includes VAT ({settings.taxRate}%):</span>
                    <span className="tabular-nums">
                      {currency}{Math.round((sale.total * settings.taxRate) / (100 + settings.taxRate)).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                  <span className="uppercase">{t('net_total')}:</span>
                  <span className="tabular-nums">{currency}{sale.total.toLocaleString()}</span>
                </div>
                {settings?.dualCurrencyEnabled && (
                  <div className="flex justify-between text-[11px] font-bold text-indigo-700 bg-indigo-50/70 px-2 py-1 rounded-md mt-1 font-sans">
                    <span>Equivalent ({settings.secondaryCurrencySymbol || 'Ks'}):</span>
                    <span className="tabular-nums font-mono font-black">
                      {Math.round(sale.total * (settings.exchangeRateMMK || 125)).toLocaleString()} {settings.secondaryCurrencySymbol || 'Ks'}
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px] text-slate-600">
                <div className="flex justify-between">
                  <span>{t('payment_method')}:</span>
                  <span className="font-bold text-slate-800">{paymentMethodLabel}</span>
                </div>
                {sale.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between">
                      <span>{t('cash_received')}:</span>
                      <span className="tabular-nums font-semibold">{currency}{(sale.cashReceived ?? sale.total).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>{t('change_due')}:</span>
                      <span className="tabular-nums">{currency}{(sale.changeDue ?? 0).toLocaleString()}</span>
                    </div>
                  </>
                )}
                {sale.paymentMethod === 'credit' && (
                  <div className="text-[10px] text-amber-700 font-bold text-right pt-0.5">
                    Added to customer credit balance
                  </div>
                )}
              </div>

              {/* Footer / Thank you */}
              <div className="pt-4 text-center space-y-1">
                <p className="font-bold text-slate-800 font-sans text-xs">
                  {settings?.receiptFooter || t('thank_you_visit')}
                </p>
                <p className="text-[9px] text-slate-400">Grocery Flow Cloud POS</p>
                <div className="pt-2 flex justify-center">
                  <div className="text-[8px] tracking-widest text-slate-300">*** THANK YOU ***</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Actions for Screen */}
          <div className="no-print p-4 border-t border-slate-100 bg-white flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              {t('close')}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-indigo-100 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>{t('print_receipt')}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
