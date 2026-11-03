import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Delete, X, ShieldCheck } from 'lucide-react';

interface PinPadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPin: string;
  title?: string;
  subtitle?: string;
}

export function PinPadModal({
  isOpen,
  onClose,
  onSuccess,
  correctPin = '1234',
  title = 'Owner PIN Required',
  subtitle = 'Enter 4-digit Owner PIN to access restricted data'
}: PinPadModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);

      if (nextPin.length === 4) {
        if (nextPin === correctPin) {
          setTimeout(() => {
            onSuccess();
            setPin('');
            onClose();
          }, 200);
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 800);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl w-full max-w-xs shadow-2xl p-6 text-center border border-slate-100 flex flex-col items-center"
        >
          <div className="flex justify-between w-full items-center mb-2">
            <span className="w-8" />
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Lock className="w-6 h-6" />
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-base font-bold text-slate-900 mt-2">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-6">{subtitle}</p>

          {/* 4-dot PIN indicator */}
          <div className={`flex justify-center gap-4 mb-8 ${error ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  pin.length > i
                    ? error
                      ? 'bg-rose-500 scale-110'
                      : 'bg-indigo-600 scale-110'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-xs font-bold text-rose-500 -mt-5 mb-4">
              Incorrect PIN. Try again.
            </p>
          )}

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                className="h-14 rounded-2xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 font-bold text-xl text-slate-800 transition-all active:scale-90 flex items-center justify-center border border-slate-200/60 shadow-xs cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-500 transition-all active:scale-90 flex items-center justify-center border border-slate-200/60 cursor-pointer"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-14 rounded-2xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 font-bold text-xl text-slate-800 transition-all active:scale-90 flex items-center justify-center border border-slate-200/60 shadow-xs cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-14 rounded-2xl bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-all active:scale-90 flex items-center justify-center border border-slate-200/60 cursor-pointer"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
