import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { User } from '../types';
import { Bell, Check, Trash2, X, MessageSquare, AlertTriangle, Info, Calendar } from 'lucide-react';

interface NotificationCenterProps {
  user: User;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ user }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications(user);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getIcon = (type: string) => {
      switch(type) {
          case 'success': return <MessageSquare size={16} className="text-white" />;
          case 'error': return <X size={16} className="text-white" />;
          case 'warning': return <AlertTriangle size={16} className="text-white" />;
          case 'critical': return <Bell size={16} className="text-white" />;
          default: return <Info size={16} className="text-white" />;
      }
  };

  const getBgColor = (type: string) => {
      switch(type) {
          case 'success': return 'bg-green-500';
          case 'error': return 'bg-red-500';
          case 'warning': return 'bg-amber-500';
          case 'critical': return 'bg-red-600 animate-pulse';
          default: return 'bg-blue-500';
      }
  };

  const formatTime = (isoString: string) => {
      const date = new Date(isoString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffInSeconds < 60) return 'Agora';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m atrás`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h atrás`;
      return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group"
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-gray-700' : ''} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 md:bottom-auto md:top-full md:mt-2 md:left-auto md:right-0 w-[360px] max-w-[90vw] bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] animate-in slide-in-from-bottom-2 md:slide-in-from-top-2 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    Notificações
                    {unreadCount > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{unreadCount} novas</span>}
                </h3>
                <div className="flex gap-1">
                    {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium" title="Marcar todas como lidas">
                            <Check size={16} />
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button onClick={clearAll} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Limpar tudo">
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-gray-50/30">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <Bell size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Nenhuma notificação.</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <div 
                            key={notif.id} 
                            onClick={() => markAsRead(notif.id)}
                            className={`p-4 border-b border-gray-100 hover:bg-white transition-colors cursor-pointer relative group ${!notif.read ? 'bg-blue-50/40' : ''}`}
                        >
                            <div className="flex gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${getBgColor(notif.type)} shadow-sm`}>
                                    {getIcon(notif.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <h4 className={`text-sm font-semibold truncate ${!notif.read ? 'text-gray-900' : 'text-gray-700'}`}>
                                            {notif.title}
                                        </h4>
                                        <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                            {formatTime(notif.timestamp)}
                                        </span>
                                    </div>
                                    <p className={`text-xs ${!notif.read ? 'text-gray-800 font-medium' : 'text-gray-500'} line-clamp-2 leading-relaxed`}>
                                        {notif.message}
                                    </p>
                                    
                                    {notif.metadata?.appointmentId && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1 text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-600">
                                                <Calendar size={10} />
                                                Ver Agenda
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {!notif.read && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full group-hover:opacity-0 transition-opacity"></div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            <div className="p-2 border-t border-gray-100 bg-white text-center">
                 <button className="text-xs text-blue-600 font-medium hover:underline">Ver histórico completo</button>
            </div>
        </div>
      )}
    </div>
  );
};