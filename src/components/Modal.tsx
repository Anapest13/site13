import React from 'react';
import { X, AlertCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  type?: 'info' | 'confirm' | 'error';
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  type = 'info',
  onConfirm,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена'
}: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="px-8 py-6 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB]">
              <div className="flex items-center gap-3">
                {type === 'confirm' && <HelpCircle className="w-5 h-5 text-blue-600" />}
                {type === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                <h2 className="text-xl font-bold">{title}</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[#E5E7EB] rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8">
              <div className="text-[#6B7280] mb-8">
                {children}
              </div>
              <div className="flex justify-end gap-3">
                {type !== 'info' && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 text-sm font-bold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl transition-all"
                  >
                    {cancelLabel}
                  </button>
                )}
                {type === 'confirm' && onConfirm && (
                  <button
                    type="button"
                    onClick={() => {
                      onConfirm();
                      onClose();
                    }}
                    className="px-6 py-2.5 bg-[#1A1A1A] text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all"
                  >
                    {confirmLabel}
                  </button>
                )}
                {type === 'error' && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all"
                  >
                    Закрыть
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
