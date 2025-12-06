
import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { User, Notification, UserRole } from '../types';
import { AlertTriangle, MessageSquare, X } from 'lucide-react';

interface HumanHandoverAlertProps {
  user: User;
}

export const HumanHandoverAlert: React.FC<HumanHandoverAlertProps> = ({ user }) => {
  const { notifications, markAsRead } = useNotifications(user);
  const [activeAlert, setActiveAlert] = useState<Notification | null>(null);
  
  // CORREÇÃO DE LOOP: Mantém registro dos IDs já vistos nesta sessão
  // Mesmo se o markAsRead falhar, não mostramos novamente.
  const dismissedAlerts = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Check for unread HIGH priority notifications related to Human Attendance
    if (user.role === UserRole.SECRETARY || user.role === UserRole.DOCTOR_ADMIN) {
        const critical = notifications.find(n => 
            !n.read && 
            n.priority === 'high' && 
            n.metadata?.triggerPopup === true &&
            !dismissedAlerts.current.has(n.id) // Ignora se já dispensado
        );
        
        if (critical) {
            setActiveAlert(critical);
        }
    }
  }, [notifications, user.role]);

  const handleDismiss = () => {
      if (activeAlert) {
          dismissedAlerts.current.add(activeAlert.id); // Marca localmente
          markAsRead(activeAlert.id); // Tenta marcar no backend
          setActiveAlert(null);
      }
  };

  const handleTakeAction = () => {
      if (activeAlert) {
          dismissedAlerts.current.add(activeAlert.id);
          markAsRead(activeAlert.id);
          setActiveAlert(null);
          
          // Opcional: Redirecionar para o CRM se necessário
          // navigate('/crm');
      }
  };

  if (!activeAlert) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border-t-8 border-purple-600 animate-in zoom-in-95 duration-300">
        
        {/* Header Alert */}
        <div className="bg-purple-50 p-6 text-center border-b border-purple-100 relative">
            <div className="mx-auto w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                <AlertTriangle size={40} className="text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-purple-900">Atenção Necessária!</h2>
            <p className="text-purple-700 font-medium mt-1">O Bot solicitou ajuda humana.</p>
            
            <button 
                onClick={handleDismiss}
                className="absolute top-4 right-4 text-purple-300 hover:text-purple-600 transition-colors"
            >
                <X size={24} />
            </button>
        </div>

        {/* Content */}
        <div className="p-8">
            <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-slate-600 text-sm font-bold uppercase mb-1">Motivo</p>
                <p className="text-xl font-bold text-slate-800">{activeAlert.message}</p>
                {activeAlert.metadata?.patientPhone && (
                    <p className="text-slate-500 mt-2 flex items-center gap-2">
                        <MessageSquare size={16} />
                        WhatsApp: {activeAlert.metadata.patientPhone}
                    </p>
                )}
            </div>

            <div className="space-y-3">
                <button 
                    onClick={handleTakeAction}
                    className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all flex items-center justify-center gap-2"
                >
                    <MessageSquare size={24} />
                    Assumir Atendimento Agora
                </button>
                <button 
                    onClick={handleDismiss}
                    className="w-full bg-white text-slate-500 py-3 rounded-xl font-medium hover:bg-slate-50 border border-slate-200 transition-all"
                >
                    Ver depois (Fechar Alerta)
                </button>
            </div>
        </div>
        
        <div className="bg-slate-50 p-3 text-center text-xs text-slate-400 border-t border-slate-100">
            Este alerta aparece quando o fluxo automático não consegue prosseguir.
        </div>
      </div>
    </div>
  );
};
