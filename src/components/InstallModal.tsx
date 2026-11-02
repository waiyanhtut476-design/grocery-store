import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share, PlusSquare, Chrome, CheckCircle2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InstallModal({ isOpen, onClose }: InstallModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'mobile' | 'ios' | 'desktop'>('mobile');

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/30">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Add to Home Screen</h3>
                  <p className="text-xs text-indigo-100 opacity-90">Install GroceryFlow for instant one-tap access</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Native Install Button if available */}
            {deferredPrompt && !isInstalled && (
              <div className="p-4 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase">One-Click Install</h4>
                    <p className="text-[13px] text-slate-600">Install app directly to your device desktop or home screen</p>
                  </div>
                </div>
                <button
                  onClick={handleInstallClick}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Install Now
                </button>
              </div>
            )}

            {isInstalled && (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-emerald-950 uppercase">App Installed Successfully!</h4>
                  <p className="text-xs text-emerald-700">GroceryFlow is now installed on your device.</p>
                </div>
              </div>
            )}

            {/* Platform Selector Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setActiveTab('mobile')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'mobile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Android / Chrome
              </button>
              <button
                onClick={() => setActiveTab('ios')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'ios' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                iPhone / iPad (iOS)
              </button>
              <button
                onClick={() => setActiveTab('desktop')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'desktop' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Desktop / PC
              </button>
            </div>

            {/* Instructions */}
            <div className="space-y-4">
              {activeTab === 'mobile' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">1</span>
                    <p className="text-xs text-slate-700 leading-relaxed">Open Chrome browser menu by tapping the <strong className="text-slate-900">three dots (⋮)</strong> in the top right corner.</p>
                  </div>
                  <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">2</span>
                    <p className="text-xs text-slate-700 leading-relaxed">Select <strong className="text-slate-900">"Install app"</strong> or <strong className="text-slate-900">"Add to Home screen"</strong> from the menu options.</p>
                  </div>
                  <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">3</span>
                    <p className="text-xs text-slate-700 leading-relaxed">Confirm by tapping <strong className="text-slate-900">"Install"</strong>. The app icon will appear on your phone home screen!</p>
                  </div>
                </div>
              )}

              {activeTab === 'ios' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">1</span>
                    <p className="text-xs text-slate-700 leading-relaxed">Open this app in Safari browser on your iPhone or iPad.</p>
                  </div>
                  <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">2</span>
                    <p className="text-xs text-slate-700 leading-relaxed">Tap the <strong className="text-slate-900">Share button</strong> <Share className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600" /> at the bottom toolbar of Safari.</p>
                  </div>
                  <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">3</span>
                    <p className="text-xs text-slate-700 leading-relaxed">Scroll down and tap <strong className="text-slate-900">"Add to Home Screen"</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600" />.</p>
                  </div>
                  <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">4</span>
                    <p className="text-xs text-slate-700 leading-relaxed">Tap <strong className="text-slate-900">"Add"</strong> in the top right corner. Done!</p>
                  </div>
                </div>
              )}

              {activeTab === 'desktop' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">1</span>
                    <p className="text-xs text-slate-700 leading-relaxed">In Chrome or Edge browser, look at the right side of the address bar.</p>
                  </div>
                  <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">2</span>
                    <p className="text-xs text-slate-700 leading-relaxed">Click the <strong className="text-slate-900">Install icon (<Download className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600" />)</strong> inside the URL bar.</p>
                  </div>
                  <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">3</span>
                    <p className="text-xs text-slate-700 leading-relaxed">Click <strong className="text-slate-900">"Install"</strong> to launch GroceryFlow as a dedicated desktop app.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
              >
                Got It
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
