import React, { useState, useEffect, useRef, useId } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = useId().replace(/:/g, ''); // Generate unique ID for the reader element

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Failed to stop scanner on unmount:", err));
      }
    };
  }, []);

  const startScanner = async () => {
    try {
      // Ensure the element exists in DOM before starting
      const element = document.getElementById(readerId);
      if (!element) {
        console.error("Scanner element not found in DOM");
        return;
      }

      setIsInitializing(true);
      setError(null);

      // Create new instance if not exists
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerId);
      }

      // Check for cameras
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        throw new Error("No cameras found on this device. Please ensure camera permissions are granted.");
      }
      
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          onScan(decodedText);
          stopScanner();
        },
        () => {} // Ignore frame errors
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error("Scanner Start Error:", err);
      setError(err.message || "Could not access camera.");
    } finally {
      setIsInitializing(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 leading-tight">Phone Scanner</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Rear Camera Mode</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Area */}
        <div className="relative">
          {/* Scanner Viewport Container */}
          <div className="relative aspect-square bg-slate-900 overflow-hidden flex items-center justify-center">
            {/* The actual element used by html5-qrcode */}
            <div id={readerId} className="w-full h-full object-cover"></div>
            
            {/* Initial UI / Gesture required for Mobile */}
            {!isScanning && !isInitializing && !error && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
                <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
                  <Camera className="w-10 h-10 text-indigo-400" />
                </div>
                <h4 className="text-white font-bold text-xl mb-2">Camera Access</h4>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed px-4">
                  Tap the button to activate your camera and scan barcodes.
                </p>
                <button 
                  onClick={startScanner}
                  className="w-full max-w-[200px] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Start Camera
                </button>
              </div>
            )}

            {/* Custom Scanning Overlay */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none z-20">
                <div className="absolute inset-0 bg-black/40"></div>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] border-2 border-white/40 rounded-2xl shadow-[0_0_0_999px_rgba(0,0,0,0.5)]">
                  <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl"></div>
                  <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl"></div>
                  <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl"></div>
                  <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-indigo-500 rounded-br-xl"></div>
                  
                  <motion.div 
                    animate={{ top: ["10%", "90%", "10%"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-4 right-4 h-0.5 bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)] z-30 opacity-70"
                  />
                </div>
              </div>
            )}

            {/* Loading/Error States */}
            <AnimatePresence>
              {isInitializing && (
                <motion.div 
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-40 bg-slate-900 flex flex-col items-center justify-center text-white p-8 text-center"
                >
                  <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                  <p className="font-bold text-lg">Activating Camera...</p>
                </motion.div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center text-white p-8 text-center"
                >
                  <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mb-6">
                    <AlertCircle className="w-10 h-10 text-rose-500" />
                  </div>
                  <p className="font-bold text-xl mb-2 text-rose-50">Access Denied</p>
                  <p className="text-xs text-slate-400 mb-8 px-6 leading-relaxed">
                    {error}
                  </p>
                  <div className="bg-white/5 rounded-2xl p-5 text-xs text-slate-300 space-y-4 text-left w-full border border-white/10 mb-8">
                    <p className="font-black text-indigo-400 uppercase tracking-widest text-[10px]">How to fix:</p>
                    <p className="flex gap-2">
                      <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center shrink-0">1</span>
                      <span>Copy <b>Shared App URL</b> from AI Studio.</span>
                    </p>
                    <p className="flex gap-2">
                      <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center shrink-0">2</span>
                      <span>Open in <b>Chrome/Safari</b> on your phone.</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => setError(null)} 
                    className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors px-4 py-2 border border-indigo-400/30 rounded-xl"
                  >
                    Try again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Manual Entry Fallback */}
          <div className="p-6 bg-white border-t border-slate-100">
            <form onSubmit={handleManualSubmit}>
              <p className="text-center text-[10px] text-slate-400 mb-4 font-black uppercase tracking-[0.2em]">Or enter code manually</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Barcode / SKU"
                  className="flex-1 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-mono transition-all"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="px-6 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 disabled:opacity-30 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
                >
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
