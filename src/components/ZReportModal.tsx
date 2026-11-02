import React from 'react';
import { Shift, StoreSettings } from '../types';
import { useLanguage } from '../lib/i18n';
import { Printer, X, ReceiptText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ZReportModalProps {
  shift: Shift | null;
  settings?: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
}

export function ZReportModal({ shift, settings, isOpen, onClose }: ZReportModalProps) {
  const { t } = useLanguage();

  if (!isOpen || !shift) return null;

  const handlePrint = () => {
    window.print();
  };

  const openedDateStr = shift.openedAt?.toDate 
    ? shift.openedAt.toDate().toLocaleString() 
    : new Date().toLocaleString();

  const closedDateStr = shift.closedAt?.toDate 
    ? shift.closedAt.toDate().toLocaleString() 
    : new Date().toLocaleString();

  const currency = settings?.currencySymbol || '฿';
  const cashDiff = shift.cashDifference ?? 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[320] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm print:p-0 print:bg-white print:fixed print:inset-0">
        <style>
          {`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #z-report-thermal-container, #z-report-thermal-container * {
                visibility: visible !important;
              }
              #z-report-thermal-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 auto !important;
                padding: 10px !important;
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
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200"
        >
          {/* Header */}
          <div className="no-print p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <ReceiptText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{t('shift_summary')}</h3>
                <p className="text-[11px] text-slate-400 font-mono">#{shift.id.slice(0, 10)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100 active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>{t('print_z_report')}</span>
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
              id="z-report-thermal-container"
              className="w-full max-w-[340px] bg-white p-5 rounded-2xl border border-slate-200 shadow-sm font-mono text-slate-800 text-xs leading-relaxed"
            >
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h2 className="text-base font-black text-slate-900 tracking-tight font-sans uppercase">
                  {settings?.storeName || 'Grocery Flow Mart'}
                </h2>
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">{settings?.address || 'Main Branch'}</p>
                <p className="text-[10px] text-slate-400 font-sans">{settings?.phone || '02-123-4567'}</p>
                <div className="mt-2 py-1 bg-slate-100 rounded text-center font-bold text-[11px] text-slate-900 font-sans tracking-wide">
                  *** DAILY Z-REPORT ***
                </div>
              </div>

              {/* Shift info */}
              <div className="py-2.5 text-[11px] space-y-1 border-b border-dashed border-slate-300 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Shift ID:</span>
                  <span className="font-bold text-slate-800">#{shift.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Opened By:</span>
                  <span>{shift.openedByName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Start Time:</span>
                  <span className="text-[10px] text-slate-700">{openedDateStr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Close Time:</span>
                  <span className="text-[10px] text-slate-700">{closedDateStr}</span>
                </div>
              </div>

              {/* Sales Breakdown by Payment Method */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="font-bold text-[10px] text-slate-400 uppercase tracking-wider pb-1">
                  Sales Breakdown
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Cash Sales:</span>
                  <span className="tabular-nums font-semibold">{currency}{(shift.totalCashSales || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>PromptPay / QR:</span>
                  <span className="tabular-nums font-semibold">{currency}{(shift.totalQrSales || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Credit/Debit Card:</span>
                  <span className="tabular-nums font-semibold">{currency}{(shift.totalCardSales || 0).toLocaleString()}</span>
                </div>
                {(shift.totalCreditSales || 0) > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>On Customer Credit:</span>
                    <span className="tabular-nums font-semibold">{currency}{(shift.totalCreditSales || 0).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-black text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>TOTAL SALES:</span>
                  <span className="tabular-nums">{currency}{(shift.totalSales || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Cash Drawer Balance & Reconciliation */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="font-bold text-[10px] text-slate-400 uppercase tracking-wider pb-1">
                  Drawer Reconciliation
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Opening Cash Float:</span>
                  <span className="tabular-nums">{currency}{(shift.openingCash || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cash Collected:</span>
                  <span className="tabular-nums">{currency}{(shift.totalCashSales || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-800 font-bold pt-1 border-t border-slate-100">
                  <span>Expected Drawer Cash:</span>
                  <span className="tabular-nums">{currency}{(shift.expectedCash || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold">
                  <span>Actual Cash Counted:</span>
                  <span className="tabular-nums">{currency}{(shift.actualCash || 0).toLocaleString()}</span>
                </div>
                <div className={`flex justify-between text-xs font-black pt-1 ${
                  cashDiff === 0 ? 'text-emerald-700' : cashDiff > 0 ? 'text-indigo-700' : 'text-rose-600'
                }`}>
                  <span>DIFFERENCE ({cashDiff > 0 ? 'OVER' : cashDiff < 0 ? 'SHORT' : 'BALANCED'}):</span>
                  <span className="tabular-nums">
                    {cashDiff > 0 ? `+${currency}${cashDiff.toLocaleString()}` : `${currency}${cashDiff.toLocaleString()}`}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 text-center space-y-1 font-sans">
                <p className="text-[10px] text-slate-400">Report verified and closed</p>
                <div className="pt-2 text-[9px] text-slate-300 font-mono tracking-widest">
                  --- END OF REPORT ---
                </div>
              </div>
            </div>
          </div>

          <div className="no-print p-4 border-t border-slate-100 bg-white flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              {t('close')}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-indigo-100 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>{t('print_z_report')}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
