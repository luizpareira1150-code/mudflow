import React from 'react';
import { AuditLog } from '../types';
import { X, Calendar, User, Activity, Database } from 'lucide-react';

interface LogDetailsModalProps {
  log: AuditLog;
  onClose: () => void;
}

export const LogDetailsModal: React.FC<LogDetailsModalProps> = ({ log, onClose }) => {
  
  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  const renderJSONDiff = (oldValues?: Record<string, any>, newValues?: Record<string, any>) => {
    if (!oldValues && !newValues) return null;
    
    return (
      <div className="space-y-4">
        {oldValues && (
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Valores Antigos</h4>
            <pre className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 overflow-x-auto">
              {JSON.stringify(oldValues, null, 2)}
            </pre>
          </div>
        )}
        
        {newValues && (
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Valores Novos</h4>
            <pre className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 overflow-x-auto">
              {JSON.stringify(newValues, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Detalhes do Log</h3>
            <p className="text-xs text-gray-500 mt-1">ID: {log.id}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-6">
          {/* Descrição */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-900 font-medium">{log.description}</p>
          </div>
          
          {/* Informações Principais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Calendar size={16} />
                <span className="text-xs font-bold uppercase">Data e Hora</span>
              </div>
              <p className="text-sm font-medium text-gray-900">{formatDate(log.timestamp)}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <User size={16} />
                <span className="text-xs font-bold uppercase">Usuário</span>
              </div>
              <p className="text-sm font-medium text-gray-900">
                {log.userName || 'Sistema Automático'}
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Activity size={16} />
                <span className="text-xs font-bold uppercase">Ação</span>
              </div>
              <p className="text-sm font-medium text-gray-900">{log.action}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Database size={16} />
                <span className="text-xs font-bold uppercase">Origem</span>
              </div>
              <p className="text-sm font-medium text-gray-900">{log.source}</p>
            </div>
          </div>
          
          {/* Entidade Afetada */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Entidade Afetada</h4>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm">
                <span className="font-bold text-gray-700">Tipo:</span> {log.entityType}
              </p>
              <p className="text-sm mt-1 font-mono text-gray-600">
                <span className="font-bold text-gray-700">ID:</span> {log.entityId}
              </p>
            </div>
          </div>
          
          {/* Mudanças (oldValues vs newValues) */}
          {(log.oldValues || log.newValues) && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Mudanças Realizadas</h4>
              {renderJSONDiff(log.oldValues, log.newValues)}
            </div>
          )}
          
          {/* Metadata Adicional */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Informações Adicionais</h4>
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};