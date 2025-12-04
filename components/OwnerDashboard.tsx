
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Users, Calendar, AlertTriangle, 
  CheckCircle, Zap, Building2, Filter, 
  Bell, RefreshCw, Award, Target, DollarSign,
  ArrowUp, ArrowDown, Minus, Activity, MessageSquare, Phone, ChevronDown
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

  // --- AUTOMATION PERIOD STATE ---
  const [automationPeriod, setAutomationPeriod] = useState<'7d' | '30d'>('7d');

  const automationStats = {
    '7d': {
        confirmations: { count: 423, rate: 95 },
        reminders: { count: 312, rate: 97 },
        recovery: { count: 89, rate: 43 },
        reviews: { count: 156, rate: 64 }
    },
    '30d': {
        confirmations: { count: 1845, rate: 96 },
        reminders: { count: 1320, rate: 98 },
        recovery: { count: 415, rate: 47 },
        reviews: { count: 680, rate: 65 }
    }
  };
  
  const currentAutoStats = automationStats[automationPeriod];

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

  // --- DADOS PARA GRÁFICOS ANALÍTICOS ---
  const monthlyGrowthData = [
    { label: 'Jul', value: 1200 },
    { label: 'Ago', value: 1350 },
    { label: 'Set', value: 1480 },
    { label: 'Out', value: 1620 },
    { label: 'Nov', value: 1750 },
    { label: 'Dez', value: 1847 }
  ];

  const consultorioCount = clientsMetrics.filter(c => c.accountType === 'CONSULTORIO').length;
  const clinicaCount = clientsMetrics.filter(c => c.accountType === 'CLINICA').length;
  const totalCount = clientsMetrics.length || 1;
  const consultorioPercentage = Math.round((consultorioCount / totalCount) * 100) || 0;
  const clinicaPercentage = Math.round((clinicaCount / totalCount) * 100) || 0;

  // --- ESTATÍSTICAS COMPARATIVAS ---
  const consultorioStats = useMemo(() => {
    const consultorioClients = clientsMetrics.filter(c => c.accountType === 'CONSULTORIO');
    if (consultorioClients.length === 0) return { avgMonthly: 0, noShowRate: 0, automationRate: 0, avgTicket: 0 };
    
    const avgMonthly = Math.round(
      consultorioClients.reduce((sum, c) => sum + c.monthlyScheduled, 0) / consultorioClients.length
    );
    const noShowRate = (
      consultorioClients.reduce((sum, c) => sum + c.noShowRate, 0) / consultorioClients.length
    ).toFixed(1);
    const automationRate = (
      (consultorioClients.filter(c => c.automationsActive).length / consultorioClients.length) * 100
    ).toFixed(1);
    
    return {
      avgMonthly,
      noShowRate,
      automationRate,
      avgTicket: 150 // Exemplo
    };
  }, [clientsMetrics]);

  const clinicaStats = useMemo(() => {
    const clinicaClients = clientsMetrics.filter(c => c.accountType === 'CLINICA');
    if (clinicaClients.length === 0) return { avgMonthly: 0, noShowRate: 0, automationRate: 0, avgTicket: 0 };
    
    const avgMonthly = Math.round(
      clinicaClients.reduce((sum, c) => sum + c.monthlyScheduled, 0) / clinicaClients.length
    );
    const noShowRate = (
      clinicaClients.reduce((sum, c) => sum + c.noShowRate, 0) / clinicaClients.length
    ).toFixed(1);
    const automationRate = (
      (clinicaClients.filter(c => c.automationsActive).length / clinicaClients.length) * 100
    ).toFixed(1);
    
    return {
      avgMonthly,
      noShowRate,
      automationRate,
      avgTicket: 400 // Exemplo
    };
  }, [clientsMetrics]);

  // --- DADOS PARA MAPA DE CALOR ---
  const last30Days = useMemo(() => {
    const days = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
      days.push({
        label: dayLabels[date.getDay()],
        fullDate: date.toLocaleDateString('pt-BR'),
        date: date
      });
    }
    
    return days;
  }, []);

  const getClientActivityForDay = (client: ClientHealthMetrics, date: Date): 'high' | 'medium' | 'low' | 'none' => {
    // Simular atividade de forma determinística baseada no nome e data
    const seed = client.clientName.charCodeAt(0) + date.getDate() + (client.healthScore === 'healthy' ? 5 : 0);
    
    if (client.healthScore === 'risk') {
      return (seed % 10) > 8 ? 'low' : 'none';
    }
    if (client.healthScore === 'attention') {
      const val = seed % 10;
      if (val > 7) return 'medium';
      if (val > 4) return 'low';
      return 'none';
    }
    // Healthy
    const val = seed % 10;
    if (val > 6) return 'high';
    if (val > 3) return 'medium';
    if (val > 1) return 'low';
    return 'none';
  };

  // --- TIMELINE EVENTS ---
  const timelineEvents = [
    { type: 'success', icon: <CheckCircle size={16} className="text-green-600" />, title: 'Clínica Saúde Total', description: 'Criou 8 novos agendamentos', time: '14:35' },
    { type: 'info', icon: <Calendar size={16} className="text-blue-600" />, title: 'Dr. Silva', description: 'Bloqueou agenda para feriado (25/Dez)', time: '14:32' },
    { type: 'error', icon: <AlertTriangle size={16} className="text-red-600" />, title: 'Clínica Vida', description: 'Webhook falhou (3x consecutivo)', time: '14:30' },
    { type: 'success', icon: <Users size={16} className="text-green-600" />, title: 'Dr. Santos', description: 'Fez login (1º em 30 dias)', time: '14:28' },
    { type: 'warning', icon: <MessageSquare size={16} className="text-yellow-600" />, title: 'Clínica Exemplo', description: 'Pediu suporte via email', time: '14:25' },
    { type: 'info', icon: <Zap size={16} className="text-blue-600" />, title: 'Dr. Costa', description: 'Mudou configurações de automação', time: '14:20' },
    { type: 'error', icon: <Phone size={16} className="text-red-600" />, title: 'Clínica Norte', description: 'Evolution API desconectada', time: '14:15' }
  ];

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
            
            <div className="relative">
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value as any)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 font-medium"
              >
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="custom">Período customizado</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
            
            <div className="relative">
              <select
                value={filterAccountType}
                onChange={(e) => setFilterAccountType(e.target.value as any)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 font-medium"
              >
                <option value="all">Todos os tipos</option>
                <option value="CONSULTORIO">Só Consultórios</option>
                <option value="CLINICA">Só Clínicas</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
            
            <div className="relative">
              <select
                value={filterHealthStatus}
                onChange={(e) => setFilterHealthStatus(e.target.value as any)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 font-medium"
              >
                <option value="all">Todos os status</option>
                <option value="healthy">Saudáveis</option>
                <option value="attention">Requerem atenção</option>
                <option value="risk">Em risco</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
            
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
            <div className="relative">
              <select
                value={clientView}
                onChange={(e) => setClientView(e.target.value as any)}
                className="appearance-none pl-4 pr-8 py-2 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
              >
                <option value="health">Status de Saúde</option>
                <option value="weekly">Performance Semanal</option>
                <option value="monthly">Performance Mensal</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
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

        {/* GRÁFICOS ANALÍTICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Gráfico 1: Crescimento de Agendamentos */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-green-600" />
                Crescimento Mensal
                </h4>
                
                <div className="space-y-2">
                {monthlyGrowthData.map((month, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12">{month.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div 
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-full flex items-center justify-end pr-2"
                        style={{ width: `${(month.value / 2000) * 100}%` }}
                        >
                        <span className="text-xs font-bold text-white">{month.value}</span>
                        </div>
                    </div>
                    </div>
                ))}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">Crescimento acumulado</p>
                <p className="text-2xl font-bold text-green-600">+23.4%</p>
                </div>
            </div>
            
            {/* Gráfico 2: Distribuição por Tipo */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Building2 size={18} className="text-purple-600" />
                Tipos de Conta
                </h4>
                
                <div className="flex items-center justify-center mb-4">
                <div className="relative w-40 h-40">
                    {/* Donut Chart Simulado */}
                    <svg viewBox="0 0 100 100" className="transform -rotate-90">
                    <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="20"
                    />
                    <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="20"
                        strokeDasharray={`${consultorioPercentage * 2.51} 251`}
                        strokeLinecap="round"
                    />
                    <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="20"
                        strokeDasharray={`${clinicaPercentage * 2.51} 251`}
                        strokeDashoffset={`-${consultorioPercentage * 2.51}`}
                        strokeLinecap="round"
                    />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">{clientsMetrics.length}</p>
                        <p className="text-xs text-gray-500">Total</p>
                    </div>
                    </div>
                </div>
                </div>
                
                <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <span className="text-sm text-gray-700">Consultório</span>
                    </div>
                    <span className="font-bold text-gray-900">{consultorioCount} ({consultorioPercentage}%)</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-gray-700">Clínica</span>
                    </div>
                    <span className="font-bold text-gray-900">{clinicaCount} ({clinicaPercentage}%)</span>
                </div>
                </div>
            </div>
            
            {/* Gráfico 3: Taxa de Automação */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                    <Zap size={18} className="text-yellow-600" />
                    Automações
                  </h4>
                  <div className="relative">
                    <select
                        value={automationPeriod}
                        onChange={(e) => setAutomationPeriod(e.target.value as '7d' | '30d')}
                        className="appearance-none pl-2 pr-6 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-yellow-500/20 cursor-pointer"
                    >
                        <option value="7d">7 dias</option>
                        <option value="30d">30 dias</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                
                <div className="space-y-4">
                <div>
                    <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">Confirmações</span>
                    <span className="text-xs font-bold text-gray-900">{currentAutoStats.confirmations.count}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: `${currentAutoStats.confirmations.rate}%` }}></div>
                    </div>
                    <span className="text-xs text-green-600 font-medium">{currentAutoStats.confirmations.rate}% entregue</span>
                </div>
                
                <div>
                    <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">Lembretes 24h</span>
                    <span className="text-xs font-bold text-gray-900">{currentAutoStats.reminders.count}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${currentAutoStats.reminders.rate}%` }}></div>
                    </div>
                    <span className="text-xs text-blue-600 font-medium">{currentAutoStats.reminders.rate}% entregue</span>
                </div>
                
                <div>
                    <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">Recuperação</span>
                    <span className="text-xs font-bold text-gray-900">{currentAutoStats.recovery.count}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-orange-500 h-full" style={{ width: `${currentAutoStats.recovery.rate}%` }}></div>
                    </div>
                    <span className="text-xs text-orange-600 font-medium">{currentAutoStats.recovery.rate}% reagendou</span>
                </div>
                
                <div>
                    <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">Reviews</span>
                    <span className="text-xs font-bold text-gray-900">{currentAutoStats.reviews.count}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-purple-500 h-full" style={{ width: `${currentAutoStats.reviews.rate}%` }}></div>
                    </div>
                    <span className="text-xs text-purple-600 font-medium">{currentAutoStats.reviews.rate}% respondeu</span>
                </div>
                </div>
            </div>
        </div>

        {/* MAPA DE CALOR */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Activity size={20} className="text-blue-600" />
                Mapa de Calor - Atividade (Últimos 30 dias)
            </h3>
            
            <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                {/* Header com dias */}
                <div className="flex gap-1 mb-2 ml-32">
                    {last30Days.map((day, idx) => (
                    <div key={idx} className="w-6 text-center">
                        <span className="text-xs text-gray-400">{day.label}</span>
                    </div>
                    ))}
                </div>
                
                {/* Linhas de clientes */}
                {clientsMetrics.slice(0, 8).map((client) => (
                    <div key={client.clientId} className="flex items-center gap-1 mb-1">
                    <div className="w-32 truncate text-xs text-gray-700 font-medium">
                        {client.clientName}
                    </div>
                    {last30Days.map((day, idx) => {
                        const activity = getClientActivityForDay(client, day.date);
                        return (
                        <div
                            key={idx}
                            className={`w-6 h-6 rounded ${
                            activity === 'high' ? 'bg-green-500' :
                            activity === 'medium' ? 'bg-green-300' :
                            activity === 'low' ? 'bg-green-100' :
                            'bg-gray-100'
                            }`}
                            title={`${client.clientName} - ${day.fullDate}: ${activity}`}
                        />
                        );
                    })}
                    {client.healthScore === 'risk' && (
                        <span className="ml-2 text-xs text-red-600 font-bold">⚠️ Inativo</span>
                    )}
                    </div>
                ))}
                </div>
            </div>
            
            {/* Legenda */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                <span className="text-xs text-gray-500">Legenda:</span>
                <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-xs text-gray-600">Alta (5+ ações)</span>
                </div>
                <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-green-300"></div>
                <span className="text-xs text-gray-600">Média (2-4 ações)</span>
                </div>
                <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-green-100"></div>
                <span className="text-xs text-gray-600">Baixa (1 ação)</span>
                </div>
                <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-gray-100"></div>
                <span className="text-xs text-gray-600">Sem atividade</span>
                </div>
            </div>
        </div>

      {/* COMPARATIVO: CONSULTORIO vs CLINICA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* CONSULTORIO */}
        <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl shadow-sm border border-purple-100 p-6">
            <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                <Building2 size={20} />
                CONSULTÓRIO
            </h3>
            <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-bold">
                {consultorioCount} cliente(s)
            </span>
            </div>
            
            <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-purple-100">
                <span className="text-sm text-gray-700">Média agend/mês</span>
                <span className="text-lg font-bold text-purple-900">{consultorioStats.avgMonthly}</span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-purple-100">
                <span className="text-sm text-gray-700">Taxa "Não Veio"</span>
                <span className="text-lg font-bold text-purple-900">{consultorioStats.noShowRate}%</span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-purple-100">
                <span className="text-sm text-gray-700">Taxa Automação</span>
                <span className="text-lg font-bold text-green-600">{consultorioStats.automationRate}% ✅</span>
            </div>
            
            <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">Ticket Médio/Mês</span>
                <span className="text-lg font-bold text-purple-900">R$ {consultorioStats.avgTicket}</span>
            </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-purple-100 bg-purple-50 -mx-6 -mb-6 px-6 py-3 rounded-b-xl">
            <p className="text-xs text-purple-700">
                <strong>Perfil:</strong> Médicos individuais, operação simples, ticket menor mas volume consistente.
            </p>
            </div>
        </div>
        
        {/* CLINICA */}
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-sm border border-blue-100 p-6">
            <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                <Building2 size={20} />
                CLÍNICA
            </h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                {clinicaCount} cliente(s)
            </span>
            </div>
            
            <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-blue-100">
                <span className="text-sm text-gray-700">Média agend/mês</span>
                <span className="text-lg font-bold text-blue-900">{clinicaStats.avgMonthly}</span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-blue-100">
                <span className="text-sm text-gray-700">Taxa "Não Veio"</span>
                <span className="text-lg font-bold text-blue-900">{clinicaStats.noShowRate}% ✅</span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-blue-100">
                <span className="text-sm text-gray-700">Taxa Automação</span>
                <span className="text-lg font-bold text-green-600">{clinicaStats.automationRate}% ✅</span>
            </div>
            
            <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">Ticket Médio/Mês</span>
                <span className="text-lg font-bold text-blue-900">R$ {clinicaStats.avgTicket}</span>
            </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-blue-100 bg-blue-50 -mx-6 -mb-6 px-6 py-3 rounded-b-xl">
            <p className="text-xs text-blue-700">
                <strong>Perfil:</strong> Multi-médico, alto volume, melhor ROI. Foco estratégico para crescimento.
            </p>
            </div>
        </div>
      </div>

      {/* Insight comparativo */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-start gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
            <Target size={24} />
            </div>
            <div className="flex-1">
            <h4 className="font-bold text-lg mb-2">💡 Insight Estratégico</h4>
            <p className="text-white/90 text-sm leading-relaxed">
                CLINICAs têm {((clinicaStats.avgTicket / consultorioStats.avgTicket - 1) * 100).toFixed(0)}% maior ticket médio e 
                {' '}{((clinicaStats.avgMonthly / consultorioStats.avgMonthly - 1) * 100).toFixed(0)}% mais agendamentos. 
                <strong className="text-white"> Recomendação: Focar prospecção B2B em clínicas multi-médico para maximizar ROI.</strong>
            </p>
            </div>
        </div>
      </div>

      {/* TIMELINE DE EVENTOS CRÍTICOS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Activity size={20} className="text-blue-600" />
            Timeline de Eventos (Últimas 24h)
        </h3>
        
        <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
            {timelineEvents.map((event, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                event.type === 'success' ? 'bg-green-100' :
                event.type === 'error' ? 'bg-red-100' :
                event.type === 'warning' ? 'bg-yellow-100' :
                'bg-blue-100'
                }`}>
                {event.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{event.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
                </div>
                
                <span className="text-xs text-gray-400 whitespace-nowrap">{event.time}</span>
            </div>
            ))}
        </div>
      </div>

      {/* SAÚDE TÉCNICA DO SISTEMA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Activity size={20} className="text-green-600" />
            Saúde Técnica do Sistema
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Webhooks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Webhooks (24h)</span>
                <CheckCircle size={16} className="text-green-500" />
              </div>
              <div className="bg-gray-100 rounded-full h-3 overflow-hidden mb-2">
                <div className="bg-green-500 h-full" style={{ width: '98.5%' }}></div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">4.523 enviados</span>
                <span className="font-bold text-green-600">98.5%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">68 falhas registradas</p>
            </div>
            
            {/* Evolution API */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Evolution API</span>
                <CheckCircle size={16} className="text-green-500" />
              </div>
              <div className="bg-gray-100 rounded-full h-3 overflow-hidden mb-2">
                <div className="bg-green-500 h-full" style={{ width: '100%' }}></div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">15/15 instâncias</span>
                <span className="font-bold text-green-600">100%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Todas online</p>
            </div>
            
            {/* Tempo de Resposta */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Tempo Resposta</span>
                <CheckCircle size={16} className="text-green-500" />
              </div>
              <div className="bg-gray-100 rounded-full h-3 overflow-hidden mb-2">
                <div className="bg-green-500 h-full" style={{ width: '60%' }}></div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Meta: &lt;2s</span>
                <span className="font-bold text-green-600">1.2s</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Ótima performance</p>
            </div>
          </div>
          
          {clientsMetrics.filter(c => c.webhookStatus !== 'healthy').length > 0 && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  <strong>{clientsMetrics.filter(c => c.webhookStatus !== 'healthy').length} cliente(s)</strong> com problemas técnicos detectados.
                </p>
                <button className="ml-auto text-xs bg-yellow-600 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-700 font-medium">
                  Ver Detalhes
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default OwnerDashboard;
