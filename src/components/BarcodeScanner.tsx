import React, { useState, useEffect, useRef, useId } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product } from '../types';
import { getCachedProducts } from '../lib/offlineCache';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [quickProducts, setQuickProducts] = useState<Product[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = useId().replace(/:/g, ''); // Generate unique ID for the reader element

  useEffect(() => {
    const cached = getCachedProducts();
    if (cached.length > 0) {
      setQuickProducts(cached.slice(0, 12));
    }
    
    // Pre-fetch cameras list
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        setCameras(devices.map(d => ({ id: d.id, label: d.label })));
        // Default to the last camera which is usually the back camera on most phones
        setSelectedCameraId(devices[devices.length - 1].id);
      }
    }).catch(err => console.error("Error fetching cameras:", err));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Failed to stop scanner on unmount:", err));
      }
    };
  }, []);

  const startScanner = async (cameraId?: string) => {
    try {
      const element = document.getElementById(readerId);
      if (!element) {
        console.error("Scanner element not found in DOM");
        return;
      }

      setIsInitializing(true);
      setError(null);

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerId);
      }

      // If we are already scanning, stop first
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      const targetCameraId = cameraId || selectedCameraId || { facingMode: "environment" };
      
      const config = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewHeight);
          const boxSize = Math.floor(minEdge * 0.7);
          return { width: boxSize, height: boxSize };
        },
        aspectRatio: 1.0,
      };

      await scannerRef.current.start(
        targetCameraId,
        config,
        (decodedText) => {
          onScan(decodedText);
          stopScanner();
        },
        () => {} // Ignore frame errors
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error("Scanner Start Error:", err);
      setError(err.message || "Could not access camera on mobile browser.");
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    if (isScanning) {
      startScanner(newId);
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

  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsInitializing(true);
      setError(null);
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerId);
      }
      const decodedText = await scannerRef.current.scanFile(file, true);
      onScan(decodedText);
      onClose();
    } catch (err: any) {
      console.error("Scan file error:", err);
      setError("Could not read barcode from photo. Please select from quick items below or enter code manually.");
    } finally {
      setIsInitializing(false);
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
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 leading-tight">Barcode Scanner</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Mobile & Desktop Mode</p>
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
        <div className="relative overflow-y-auto flex-1 min-h-0">
          {/* Scanner Viewport Container */}
          <div className="relative aspect-square bg-slate-900 overflow-hidden flex items-center justify-center">
            <div id={readerId} className="w-full h-full object-cover"></div>
            
            {/* Initial UI / Gesture required for Mobile */}
            {!isScanning && !isInitializing && !error && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900 p-6 text-center">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
                  <Camera className="w-8 h-8 text-indigo-400" />
                </div>
                <h4 className="text-white font-bold text-lg mb-1">Camera Scanner</h4>
                <p className="text-slate-400 text-xs mb-6 leading-relaxed px-4">
                  Tap below to start camera or snap a photo of the barcode instantly.
                </p>

                <div className="flex flex-col gap-3 w-full max-w-[220px]">
                  {cameras.length > 1 && (
                    <select 
                      value={selectedCameraId || ""}
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                      className="w-full bg-white/10 text-white text-[11px] font-bold px-4 py-2.5 rounded-xl border border-white/20 outline-none mb-1"
                    >
                      {cameras.map(cam => (
                        <option key={cam.id} value={cam.id} className="text-slate-900">{cam.label || `Camera ${cam.id.slice(0, 4)}`}</option>
                      ))}
                    </select>
                  )}

                  <button 
                    onClick={() => startScanner()}
                    className="w-full py-3.5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 text-xs uppercase tracking-wider"
                  >
                    Start Camera
                  </button>

                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    id="native-camera-capture-1" 
                    className="hidden" 
                    onChange={handleFileCapture} 
                  />
                  <label 
                    htmlFor="native-camera-capture-1"
                    className="w-full py-3.5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Snap Photo</span>
                  </label>
                </div>
              </div>
            )}

            {/* Custom Scanning Overlay */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none z-20">
                <div className="absolute inset-0 bg-black/40"></div>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[200px] border-2 border-white/40 rounded-2xl shadow-[0_0_0_999px_rgba(0,0,0,0.5)]">
                  <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl"></div>
                  <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl"></div>
                  <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl"></div>
                  <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-indigo-500 rounded-br-xl"></div>
                  
                  <motion.div 
                    animate={{ top: ["10%", "90%", "10%"] }}
                    transition={{ duration: 2.0, repeat: Infinity, ease: "linear" }}
                    className="absolute left-4 right-4 h-0.5 bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)] z-30"
                  />

                  <div className="absolute -bottom-12 left-0 right-0 text-center text-white text-[10px] font-bold uppercase tracking-widest opacity-80">
                    Align Barcode within Frame
                  </div>
                </div>
              </div>
            )}

            {/* Camera Switcher (Visible when scanning or initial) */}
            {isScanning && cameras.length > 1 && (
              <div className="absolute bottom-4 left-4 right-4 z-40 flex justify-center pointer-events-auto">
                <select 
                  value={selectedCameraId || ""}
                  onChange={handleCameraChange}
                  className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-4 py-2 rounded-full border border-white/20 outline-none max-w-[200px]"
                >
                  {cameras.map(cam => (
                    <option key={cam.id} value={cam.id}>{cam.label || `Camera ${cam.id.slice(0, 4)}`}</option>
                  ))}
                </select>
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
                  <p className="font-bold text-lg">Processing Camera...</p>
                </motion.div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center text-white p-6 text-center"
                >
                  <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-rose-500" />
                  </div>
                  <p className="font-bold text-lg mb-1 text-rose-50">Camera Note</p>
                  <p className="text-xs text-slate-300 mb-4 px-4 leading-relaxed">
                    {error}
                  </p>

                  <div className="flex flex-col gap-2.5 w-full max-w-[220px] mb-4">
                    {cameras.length > 1 && (
                      <select 
                        value={selectedCameraId || ""}
                        onChange={(e) => setSelectedCameraId(e.target.value)}
                        className="w-full bg-white/10 text-white text-[11px] font-bold px-4 py-2.5 rounded-xl border border-white/20 outline-none mb-1"
                      >
                        {cameras.map(cam => (
                          <option key={cam.id} value={cam.id} className="text-slate-900">{cam.label || `Camera ${cam.id.slice(0, 4)}`}</option>
                        ))}
                      </select>
                    )}

                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      id="native-camera-capture-2" 
                      className="hidden" 
                      onChange={handleFileCapture} 
                    />
                    <label 
                      htmlFor="native-camera-capture-2"
                      className="w-full py-3 bg-emerald-600 text-white font-black rounded-2xl shadow-md hover:bg-emerald-700 transition-all text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Snap Photo</span>
                    </label>

                    <button 
                      onClick={() => setError(null)} 
                      className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-2xl transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Select Barcode Items & Manual Entry */}
          <div className="p-4 sm:p-6 bg-white border-t border-slate-100 space-y-4 shrink-0">
            {quickProducts.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-400 mb-2 font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  Quick Tap Item Barcode
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                  {quickProducts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onScan(p.barcode || p.id);
                        onClose();
                      }}
                      className="p-2.5 bg-slate-50 hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-300 rounded-xl text-left transition-all active:scale-95 group"
                    >
                      <p className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600">{p.name}</p>
                      <p className="text-[10px] font-mono text-indigo-600 font-semibold">{p.barcode || 'No Barcode'}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-100">
              <p className="text-center text-[10px] text-slate-400 mb-2 font-black uppercase tracking-[0.2em]">Or enter code manually</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Barcode / SKU"
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-mono transition-all"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 disabled:opacity-30 transition-all active:scale-95 shadow-md shadow-indigo-100"
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
