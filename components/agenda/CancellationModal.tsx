
import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { sanitizeInput } from '../../utils/sanitizer';

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  loading: boolean;
  isBlockedStatus: boolean;
}

export const CancellationModal: React.FC<CancellationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading,
  isBlockedStatus
}) => {
  const [reason, setReason] = useState('');

  // Reset reason when modal opens
  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  const handleConfirm = () => {
    const safeReason = sanitizeInput(reason);
    onConfirm(safeReason);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={24} className="text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
          {isBlockedStatus ? 'Confirmar Liberação' : 'Confirmar Cancelamento'}
        </h3>
        <p className="text-sm text-gray-500 text-center mb-4">
          {isBlockedStatus
            ? 'Tem certeza que deseja liberar este horário?'
            : 'Esta ação removerá o agendamento da lista.'}
        </p>

        {!isBlockedStatus && (
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
              Motivo do Cancelamento <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo..."
              className="w-full bg-white border border-red-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
              rows={3}
              autoFocus
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Voltar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (!isBlockedStatus && !reason.trim())}
            className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};
