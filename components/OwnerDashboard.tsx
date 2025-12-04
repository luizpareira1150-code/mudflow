import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Users, Calendar, AlertTriangle, 
  CheckCircle, Zap, Building2, Filter, 
  Bell, RefreshCw, Award, Target, DollarSign,
  ArrowUp, ArrowDown, Minus
} from 'lucide-react';
import { analyticsService } from '../services/mockSupabase';
import { User, ClientHealthMetrics, GlobalMetrics } from '../types';

interface OwnerDashboardProps {
  currentUser: User;
}

const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics | null>(null);
  const [clientsMetrics, setClientsMetrics] = useState<ClientHealthMetrics[]>([]);

  // Filtros Globais
  const [filterPeriod, setFilterPeriod] = useState<'7d' | '30d' | 'custom'>('30d');
  const [filterAccountType, setFilterAccountType] = useState<'all' | 'CONSULTORIO' | 'CLINICA'>('all');
  const [filterHealthStatus, setFilterHealthStatus] = useState<'all' | 'healthy' | 'attention' | 'risk'>('all');

  // Visão da tabela de clientes
  const [clientView, setClientView] = useState<'health' | 'weekly' | 'monthly'>('health');

  // Notificações
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const calculateMetrics = async () => {
    setLoading(true);
    
    try {
      const { global, clients } = await analyticsService.getOwnerDashboardMetrics();
      setGlobalMetrics(global);
      setClientsMetrics(clients);
      generateNotifications(clients);
      
    } catch (error) {
      console.error('Erro ao calcular métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNotifications = (metrics: ClientHealthMetrics[]) => {
    const notifs = [];
    
    const riskClients = metrics.filter(m => m.healthScore === 'risk');
    if (riskClients.length > 0) {
      notifs.push({
        type: 'critical',
        title: `${riskClients.length} cliente(s) em risco de churn`,
        time: 'agora',
        action: 'view_clients'
      });
    }
    
    const webhookIssues = metrics.filter(m => m.webhookStatus === 'warning');
    if (webhookIssues.length > 0) {
      notifs.push({
        type: 'warning',
        title: `${webhookIssues.length} webhook(s) com falhas`,
        time: 'há 2 horas',
        action: 'view_logs'
      });
    }
    
    setNotifications(notifs);
  };

  useEffect(() => {
    calculateMetrics();
    const interval = setInterval(calculateMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatRelativeDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas`;
    return `${Math.floor(diffDays / 30)} meses`;
  };

  const filteredClients = useMemo(() => {
    return clientsMetrics.filter(client => {
      if (filterAccountType !== 'all' && client.accountType !== filterAccountType) return false;
      if (filterHealthStatus !== 'all' && client.healthScore !== filterHealthStatus) return false;
      return true;
    });
  }, [clientsMetrics, filterAccountType, filterHealthStatus]);

  const alertsList = useMemo(() => {
    const alerts: any[] = [];
    
    // Clientes em risco
    const riskClients = clientsMetrics.filter(c => c.healthScore === 'risk');
    riskClients.forEach(client => {
      alerts.push({
        severity: 'critical',
        title: `${client.clientName}: Cliente em risco de churn`,
        description: `Sem uso há ${formatRelativeDate(client.lastUsed)} • Apenas ${client.appointmentsThisMonth} agendamentos este mês`,
        timestamp: 'Detectado há 2 horas',
        action: 'Contatar Cliente'
      });
    });
    
    // Webhooks com problemas
    const webhookIssues = clientsMetrics.filter(c => c.webhookStatus === 'warning' || c.webhookStatus === 'critical');
    webhookIssues.slice(0, 3).forEach(client => {
      alerts.push({
        severity: 'warning',
        title: `${client.clientName}: Webhook falhando`,
        description: 'Últimas 3 tentativas resultaram em erro 404 (N8N workflow deletado?)',
        timestamp: 'Última tentativa há 1 hora',
        action: 'Verificar N8N'
      });
    });
    
    // Automações desativadas
    const noAutomation = clientsMetrics.filter(c => !c.automationsActive);
    if (noAutomation.length > 0) {
      alerts.push({
        severity: 'info',
        title: `${noAutomation.length} cliente(s) sem automações ativas`,
        description: 'Eles podem não saber como configurar corretamente',
        timestamp: 'Verificado agora',
        action: 'Enviar Tutorial'
      });
    }
    
    return alerts.slice(0, 5); // Máximo 5 alertas
  }, [clientsMetrics]);

  const topClients = useMemo(() => {
    return [...clientsMetrics]
      .sort((a, b) => b.appointmentsThisMonth - a.appointmentsThisMonth)
      .slice(0, 5);
  }, [clientsMetrics]);

  const bottomClients = useMemo(() => {
    return [...clientsMetrics]
      .filter(c => c.healthScore === 'risk' || c.healthScore === 'attention')
      .sort((a, b) => a.appointmentsThisMonth - b.appointmentsThisMonth)
      .slice(0, 5);
  }, [clientsMetrics]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      {/* HEADER */}
      <header className="flex justify-between items-center mb-2">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">Visão Global (Owner)</h2>
            <p className="text-slate-500 mt-1">Gerencie a saúde de todas as clínicas no ecossistema.</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
             <span className="text-xs font-bold text-blue-600 px-2 py-1 bg-blue-50 rounded-md">ADMIN MASTER</span>
             <span className="text-sm text-slate-600">{currentUser.name}</span>
        </div>
      </header>

      {/* FILTROS GLOBAIS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filtros:</span>
            </div>
            
            <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="custom">Período customizado</option>
            </select>
            
            <select
            value={filterAccountType}
            onChange={(e) => setFilterAccountType(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
            <option value="all">Todos os tipos</option>
            <option value="CONSULTORIO">Só Consultórios</option>
            <option value="CLINICA">Só Clínicas</option>
            </select>
            
            <select
            value={filterHealthStatus}
            onChange={(e) => setFilterHealthStatus(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
            <option value="all">Todos os status</option>
            <option value="healthy">Saudáveis</option>
            <option value="attention">Requerem atenção</option>
            <option value="risk">Em risco</option>
            </select>
            
            <div className="ml-auto flex items-center gap-2">
            <button
                onClick={() => calculateMetrics()}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Atualizar dados"
            >
                <RefreshCw size={18} />
            </button>
            
            <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
                <Bell size={18} />
                {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
            </button>
            </div>
        </div>
      </div>

      {/* MÉTRICAS PRINCIPAIS (Cards no Topo) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Card 1: Clientes Ativos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
                <Building2 size={24} className="text-blue-600" />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                globalMetrics?.growthRate && globalMetrics.growthRate > 0 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
                {globalMetrics?.growthRate && globalMetrics.growthRate > 0 ? '+' : ''}{globalMetrics?.growthRate}%
            </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
            {globalMetrics?.activeClients || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Clientes Ativos</p>
            <p className="text-xs text-gray-400 mt-2">
            {globalMetrics?.totalClients} total • +2 este mês
            </p>
        </div>
        
        {/* Card 2: Agendamentos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
                <Calendar size={24} className="text-green-600" />
            </div>
            <TrendingUp size={18} className="text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
            {globalMetrics?.totalAppointmentsThisMonth.toLocaleString('pt-BR') || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Agendamentos/Mês</p>
            <p className="text-xs text-gray-400 mt-2">
            +23% vs mês anterior
            </p>
        </div>
        
        {/* Card 3: Automações */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-50 rounded-lg">
                <Zap size={24} className="text-purple-600" />
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                {globalMetrics?.automationSuccessRate}%
            </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
            {globalMetrics?.totalAutomationsSent.toLocaleString('pt-BR') || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Automações Enviadas</p>
            <p className="text-xs text-gray-400 mt-2">
            N8N + Evolution API
            </p>
        </div>
        
        {/* Card 4: MRR */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-orange-50 rounded-lg">
                <DollarSign size={24} className="text-orange-600" />
            </div>
            <ArrowUp size={18} className="text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
            R$ {globalMetrics?.mrr.toLocaleString('pt-BR') || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">MRR (Receita Recorrente)</p>
            <p className="text-xs text-gray-400 mt-2">
            +15% vs mês anterior
            </p>
        </div>
        </div>

      {/* VISÃO GERAL DOS CLIENTES */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
            <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Users size={20} className="text-blue-600" />
                Visão Geral dos Clientes
            </h3>
            <p className="text-sm text-gray-500 mt-1">
                {filteredClients.length} cliente(s) {filterHealthStatus !== 'all' && `• Filtro: ${filterHealthStatus}`}
            </p>
            </div>
            
            {/* Dropdown de Visualização */}
            <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Visualizar por:</span>
            <select
                value={clientView}
                onChange={(e) => setClientView(e.target.value as any)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
                <option value="health">Status de Saúde</option>
                <option value="weekly">Performance Semanal</option>
                <option value="monthly">Performance Mensal</option>
            </select>
            </div>
        </div>
        
        {/* Tabela com Scroll */}
        <div className="overflow-x-auto">
            <table className="w-full">
            <thead>
                <tr className="border-b border-gray-200">
                {clientView === 'health' && (
                    <>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Cliente</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Tipo</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Último Uso</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Agend/Mês</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase">Automações</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Ação</th>
                    </>
                )}
                
                {clientView === 'weekly' && (
                    <>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Cliente</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Tipo</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">📞 Contatos</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">📅 Agendados</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">✅ Compareceu</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">❌ Cancelou</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Taxa</th>
                    </>
                )}
                
                {clientView === 'monthly' && (
                    <>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Cliente</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Tipo</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">📞 Contatos</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">📅 Agendados</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">✅ Compareceu</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">❌ Cancelou</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Taxa</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">vs Mês Ant.</th>
                    </>
                )}
                </tr>
            </thead>
            
            <tbody>
                {filteredClients.map((client) => (
                <tr key={client.clientId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    {clientView === 'health' && (
                    <>
                        <td className="py-3 px-4">
                        <div>
                            <p className="font-semibold text-gray-900 text-sm">{client.clientName}</p>
                            <p className="text-xs text-gray-500">{client.clientId.substring(0, 12)}...</p>
                        </div>
                        </td>
                        <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                            client.accountType === 'CLINICA' 
                            ? 'bg-purple-50 text-purple-700' 
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                            {client.accountType}
                        </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                        {formatRelativeDate(client.lastUsed)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-bold text-gray-900">
                        {client.appointmentsThisMonth}
                        </td>
                        <td className="py-3 px-4 text-center">
                        {client.automationsActive ? (
                            <CheckCircle size={18} className="text-green-500 inline" />
                        ) : (
                            <AlertTriangle size={18} className="text-red-500 inline" />
                        )}
                        </td>
                        <td className="py-3 px-4 text-center">
                        {client.healthScore === 'healthy' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold bg-green-50 text-green-700 px-2 py-1 rounded-full">
                            🟢 Saudável
                            </span>
                        )}
                        {client.healthScore === 'attention' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full">
                            🟡 Atenção
                            </span>
                        )}
                        {client.healthScore === 'risk' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-50 text-red-700 px-2 py-1 rounded-full">
                            🔴 Risco
                            </span>
                        )}
                        </td>
                        <td className="py-3 px-4 text-right">
                        {client.healthScore !== 'healthy' && (
                            <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                            Contatar
                            </button>
                        )}
                        </td>
                    </>
                    )}
                    
                    {clientView === 'weekly' && (
                    <>
                        <td className="py-3 px-4">
                        <p className="font-semibold text-gray-900 text-sm">{client.clientName}</p>
                        </td>
                        <td className="py-3 px-4">
                        <span className="text-xs px-2 py-1 rounded-full font-bold bg-gray-100 text-gray-700">
                            {client.accountType}
                        </span>
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-700">{client.weeklyContacts}</td>
                        <td className="py-3 px-4 text-right text-sm font-bold text-blue-600">{client.weeklyScheduled}</td>
                        <td className="py-3 px-4 text-right text-sm text-green-600">{client.weeklyAttended}</td>
                        <td className="py-3 px-4 text-right text-sm text-red-600">{client.weeklyCancelled}</td>
                        <td className="py-3 px-4 text-right">
                        <span className="text-sm font-bold text-gray-900">
                            {client.weeklyScheduled > 0 ? ((client.weeklyAttended / client.weeklyScheduled) * 100).toFixed(1) : 0}%
                        </span>
                        </td>
                    </>
                    )}
                    
                    {clientView === 'monthly' && (
                    <>
                        <td className="py-3 px-4">
                        <p className="font-semibold text-gray-900 text-sm">{client.clientName}</p>
                        </td>
                        <td className="py-3 px-4">
                        <span className="text-xs px-2 py-1 rounded-full font-bold bg-gray-100 text-gray-700">
                            {client.accountType}
                        </span>
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-700">{client.monthlyContacts}</td>
                        <td className="py-3 px-4 text-right text-sm font-bold text-blue-600">{client.monthlyScheduled}</td>
                        <td className="py-3 px-4 text-right text-sm text-green-600">{client.monthlyAttended}</td>
                        <td className="py-3 px-4 text-right text-sm text-red-600">{client.monthlyCancelled}</td>
                        <td className="py-3 px-4 text-right">
                        <span className="text-sm font-bold text-gray-900">
                            {client.monthlyScheduled > 0 ? ((client.monthlyAttended / client.monthlyScheduled) * 100).toFixed(1) : 0}%
                        </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                            {client.growthVsLastMonth > 0 ? (
                            <>
                                <ArrowUp size={14} className="text-green-600" />
                                <span className="text-xs font-bold text-green-600">+{client.growthVsLastMonth}%</span>
                            </>
                            ) : client.growthVsLastMonth < 0 ? (
                            <>
                                <ArrowDown size={14} className="text-red-600" />
                                <span className="text-xs font-bold text-red-600">{client.growthVsLastMonth}%</span>
                            </>
                            ) : (
                            <>
                                <Minus size={14} className="text-gray-400" />
                                <span className="text-xs text-gray-500">0%</span>
                            </>
                            )}
                        </div>
                        </td>
                    </>
                    )}
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        
        {filteredClients.length === 0 && (
            <div className="text-center py-12 text-gray-400">
            <Users size={48} className="mx-auto mb-3 opacity-50" />
            <p>Nenhum cliente encontrado com os filtros aplicados.</p>
            </div>
        )}
        </div>

      {/* ALERTAS E PROBLEMAS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-600" />
            Alertas e Problemas
            </h3>
            <span className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-bold">
            {alertsList.length} REQUEREM ATENÇÃO
            </span>
        </div>
        
        {alertsList.length === 0 ? (
            <div className="text-center py-12">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Tudo funcionando perfeitamente!</p>
            <p className="text-sm text-gray-400 mt-1">Nenhum alerta no momento.</p>
            </div>
        ) : (
            <div className="space-y-3">
            {alertsList.map((alert, idx) => (
                <div 
                key={idx}
                className={`p-4 rounded-lg border-l-4 ${
                    alert.severity === 'critical' ? 'bg-red-50 border-red-500' :
                    alert.severity === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                    'bg-blue-50 border-blue-500'
                }`}
                >
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        {alert.severity === 'critical' && <span className="text-lg">🔴</span>}
                        {alert.severity === 'warning' && <span className="text-lg">🟡</span>}
                        {alert.severity === 'info' && <span className="text-lg">🔵</span>}
                        <h4 className="font-bold text-gray-900 text-sm">{alert.title}</h4>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{alert.description}</p>
                    <p className="text-xs text-gray-500">{alert.timestamp}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                    <button className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 font-medium">
                        Ver Logs
                    </button>
                    <button className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                        {alert.action}
                    </button>
                    </div>
                </div>
                </div>
            ))}
            </div>
        )}
      </div>

      {/* RANKINGS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top 5 Clientes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Award size={20} className="text-yellow-600" />
            TOP 5 Clientes (Por Volume)
            </h3>
            
            <div className="space-y-3">
            {topClients.map((client, idx) => (
                <div key={client.clientId} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                    idx === 1 ? 'bg-gray-200 text-gray-700' :
                    idx === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-50 text-blue-600'
                }`}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                </div>
                
                <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{client.clientName}</p>
                    <p className="text-xs text-gray-500">
                    {client.appointmentsThisMonth} agendamentos/mês
                    </p>
                </div>
                
                <div className="text-right">
                    <div className="flex items-center gap-1 text-green-600">
                    <TrendingUp size={14} />
                    <span className="text-xs font-bold">+{client.growthVsLastMonth}%</span>
                    </div>
                </div>
                </div>
            ))}
            </div>
        </div>
        
        {/* Bottom 5 - Precisam de Atenção */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Target size={20} className="text-red-600" />
            Clientes que Precisam de Atenção
            </h3>
            
            <div className="space-y-3">
            {bottomClients.map((client, idx) => (
                <div key={client.clientId} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle size={16} className="text-red-600" />
                </div>
                
                <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{client.clientName}</p>
                    <p className="text-xs text-red-600">
                    {client.appointmentsThisMonth} agendamentos/mês ({client.growthVsLastMonth}%)
                    </p>
                </div>
                
                <button className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
                    Contatar
                </button>
                </div>
            ))}
            </div>
        </div>
        </div>
    </div>
  );
};

export default OwnerDashboard;