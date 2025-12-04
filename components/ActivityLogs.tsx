
import React, { useState, useEffect } from 'react';
import { User, AuditLog, AuditSource } from '../types';
import { systemLogService } from '../services/mockSupabase';
import { Search, Filter, RefreshCw, FileText, User as UserIcon, Calendar, Clock, ChevronDown, Activity, CalendarDays, Globe, Bot, Server, MessageSquare, Tag, Info } from 'lucide-react';

interface ActivityLogsProps {
  user: User;
}

export const ActivityLogs: React.FC<ActivityLogsProps> = ({ user }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterPeriod, setFilterPeriod] = useState('ALL_TIME');

  useEffect(() => {
    loadLogs();
  }, [user.clinicId]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await systemLogService.getLogs(user.clinicId);
      setLogs(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const checkDatePeriod = (dateStr: string, period: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    
    if (period === 'ALL_TIME') return true;
    
    if (period === '7D') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        return date >= sevenDaysAgo;
    }
    
    if (period === '30D') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        return date >= thirtyDaysAgo;
    }
    
    if (period === 'LAST_MONTH') {
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return date >= firstDayLastMonth && date <= lastDayLastMonth;
    }
    
    return true;
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entityName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterAction === 'ALL' || log.action === filterAction;
    
    const matchesPeriod = checkDatePeriod(log.timestamp, filterPeriod);
    
    return matchesSearch && matchesFilter && matchesPeriod;
  });

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return {
        day: date.toLocaleDateString('pt-BR'),
        time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getSourceIcon = (source: AuditSource) => {
    switch (source) {
        case AuditSource.WEB_APP:
            return <Globe size={14} className="text-blue-500" />;
        case AuditSource.N8N_WEBHOOK:
            return <Bot size={14} className="text-purple-500" />;
        case AuditSource.WHATSAPP:
            return <MessageSquare size={14} className="text-green-500" />;
        case AuditSource.SYSTEM:
            return <Server size={14} className="text-slate-500" />;
        default:
            return <Activity size={14} className="text-gray-500" />;
    }
  };

  const getSourceLabel = (source: AuditSource) => {
      switch (source) {
        case AuditSource.WEB_APP: return 'Web App';
        case AuditSource.N8N_WEBHOOK: return 'N8N (Auto)';
        case AuditSource.WHATSAPP: return 'WhatsApp';
        case AuditSource.SYSTEM: return 'Sistema';
        default: return 'Desconhecido';
      }
  };

  const formatValueDiff = (oldVal?: Record<string, any>, newVal?: Record<string, any>) => {
      if (!oldVal && !newVal) return null;
      
      const changes: string[] = [];
      const allKeys = new Set([...Object.keys(oldVal || {}), ...Object.keys(newVal || {})]);
      
      allKeys.forEach(key => {
          // Ignore internal fields
          if (['id', 'clinicId', 'organizationId', 'patientId', 'doctorId', 'slotId', 'createdAt', 'updatedAt'].includes(key)) return;
          
          const v1 = oldVal ? oldVal[key] : undefined;
          const v2 = newVal ? newVal[key] : undefined;
          
          // Simple loose equality check
          if (JSON.stringify(v1) !== JSON.stringify(v2)) {
             changes.push(key);
          }
      });
      
      // If no relevant changes found but payloads exist, show generic info
      if (changes.length === 0 && (oldVal || newVal)) {
         return (
             <div className="mt-1 text-xs text-slate-400 italic">
                 Dados atualizados (sem campos críticos)
             </div>
         );
      }

      return (
          <div className="mt-2 space-y-1">
             {changes.slice(0, 3).map(key => {
                 const v1 = oldVal ? oldVal[key] : undefined;
                 const v2 = newVal ? newVal[key] : undefined;
                 
                 const formatVal = (v: any) => {
                     if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
                     if (v === null || v === undefined) return 'Vazio';
                     return String(v);
                 };

                 return (
                    <div key={key} className="text-xs flex gap-2 items-center bg-slate-50 border border-slate-100 p-1.5 rounded w-fit max-w-full">
                        <span className="font-bold text-slate-500 uppercase text-[10px]">{key}</span>
                        
                        {v1 !== undefined && (
                            <>
                                <span className="text-red-500 line-through truncate max-w-[80px]" title={String(v1)}>
                                    {formatVal(v1)}
                                </span>
                                <span className="text-slate-300">→</span>
                            </>
                        )}
                        
                        {v2 !== undefined && (
                            <span className="text-green-600 font-medium truncate max-w-[100px]" title={String(v2)}>
                                {formatVal(v2)}
                            </span>
                        )}
                    </div>
                 );
             })}
             {changes.length > 3 && (
                 <span className="text-[10px] text-slate-400">e mais {changes.length - 3} campos...</span>
             )}
          </div>
      );
  };

  const renderMetadata = (metadata?: Record<string, any>) => {
      if (!metadata) return null;
      
      // Label mapping for better UX
      const labelMap: Record<string, string> = {
        createdVia: 'Via',
        reason: 'Motivo',
        count: 'Qtd',
        patientName: 'Paciente',
        doctorName: 'Dr.',
        cancelledBy: 'Cancelado por',
        date: 'Data',
        time: 'Hora',
        productionModeChanged: 'Modo Produção',
        settingType: 'Tipo',
        changedBy: 'Por',
        source: 'Origem',
        message: 'Msg',
        oldStatus: 'Antigo',
        newStatus: 'Novo',
        appointmentDate: 'Data Agend.',
        appointmentTime: 'Hora Agend.'
      };

      return (
          <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(metadata).map(([key, value]) => {
                  if (value === undefined || value === null) return null;
                  
                  let displayValue = String(value);
                  if (key === 'createdVia') displayValue = value === 'contact_flow' ? 'Fluxo CRM' : 'Reserva Direta';
                  if (typeof value === 'boolean') displayValue = value ? 'Sim' : 'Não';

                  // Highlight important metadata
                  const isImportant = ['reason', 'createdVia', 'source'].includes(key);
                  const bgClass = isImportant ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-100';

                  return (
                      <span key={key} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${bgClass}`}>
                          <span className="opacity-70 uppercase text-[9px]">{labelMap[key] || key}:</span>
                          <span className="truncate max-w-[150px]" title={String(value)}>{displayValue}</span>
                      </span>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="p-8 h-screen flex flex-col animate-in fade-in duration-500">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
             <Activity className="text-blue-600" size={32} />
             Auditoria Corporativa (Logs)
          </h2>
          <p className="text-slate-500 mt-1">
             Rastreabilidade completa de todas as ações para compliance e segurança.
          </p>
        </div>
        <button 
            onClick={loadLogs}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
        >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Atualizar
        </button>
      </header>

      {/* Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 flex flex-col lg:flex-row gap-4 items-center shadow-sm">
        <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por ator, entidade ou descrição..." 
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-700 placeholder-slate-400"
            />
        </div>
        
        <div className="flex gap-4 w-full lg:w-auto">
            {/* Period Filter */}
            <div className="relative flex-1 lg:min-w-[200px]">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <CalendarDays size={18} />
                </div>
                <select
                    value={filterPeriod}
                    onChange={e => setFilterPeriod(e.target.value)}
                    className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none text-sm cursor-pointer text-slate-700 font-medium"
                >
                    <option value="ALL_TIME">Todo o período</option>
                    <option value="7D">Últimos 7 dias</option>
                    <option value="30D">Últimos 30 dias</option>
                    <option value="LAST_MONTH">Mês passado</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Action Filter */}
            <div className="relative flex-1 lg:min-w-[200px]">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Filter size={18} />
                </div>
                <select
                    value={filterAction}
                    onChange={e => setFilterAction(e.target.value)}
                    className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none text-sm cursor-pointer text-slate-700 font-medium"
                >
                    <option value="ALL">Todas as Ações</option>
                    {uniqueActions.map((action: string) => (
                        <option key={action} value={action}>{action}</option>
                    ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                        <th className="px-6 py-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Data / Hora</th>
                        <th className="px-6 py-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Ator (Quem)</th>
                        <th className="px-6 py-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Origem</th>
                        <th className="px-6 py-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Ação</th>
                        <th className="px-6 py-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Detalhes (O que)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredLogs.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                <FileText size={48} className="mx-auto mb-3 opacity-20" />
                                <p className="font-medium">Nenhum registro de auditoria encontrado.</p>
                                <p className="text-sm">Tente alterar os filtros de busca ou período.</p>
                            </td>
                        </tr>
                    ) : (
                        filteredLogs.map((log) => {
                            const { day, time } = formatDate(log.timestamp);
                            return (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap align-top">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5 text-slate-700 font-medium text-sm">
                                                <Calendar size={14} className="text-slate-400" />
                                                {day}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-0.5">
                                                <Clock size={14} className="text-slate-400" />
                                                {time}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-slate-500 shrink-0 ${
                                                log.source === AuditSource.N8N_WEBHOOK ? 'bg-purple-100 text-purple-600' : 
                                                log.source === AuditSource.WHATSAPP ? 'bg-green-100 text-green-600' :
                                                'bg-slate-100'
                                            }`}>
                                                {log.source === AuditSource.N8N_WEBHOOK ? <Bot size={16} /> : 
                                                 log.source === AuditSource.WHATSAPP ? <MessageSquare size={16} /> :
                                                 <UserIcon size={16} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">{log.userName || 'Sistema'}</p>
                                                <p className="text-xs text-slate-400 truncate w-32" title={log.userId}>
                                                    ID: {(log.userId || '').substring(0,8)}...
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex items-center gap-1.5 border border-slate-200 bg-white rounded-md px-2 py-1 w-fit">
                                            {getSourceIcon(log.source)}
                                            <span className="text-xs font-medium text-slate-600">
                                                {getSourceLabel(log.source)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                                            ${log.action.includes('CREATED') ? 'bg-green-100 text-green-700' : 
                                              log.action.includes('DELETED') ? 'bg-red-100 text-red-700' :
                                              log.action.includes('UPDATED') || log.action.includes('CHANGED') ? 'bg-blue-100 text-blue-700' :
                                              'bg-slate-100 text-slate-600'}
                                        `}>
                                            {log.action.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div>
                                            <div className="flex items-center gap-1 text-sm font-bold text-slate-800">
                                                <span className="text-slate-400 font-normal text-xs uppercase mr-1">{log.entityType}:</span>
                                                {log.entityName || log.entityId}
                                            </div>
                                            <p className="text-sm text-slate-600 mt-0.5">{log.description}</p>
                                            
                                            {formatValueDiff(log.oldValues, log.newValues)}
                                            {renderMetadata(log.metadata)}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
        <div className="bg-slate-50 p-3 border-t border-slate-200 text-center text-xs text-slate-400 flex justify-between px-6">
            <span>Mostrando {filteredLogs.length} registros</span>
            <span>Período: {filterPeriod === 'ALL_TIME' ? 'Todo o período' : filterPeriod === '7D' ? 'Últimos 7 dias' : filterPeriod === '30D' ? 'Últimos 30 dias' : 'Mês Passado'}</span>
        </div>
      </div>
    </div>
  );
};
