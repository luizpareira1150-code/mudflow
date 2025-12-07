
import React, { useState, useEffect } from 'react';
import { User, AuditLog, AuditSource, AuditAction } from '../types';
import { systemLogService } from '../services/mockSupabase';
import { 
  Search, Filter, FileText, User as UserIcon, Calendar, 
  Clock, ChevronDown, Activity, Globe, Bot, Server, 
  MessageSquare, AlertTriangle, Download, AlertCircle, X
} from 'lucide-react';
import { LogDetailsModal } from './LogDetailsModal';
import { formatDateTimeBR } from '../utils/dateUtils';
import { DatePicker } from './DatePicker';

interface ActivityLogsProps {
  user: User;
}

export const ActivityLogs: React.FC<ActivityLogsProps> = ({ user }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalLogs: 0, todayCount: 0, errorCount: 0, mostActiveUser: null as any });
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Initialize with last 7 days by default
  const today = new Date().toISOString().split('T')[0];
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [filters, setFilters] = useState({
    searchTerm: '',
    action: '' as string,
    source: '' as string,
    startDate: lastWeek,
    endDate: today
  });

  // Server-side pagination emulation
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const offset = (currentPage - 1) * itemsPerPage;
        
        const [logsResponse, statsData] = await Promise.all([
            systemLogService.getLogs(user.clinicId, {
                ...filters,
                limit: itemsPerPage,
                offset
            }),
            systemLogService.getAuditStats(user.clinicId)
        ]);
        
        setLogs(logsResponse.logs);
        setTotalRecords(logsResponse.total);
        setStats(statsData);
      } catch (error) {
        console.error("Failed to load audit data", error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
        fetchLogs();
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [user.clinicId, filters, currentPage]); // Re-fetch on page change

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [filters]);

  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  const getSourceIcon = (source: AuditSource) => {
    switch (source) {
        case AuditSource.WEB_APP: return <Globe size={14} className="text-blue-500" />;
        case AuditSource.N8N_WEBHOOK: return <Bot size={14} className="text-purple-500" />;
        case AuditSource.WHATSAPP: return <MessageSquare size={14} className="text-green-500" />;
        case AuditSource.SYSTEM: return <Server size={14} className="text-slate-500" />;
        default: return <Activity size={14} className="text-gray-500" />;
    }
  };

  const getActionIcon = (action: string) => {
      if (action.includes('CREATED')) return <FileText size={18} />;
      if (action.includes('DELETED')) return <X size={18} />;
      if (action.includes('UPDATED')) return <Activity size={18} />;
      return <Activity size={18} />;
  }

  const getActionColor = (action: string) => {
      if (action.includes('CREATED')) return 'bg-green-50 text-green-700 border-green-100';
      if (action.includes('DELETED')) return 'bg-red-50 text-red-700 border-red-100';
      if (action.includes('UPDATED') || action.includes('CHANGED')) return 'bg-blue-50 text-blue-700 border-blue-100';
      return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  const getSourceBadge = (source: string) => {
      return (
        <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 uppercase tracking-wide border border-slate-200">
            {getSourceIcon(source as AuditSource)}
            {source === 'WEB_APP' ? 'WEB' : source === 'N8N_WEBHOOK' ? 'BOT' : source}
        </div>
      );
  }

  const exportLogs = () => {
      const headers = ['Data', 'Usuário', 'Origem', 'Ação', 'Descrição'];
      const rows = logs.map(log => 
          [log.timestamp, log.userName, log.source, log.action, log.description].join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logs.csv';
      a.click();
  };

  const clearFilters = () => {
      setFilters({
        searchTerm: '',
        action: '',
        source: '',
        startDate: lastWeek,
        endDate: today
      });
  };

  const hasActiveFilters = Object.values(filters).some(val => val !== '' && val !== lastWeek && val !== today);

  return (
    <div className="p-8 h-screen flex flex-col animate-in fade-in duration-500 bg-slate-50/50">
      
      <header className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
             <Activity className="text-blue-600" size={32} />
             Auditoria & Logs
          </h2>
          <p className="text-slate-500 mt-1">
             Histórico completo de segurança e operações (LGPD Compliance).
          </p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Total Eventos</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.totalLogs}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><FileText size={20} /></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Atividade Hoje</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.todayCount}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-green-600"><Calendar size={20} /></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Erros/Alertas</p>
                  <p className="text-2xl font-bold text-red-600">{stats.errorCount}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-red-600"><AlertTriangle size={20} /></div>
          </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-sm font-bold text-slate-700">
           <Filter size={18} className="text-blue-600" />
           Filtros Avançados
           {hasActiveFilters && (
               <button onClick={clearFilters} className="ml-auto text-xs text-red-500 hover:underline">
                   Limpar Filtros
               </button>
           )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Data Inicial</label>
            <DatePicker 
                value={filters.startDate}
                onChange={(date) => setFilters({...filters, startDate: date})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Data Final</label>
            <DatePicker 
                value={filters.endDate}
                onChange={(date) => setFilters({...filters, endDate: date})}
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Tipo de Ação</label>
            <div className="relative">
              <select 
                value={filters.action}
                onChange={(e) => setFilters({...filters, action: e.target.value as AuditAction})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
              >
                <option value="">Todas</option>
                <option value="CONTACT_CREATED">Contato Criado</option>
                <option value="APPOINTMENT_CREATED">Agendamento Criado</option>
                <option value="APPOINTMENT_UPDATED">Agendamento Atualizado</option>
                <option value="APPOINTMENT_DELETED">Agendamento Cancelado</option>
                <option value="STATUS_CHANGED">Mudança de Status</option>
                <option value="PATIENT_CREATED">Paciente Criado</option>
                <option value="PATIENT_UPDATED">Paciente Atualizado</option>
                <option value="USER_LOGIN">Login</option>
                <option value="USER_LOGOUT">Logout</option>
                <option value="SETTINGS_UPDATED">Configurações Alteradas</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Origem</label>
            <div className="relative">
              <select 
                value={filters.source}
                onChange={(e) => setFilters({...filters, source: e.target.value as AuditSource})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
              >
                <option value="">Todas</option>
                <option value="WEB_APP">Manual (Interface)</option>
                <option value="N8N_WEBHOOK">Automação (N8N)</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SYSTEM">Sistema</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              value={filters.searchTerm}
              onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
              placeholder="Buscar por descrição, usuário ou ID..."
              className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">
          Mostrando <strong>{logs.length}</strong> de <strong>{totalRecords}</strong> registros
        </p>
        <button 
          onClick={exportLogs}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400 text-sm">Carregando logs...</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-400">Nenhum log encontrado</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {logs.map((log) => (
                <div 
                  key={log.id}
                  onClick={() => {
                    setSelectedLog(log);
                    setIsDetailsOpen(true);
                  }}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${getActionColor(log.action)} border`}>
                      {getActionIcon(log.action)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                          {log.description}
                        </p>
                        {getSourceBadge(log.source)}
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatDateTimeBR(log.timestamp)}
                        </span>
                        {log.userName && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <UserIcon size={12} />
                              {log.userName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="border-t border-gray-200 p-4 flex items-center justify-between bg-gray-50">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
            >
              Anterior
            </button>
            
            <span className="text-sm text-gray-600">
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
            </span>
            
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
            >
              Próxima
            </button>
          </div>
        )}
      </div>

      {isDetailsOpen && selectedLog && (
        <LogDetailsModal 
          log={selectedLog}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
};
