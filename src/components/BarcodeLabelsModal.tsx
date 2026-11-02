import React, { useState } from 'react';
import { Product, StoreSettings } from '../types';
import { useLanguage } from '../lib/i18n';
import { Printer, X, Tag, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BarcodeLabelsModalProps {
  products: Product[];
  settings?: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
}

// Generate realistic SVG barcode lines from barcode string
function generateBarcodePattern(code: string) {
  // Deterministic pseudo-binary pattern based on string characters
  const bars: number[] = [2, 1, 1, 2]; // Start guard
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    bars.push((charCode % 3) + 1);
    bars.push(((charCode >> 1) % 2) + 1);
    bars.push(((charCode >> 2) % 3) + 1);
  }
  bars.push(2, 1, 1, 2); // Stop guard
  return bars;
}

function BarcodeSVG({ code }: { code: string }) {
  const bars = generateBarcodePattern(code);
  let totalWidth = 0;
  for (const b of bars) totalWidth += b * 2;

  let currentX = 0;
  return (
    <div className="flex flex-col items-center">
      <svg 
        viewBox={`0 0 ${totalWidth} 40`} 
        className="w-full h-9 max-h-10 text-slate-900"
        preserveAspectRatio="none"
      >
        {bars.map((w, idx) => {
          const isBar = idx % 2 === 0;
          const x = currentX;
          currentX += w * 2;
          if (!isBar) return null;
          return (
            <rect
              key={idx}
              x={x}
              y={0}
              width={w * 1.8}
              height={40}
              fill="currentColor"
            />
          );
        })}
      </svg>
      <span className="font-mono text-[10px] tracking-widest text-slate-700 font-bold mt-0.5">
        {code}
      </span>
    </div>
  );
}

export function BarcodeLabelsModal({ products, settings, isOpen, onClose }: BarcodeLabelsModalProps) {
  const { t } = useLanguage();
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => 
    products.slice(0, 8).map(p => p.id)
  );
  const [copiesPerItem, setCopiesPerItem] = useState<number>(4);

  if (!isOpen) return null;

  const handleToggleProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map(p => p.id));
    }
  };

  const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));

  // Flatten array with copies
  const labelsToPrint: Product[] = [];
  selectedProducts.forEach(product => {
    for (let i = 0; i < copiesPerItem; i++) {
      labelsToPrint.push(product);
    }
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm print:p-0 print:bg-white print:fixed print:inset-0">
        <style>
          {`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #barcode-printable-area, #barcode-printable-area * {
                visibility: visible !important;
              }
              #barcode-printable-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 10mm !important;
                background: white !important;
              }
              .barcode-label {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
                box-shadow: none !important;
                border: 1px solid #cbd5e1 !important;
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
          className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200"
        >
          {/* Header */}
          <div className="no-print p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">{t('barcode_labels')}</h3>
                <p className="text-xs text-slate-500">
                  {selectedProducts.length} items ({labelsToPrint.length} labels total)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={labelsToPrint.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100 active:scale-95 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{t('print_labels')}</span>
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

          {/* Config Controls (no-print) */}
          <div className="no-print p-4 bg-slate-100/60 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-indigo-600"
              >
                {selectedProductIds.length === products.length ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Select All ({products.length})</span>
              </button>

              <div className="h-4 w-[1px] bg-slate-300" />

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600">{t('label_quantity')}:</span>
                {[1, 2, 4, 8, 12].map(qty => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setCopiesPerItem(qty)}
                    className={`px-2 py-1 rounded-lg font-bold ${
                      copiesPerItem === qty 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {qty}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-slate-500 font-medium">
              Ready to print on standard A4 Sticker Sheet or 50x30mm Labels
            </div>
          </div>

          {/* Product Selector list (collapsed preview) & Labels Preview */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
            {/* Printable Labels Grid */}
            <div 
              id="barcode-printable-area"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3 print:gap-4"
            >
              {labelsToPrint.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="barcode-label bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between text-center min-h-[140px] break-inside-avoid"
                >
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider truncate mb-1">
                    {settings?.storeName || 'Grocery Flow'}
                  </div>

                  <div className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-tight">
                    {item.name}
                  </div>

                  <div className="my-1.5 px-2">
                    <BarcodeSVG code={item.barcode} />
                  </div>

                  <div className="flex items-baseline justify-between pt-1 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold">{item.category || item.unit || 'Item'}</span>
                    <span className="font-black text-sm sm:text-base text-slate-900 tabular-nums">
                      {settings?.currencySymbol || '฿'}{item.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}

              {labelsToPrint.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-400">
                  <Tag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold">No products selected for barcode printing.</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="no-print p-4 border-t border-slate-100 bg-white flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              {t('close')}
            </button>
            <button
              type="button"
              disabled={labelsToPrint.length === 0}
              onClick={handlePrint}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{t('print_labels')}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
