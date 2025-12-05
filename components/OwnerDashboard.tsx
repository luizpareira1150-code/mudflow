
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Users, Calendar, AlertTriangle, 
  CheckCircle, Zap, Building2, Filter, 
  Bell, RefreshCw, Award, Target, DollarSign,
  ArrowUp, ArrowDown, Minus, Activity, MessageSquare, Phone, ChevronDown,
  BarChart3, ExternalLink, Download, UserPlus, Eye, Mail, Info, X
} from 'lucide-react';
import { analyticsService } from '../services/mockSupabase';
import { User, ClientHealthMetrics, GlobalMetrics, OwnerAlert } from '../types';

export const OwnerDashboard: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics | null>(null);
  const [clientsMetrics, setClientsMetrics] = useState<ClientHealthMetrics[]>([]);
  const [alerts, setAlerts] = useState<OwnerAlert[]>([]);
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Filtros Globais
  const [filterPeriod, setFilterPeriod] = useState<'7d' | '30d' | 'custom'>('30d');
  const [filterAccountType, setFilterAccountType] = useState<'all' | 'CONSULTORIO' | 'CLINICA'>('all');
  const [filterHealthStatus, setFilterHealthStatus] = useState<'all' | 'healthy' | 'attention' | 'risk'>('all');

  // Visão da tabela de clientes
  const [clientView, setClientView] = useState<'health' | 'weekly' | 'monthly'>('health');

  // Notificações / Alertas
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

  const systemLogs = [
    { time: '14:35', level: 'info', message: 'Clínica Saúde: Webhook enviado (APPOINTMENT_CREATED)' },
    { time: '14:32', level: 'info', message: 'Dr. Silva: Agenda bloqueada para 25/Dez' },
    { time: '14:30', level: 'error', message: 'Clínica Vida: Webhook falhou (404 Not Found)' },
    { time: '14:28', level: 'info', message: 'Dr. Santos: Login realizado após 30 dias' },
    { time: '14:25', level: 'info', message: 'Clínica Exemplo: Novo agendamento criado' },
    { time: '14:20', level: 'warning', message: 'Dr. Costa: Evolution API reconectada após falha temporária' },
    { time: '14:15', level: 'error', message: 'Clínica Norte: Evolution API desconectada' }
  ];

  const calculateMetrics = async () => {
    setLoading(true);
    try {
      const { global, clients, alerts: generatedAlerts } = await analyticsService.getOwnerDashboardMetrics();
      setGlobalMetrics(global);
      setClientsMetrics(clients);
      setAlerts(generatedAlerts);
    } catch (error) {
      console.error('Erro ao calcular métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateMetrics();
    const interval = setInterval(calculateMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAlertAction = (alertItem: OwnerAlert) => {
      switch(alertItem.actionType) {
          case 'CONTACT_PHONE':
              window.alert(`📞 Iniciando chamada para ${alertItem.clientName}: ${alertItem.actionPayload}`);
              break;
          case 'CONTACT_EMAIL':
              window.location.href = `mailto:${alertItem.actionPayload}?subject=Aviso MedFlow: ${alertItem.title}`;
              break;
          case 'OPEN_CONFIG':
              window.alert('Redirecionando para logs de integração...');
              break;
          case 'VIEW_REPORT':
              window.alert('Abrindo relatório detalhado...');
              break;
      }
  };

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

  // --- TRAFFIC OPPORTUNITIES (UPSELL) ---
  const trafficOpportunities = useMemo(() => {
    return clientsMetrics
      .filter(client => client.needsTrafficAnalysis)
      .map(client => {
        const reasons = [];
        
        if (client.occupancyRate < 40) {
          reasons.push({ severity: 'high', text: `Taxa de ocupação muito baixa (${client.occupancyRate.toFixed(1)}%).` });
        } else if (client.occupancyRate < 60) {
          reasons.push({ severity: 'medium', text: `Taxa de ocupação abaixo do ideal (${client.occupancyRate.toFixed(1)}%).` });
        }
        
        if (client.monthlyScheduled < 80) {
          reasons.push({ severity: 'high', text: `Volume baixo (${client.monthlyScheduled}/mês).` });
        } else if (client.monthlyScheduled < 150) {
          reasons.push({ severity: 'medium', text: `Volume pode crescer (${client.monthlyScheduled}/mês).` });
        }
        
        if (client.growthVsLastMonth < 0) {
          reasons.push({ severity: 'high', text: `Queda de ${Math.abs(client.growthVsLastMonth)}% vs mês anterior.` });
        } else if (client.growthVsLastMonth < 10) {
          reasons.push({ severity: 'medium', text: `Crescimento estagnado (+${client.growthVsLastMonth}%).` });
        }
        
        if (client.accountType === 'CLINICA' && client.occupancyRate < 70) {
          reasons.push({ severity: 'medium', text: `Clínica com baixa ocupação.` });
        }
        
        const availableCapacity = client.availableSlots - client.monthlyScheduled;
        const potentialNewAppointments = Math.max(0, Math.min(Math.floor(availableCapacity * 0.4), 60));
        const suggestedInvestment = client.accountType === 'CLINICA' ? 1500 : 800;
        const estimatedROI = (potentialNewAppointments * 200) / suggestedInvestment;
        
        return {
          ...client,
          reasons: reasons.slice(0, 3),
          potentialNewAppointments,
          suggestedInvestment,
          estimatedROI: estimatedROI.toFixed(1)
        };
      })
      .sort((a, b) => b.potentialNewAppointments - a.potentialNewAppointments)
      .slice(0, 5);
  }, [clientsMetrics]);

  // --- INTELLIGENT INSIGHTS ---
  const intelligentInsights = useMemo(() => {
    const insights = [];
    
    if (globalMetrics && globalMetrics.growthRate > 15) {
      insights.push({
        icon: '📈',
        title: 'Crescimento Acelerado Detectado',
        description: `Seus clientes agendaram ${globalMetrics.growthRate}% mais este mês! Destaque: ${topClients[0]?.clientName} (+${topClients[0]?.growthVsLastMonth}%)`,
        action: null
      });
    }
    
    const noAutomation = clientsMetrics.filter(c => !c.automationsActive).length;
    if (noAutomation > 2) {
      insights.push({
        icon: '⚠️',
        title: `${noAutomation} clientes não usaram automações este mês`,
        description: 'Eles podem não saber como configurar corretamente. Considere criar um tutorial em vídeo ou oferecer onboarding personalizado.',
        action: 'Criar Tutorial'
      });
    }
    
    const avgNoShow = clientsMetrics.length ? clientsMetrics.reduce((sum, c) => sum + c.noShowRate, 0) / clientsMetrics.length : 0;
    if (avgNoShow > 10) {
      insights.push({
        icon: '🔴',
        title: `Taxa média de "Não Veio" está em ${avgNoShow.toFixed(1)}%`,
        description: 'Isso está acima da média ideal (8%). Considere implementar lembretes 2h antes da consulta, além do lembrete de 24h.',
        action: 'Sugerir aos Clientes'
      });
    }
    
    if (trafficOpportunities.length > 3) {
      const potentialRev = trafficOpportunities.reduce((sum, c) => sum + (c as any).potentialNewAppointments, 0) * 200;
      insights.push({
        icon: '💰',
        title: `${trafficOpportunities.length} clientes com baixa ocupação`,
        description: `Receita potencial estimada em R$ ${potentialRev.toLocaleString('pt-BR')} com tráfego pago.`,
        action: 'Ver Oportunidades'
      });
    }
    
    return insights;
  }, [globalMetrics, clientsMetrics, topClients, trafficOpportunities]);

  // --- CHURN PREDICTION ---
  const highRiskChurn = useMemo(() => {
    return clientsMetrics
      .filter(c => c.healthScore === 'risk')
      .map(client => {
        const factors = [];
        const lastUsedDays = Math.floor((new Date().getTime() - new Date(client.lastUsed).getTime()) / (1000 * 60 * 60 * 24));
        
        if (lastUsedDays > 20) factors.push(`Sem uso há ${lastUsedDays} dias`);
        if (client.monthlyScheduled < 30) factors.push(`Apenas ${client.monthlyScheduled} agendamentos/mês`);
        if (!client.automationsActive) factors.push('Automações desativadas');
        if (client.webhookStatus !== 'healthy') factors.push('Problemas técnicos detectados');
        if (client.growthVsLastMonth < -20) factors.push(`Queda de ${Math.abs(client.growthVsLastMonth)}% vs mês anterior`);
        
        return {
          ...client,
          churnProbability: Math.min(85 + Math.floor(Math.random() * 15), 99),
          churnFactors: factors
        };
      });
  }, [clientsMetrics]);

  const mediumRiskChurn = useMemo(() => {
    return clientsMetrics
      .filter(c => c.healthScore === 'attention')
      .slice(0, 5);
  }, [clientsMetrics]);

  const totalRevenueAtRisk = useMemo(() => {
    return highRiskChurn.reduce((sum, c) => {
      return sum + (c.accountType === 'CLINICA' ? 400 : 150);
    }, 0) + mediumRiskChurn.reduce((sum, c) => {
      return sum + (c.accountType === 'CLINICA' ? 400 : 150) * 0.5;
    }, 0);
  }, [highRiskChurn, mediumRiskChurn]);


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
    const avgMonthly = Math.round(consultorioClients.reduce((sum, c) => sum + c.monthlyScheduled, 0) / consultorioClients.length);
    const noShowRate = (consultorioClients.reduce((sum, c) => sum + c.noShowRate, 0) / consultorioClients.length).toFixed(1);
    const automationRate = ((consultorioClients.filter(c => c.automationsActive).length / consultorioClients.length) * 100).toFixed(1);
    return { avgMonthly, noShowRate, automationRate, avgTicket: 150 };
  }, [clientsMetrics]);

  const clinicaStats = useMemo(() => {
    const clinicaClients = clientsMetrics.filter(c => c.accountType === 'CLINICA');
    if (clinicaClients.length === 0) return { avgMonthly: 0, noShowRate: 0, automationRate: 0, avgTicket: 0 };
    const avgMonthly = Math.round(clinicaClients.reduce((sum, c) => sum + c.monthlyScheduled, 0) / clinicaClients.length);
    const noShowRate = (clinicaClients.reduce((sum, c) => sum + c.noShowRate, 0) / clinicaClients.length).toFixed(1);
    const automationRate = ((clinicaClients.filter(c => c.automationsActive).length / clinicaClients.length) * 100).toFixed(1);
    return { avgMonthly, noShowRate, automationRate, avgTicket: 400 };
  }, [clientsMetrics]);

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
    const seed = client.clientName.charCodeAt(0) + date.getDate() + (client.healthScore === 'healthy' ? 5 : 0);
    if (client.healthScore === 'risk') return (seed % 10) > 8 ? 'low' : 'none';
    if (client.healthScore === 'attention') {
      const val = seed % 10;
      if (val > 7) return 'medium';
      if (val > 4) return 'low';
      return 'none';
    }
    const val = seed % 10;
    if (val > 6) return 'high';
    if (val > 3) return 'medium';
    if (val > 1) return 'low';
    return 'none';
  };

  const getAlertIcon = (type: string) => {
      switch(type) {
          case 'critical': return <AlertTriangle size={18} className="text-red-500" />;
          case 'warning': return <AlertTriangle size={18} className="text-amber-500" />;
          case 'info': return <Info size={18} className="text-blue-500" />;
          default: return <Info size={18} />;
      }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const criticalAlerts = alerts.filter(a => a.type === 'critical');

  return (
    <div className="min-h-screen bg-gray-50 p-6 animate-in fade-in duration-500">
      
      {/* 🔴 TOP BAR - ALERTA CRÍTICO (SE HOUVER) */}
      {criticalAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 animate-pulse-slow">
              <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle size={24} className="text-red-600" />
                  </div>
                  <div className="flex-1">
                      <h3 className="text-red-800 font-bold text-lg flex items-center justify-between">
                          {criticalAlerts.length} Alerta{criticalAlerts.length > 1 ? 's' : ''} Crítico{criticalAlerts.length > 1 ? 's' : ''} - Requer Atenção Imediata
                          <button 
                            onClick={() => { setShowNotifications(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className="text-sm bg-white border border-red-200 text-red-700 px-3 py-1 rounded-lg hover:bg-red-50 shadow-sm"
                          >
                              Ver Detalhes
                          </button>
                      </h3>
                      <div className="mt-1 space-y-1">
                          {criticalAlerts.slice(0, 2).map(alert => (
                              <p key={alert.id} className="text-red-700 text-sm flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                  <strong>{alert.clientName}:</strong> {alert.message}
                              </p>
                          ))}
                          {criticalAlerts.length > 2 && <p className="text-red-600 text-xs italic">e mais {criticalAlerts.length - 2}...</p>}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* HEADER */}
      <div className="mb-6 relative">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Building2 size={32} className="text-blue-600" />
              Dashboard Owner
            </h1>
            <p className="text-gray-500 mt-1">
              Visão global de {clientsMetrics.length} cliente(s) • Atualizado {new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => calculateMetrics()}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Atualizar
            </button>
            <div className="bg-white p-2 px-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                <span className="text-xs font-bold text-blue-600 px-2 py-1 bg-blue-50 rounded-md">ADMIN MASTER</span>
                <span className="text-sm text-slate-600">{currentUser.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTROS GLOBAIS E PAINEL DE NOTIFICAÇÕES INTELIGENTES */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 relative">
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
            
            {/* NOTIFICATION BELL WITH DROPDOWN */}
            <div className="ml-auto relative">
                <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={`relative p-2 rounded-lg transition-colors ${showNotifications ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <Bell size={20} />
                    {alerts.length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center">
                         {alerts.some(a => a.type === 'critical') && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                    </span>
                    )}
                </button>

                {/* DROPDOWN DE ALERTAS INTELIGENTES */}
                {showNotifications && (
                    <div className="absolute right-0 top-full mt-2 w-[400px] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 animate-in slide-in-from-top-2 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Zap size={16} className="text-orange-500" />
                                Alertas Proativos
                            </h3>
                            <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            {alerts.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <CheckCircle size={32} className="mx-auto mb-2 opacity-30 text-green-500" />
                                    <p className="text-sm">Tudo tranquilo! Nenhum alerta.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {alerts.map(alert => (
                                        <div key={alert.id} className={`p-4 hover:bg-gray-50 transition-colors ${alert.type === 'critical' ? 'bg-red-50/30' : ''}`}>
                                            <div className="flex gap-3">
                                                <div className="mt-1">{getAlertIcon(alert.type)}</div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-sm font-bold text-gray-900">{alert.clientName}</h4>
                                                        {alert.metricValue && (
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                                alert.type === 'critical' ? 'bg-red-100 text-red-700' :
                                                                alert.type === 'warning' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-blue-100 text-blue-700'
                                                            }`}>
                                                                {alert.metricValue}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-semibold text-gray-700 mt-0.5">{alert.title}</p>
                                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{alert.message}</p>
                                                    
                                                    {/* Action Button */}
                                                    <button 
                                                        onClick={() => handleAlertAction(alert)}
                                                        className={`mt-2 w-full py-1.5 text-xs font-bold rounded border flex items-center justify-center gap-1.5 transition-colors ${
                                                            alert.type === 'critical' 
                                                                ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' 
                                                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                                                        }`}
                                                    >
                                                        {alert.actionType === 'CONTACT_PHONE' && <><Phone size={12} /> Ligar Agora</>}
                                                        {alert.actionType === 'CONTACT_EMAIL' && <><Mail size={12} /> Enviar Email</>}
                                                        {alert.actionType === 'OPEN_CONFIG' && <><Zap size={12} /> Resolver Integração</>}
                                                        {alert.actionType === 'VIEW_REPORT' && <><BarChart3 size={12} /> Ver Relatório</>}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-2 border-t border-gray-100 bg-gray-50 text-center text-[10px] text-gray-500">
                             Dica: Resolva os alertas críticos para evitar churn.
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* MÉTRICAS PRINCIPAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
                <Building2 size={24} className="text-blue-600" />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${globalMetrics?.growthRate && globalMetrics.growthRate > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {globalMetrics?.growthRate && globalMetrics.growthRate > 0 ? '+' : ''}{globalMetrics?.growthRate}%
            </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{globalMetrics?.activeClients || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Clientes Ativos</p>
            <p className="text-xs text-gray-400 mt-2">{globalMetrics?.totalClients} total • +2 este mês</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-50 rounded-lg"><Calendar size={24} className="text-green-600" /></div>
            <TrendingUp size={18} className="text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{globalMetrics?.totalAppointmentsThisMonth.toLocaleString('pt-BR') || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Agendamentos/Mês</p>
            <p className="text-xs text-gray-400 mt-2">+23% vs mês anterior</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-50 rounded-lg"><Zap size={24} className="text-purple-600" /></div>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-100 text-purple-700">{globalMetrics?.automationSuccessRate}%</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{globalMetrics?.totalAutomationsSent.toLocaleString('pt-BR') || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Automações Enviadas</p>
            <p className="text-xs text-gray-400 mt-2">N8N + Evolution API</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-orange-50 rounded-lg"><DollarSign size={24} className="text-orange-600" /></div>
            <ArrowUp size={18} className="text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">R$ {globalMetrics?.mrr.toLocaleString('pt-BR') || 0}</p>
            <p className="text-sm text-gray-500 mt-1">MRR (Receita Recorrente)</p>
            <p className="text-xs text-gray-400 mt-2">+15% vs mês anterior</p>
        </div>
      </div>

      {/* INSIGHTS INTELIGENTES */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 mb-6 text-white shadow-lg shadow-indigo-200">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Zap size={20} className="text-yellow-300" />
          Insights Inteligentes
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {intelligentInsights.map((insight, idx) => (
            <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:bg-white/20 transition-colors">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{insight.icon}</div>
                <div className="flex-1">
                  <h4 className="font-bold mb-1 text-white">{insight.title}</h4>
                  <p className="text-sm text-white/90 leading-relaxed">{insight.description}</p>
                  {insight.action && (
                    <button className="mt-3 px-4 py-2 bg-white text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors shadow-sm">
                      {insight.action}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
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
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${client.accountType === 'CLINICA' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                            {client.accountType}
                        </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatRelativeDate(client.lastUsed)}</td>
                        <td className="py-3 px-4 text-right text-sm font-bold text-gray-900">{client.appointmentsThisMonth}</td>
                        <td className="py-3 px-4 text-center">
                        {client.automationsActive ? <CheckCircle size={18} className="text-green-500 inline" /> : <AlertTriangle size={18} className="text-red-500 inline" />}
                        </td>
                        <td className="py-3 px-4 text-center">
                        {client.healthScore === 'healthy' && <span className="inline-flex items-center gap-1 text-xs font-bold bg-green-50 text-green-700 px-2 py-1 rounded-full">🟢 Saudável</span>}
                        {client.healthScore === 'attention' && <span className="inline-flex items-center gap-1 text-xs font-bold bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full">🟡 Atenção</span>}
                        {client.healthScore === 'risk' && <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-50 text-red-700 px-2 py-1 rounded-full">🔴 Risco</span>}
                        </td>
                        <td className="py-3 px-4 text-right">
                        {client.healthScore !== 'healthy' && <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">Contatar</button>}
                        </td>
                    </>
                    )}
                    
                    {clientView === 'weekly' && (
                    <>
                        <td className="py-3 px-4"><p className="font-semibold text-gray-900 text-sm">{client.clientName}</p></td>
                        <td className="py-3 px-4"><span className="text-xs px-2 py-1 rounded-full font-bold bg-gray-100 text-gray-700">{client.accountType}</span></td>
                        <td className="py-3 px-4 text-right text-sm text-gray-700">{client.weeklyContacts}</td>
                        <td className="py-3 px-4 text-right text-sm font-bold text-blue-600">{client.weeklyScheduled}</td>
                        <td className="py-3 px-4 text-right text-sm text-green-600">{client.weeklyAttended}</td>
                        <td className="py-3 px-4 text-right text-sm text-red-600">{client.weeklyCancelled}</td>
                        <td className="py-3 px-4 text-right"><span className="text-sm font-bold text-gray-900">{client.weeklyScheduled > 0 ? ((client.weeklyAttended / client.weeklyScheduled) * 100).toFixed(1) : 0}%</span></td>
                    </>
                    )}
                    
                    {clientView === 'monthly' && (
                    <>
                        <td className="py-3 px-4"><p className="font-semibold text-gray-900 text-sm">{client.clientName}</p></td>
                        <td className="py-3 px-4"><span className="text-xs px-2 py-1 rounded-full font-bold bg-gray-100 text-gray-700">{client.accountType}</span></td>
                        <td className="py-3 px-4 text-right text-sm text-gray-700">{client.monthlyContacts}</td>
                        <td className="py-3 px-4 text-right text-sm font-bold text-blue-600">{client.monthlyScheduled}</td>
                        <td className="py-3 px-4 text-right text-sm text-green-600">{client.monthlyAttended}</td>
                        <td className="py-3 px-4 text-right text-sm text-red-600">{client.monthlyCancelled}</td>
                        <td className="py-3 px-4 text-right"><span className="text-sm font-bold text-gray-900">{client.monthlyScheduled > 0 ? ((client.monthlyAttended / client.monthlyScheduled) * 100).toFixed(1) : 0}%</span></td>
                        <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                            {client.growthVsLastMonth > 0 ? <><ArrowUp size={14} className="text-green-600" /><span className="text-xs font-bold text-green-600">+{client.growthVsLastMonth}%</span></> : client.growthVsLastMonth < 0 ? <><ArrowDown size={14} className="text-red-600" /><span className="text-xs font-bold text-red-600">{client.growthVsLastMonth}%</span></> : <><Minus size={14} className="text-gray-400" /><span className="text-xs text-gray-500">0%</span></>}
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

      {/* ANÁLISE DE UPSELL - TRÁFEGO PAGO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Target size={20} className="text-orange-600" />
          Oportunidades de Tráfego Pago
        </h3>
        <p className="text-sm text-gray-600 mb-6">Análise de clientes que poderiam se beneficiar de campanhas de tráfego pago para aumentar agendamentos.</p>
        <div className="space-y-4">
          {trafficOpportunities.map((client) => (
            <div key={client.clientId} className="border border-orange-100 rounded-lg p-4 bg-gradient-to-r from-orange-50 to-white">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 flex items-center gap-2">
                    {client.clientName}
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{client.accountType}</span>
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">Taxa de ocupação: <strong>{client.occupancyRate.toFixed(1)}%</strong></p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Potencial mensal</p>
                  <p className="text-lg font-bold text-orange-600">+{client.potentialNewAppointments} agend.</p>
                </div>
              </div>
              <div className="space-y-2 mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase">Por que indicar tráfego pago:</p>
                {(client as any).reasons.map((reason: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${reason.severity === 'high' ? 'bg-red-500' : reason.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                    <p className="text-gray-700 flex-1">{reason.text}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 bg-white rounded-lg p-3 border border-orange-100">
                <div><p className="text-xs text-gray-500">Investimento sugerido</p><p className="text-sm font-bold text-gray-900">R$ {(client as any).suggestedInvestment}/mês</p></div>
                <div><p className="text-xs text-gray-500">Novos agendamentos</p><p className="text-sm font-bold text-green-600">+{(client as any).potentialNewAppointments}</p></div>
                <div><p className="text-xs text-gray-500">ROI estimado</p><p className="text-sm font-bold text-orange-600">{(client as any).estimatedROI}x</p></div>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors">Enviar Proposta</button>
                <button className="px-4 py-2 border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-50 text-sm font-medium transition-colors">Ver Detalhes</button>
              </div>
            </div>
          ))}
        </div>
        {trafficOpportunities.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Target size={48} className="mx-auto mb-3 opacity-50" />
            <p>Nenhuma oportunidade identificada no momento.</p>
          </div>
        )}
      </div>

      {/* PREVISÃO DE CHURN */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <AlertTriangle size={20} className="text-red-600" />
          Previsão de Churn (Próximos 30 dias)
        </h3>
        
        {highRiskChurn.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <h4 className="font-bold text-red-800 text-sm uppercase">
                Alto Risco ({highRiskChurn.length} cliente{highRiskChurn.length !== 1 ? 's' : ''})
              </h4>
            </div>
            <div className="space-y-3">
              {highRiskChurn.map(client => (
                <div key={client.clientId} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h5 className="font-bold text-gray-900">{client.clientName}</h5>
                      <p className="text-sm text-red-700 font-medium">Probabilidade de churn: <strong>{(client as any).churnProbability}%</strong></p>
                    </div>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">{client.accountType}</span>
                  </div>
                  <div className="space-y-1 mb-3">
                    <p className="text-xs text-gray-600"><strong>Fatores de risco:</strong></p>
                    {(client as any).churnFactors.map((factor: string, i: number) => (
                      <p key={i} className="text-xs text-gray-700 ml-3">• {factor}</p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Ligar Hoje</button>
                    <button className="px-3 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50">Enviar Email</button>
                  </div>
                  <p className="text-xs text-red-600 mt-2">💰 Receita em risco: R$ {client.accountType === 'CLINICA' ? '400' : '150'}/mês</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {mediumRiskChurn.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <h4 className="font-bold text-yellow-800 text-sm uppercase">Médio Risco ({mediumRiskChurn.length} cliente{mediumRiskChurn.length !== 1 ? 's' : ''})</h4>
              </div>
              <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">Ver lista completa</button>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">{mediumRiskChurn.map(c => c.clientName).join(', ')}</p>
            </div>
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t border-gray-200 bg-gradient-to-r from-red-50 to-yellow-50 -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">💰 Receita total em risco:</p>
            <p className="text-xl font-bold text-red-600">R$ {totalRevenueAtRisk.toLocaleString('pt-BR')}/mês</p>
          </div>
        </div>
      </div>

      {/* RANKINGS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Award size={20} className="text-yellow-600" />TOP 5 Clientes (Por Volume)</h3>
            <div className="space-y-3">
            {topClients.map((client, idx) => (
                <div key={client.clientId} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-200 text-gray-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</div>
                <div className="flex-1"><p className="font-semibold text-gray-900 text-sm">{client.clientName}</p><p className="text-xs text-gray-500">{client.appointmentsThisMonth} agendamentos/mês</p></div>
                <div className="text-right"><div className="flex items-center gap-1 text-green-600"><TrendingUp size={14} /><span className="text-xs font-bold">+{client.growthVsLastMonth}%</span></div></div>
                </div>
            ))}
            </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Target size={20} className="text-red-600" />Clientes que Precisam de Atenção</h3>
            <div className="space-y-3">
            {bottomClients.map((client) => (
                <div key={client.clientId} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle size={16} className="text-red-600" /></div>
                <div className="flex-1"><p className="font-semibold text-gray-900 text-sm">{client.clientName}</p><p className="text-xs text-red-600">{client.appointmentsThisMonth} agendamentos/mês ({client.growthVsLastMonth}%)</p></div>
                <button className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Contatar</button>
                </div>
            ))}
            </div>
        </div>
      </div>

      {/* GRÁFICOS E MAPA DE CALOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-green-600" />Crescimento Mensal</h4>
                <div className="space-y-2">
                {monthlyGrowthData.map((month, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12">{month.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden"><div className="bg-gradient-to-r from-blue-500 to-green-500 h-full flex items-center justify-end pr-2" style={{ width: `${(month.value / 2000) * 100}%` }}><span className="text-xs font-bold text-white">{month.value}</span></div></div>
                    </div>
                ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100"><p className="text-xs text-gray-500">Crescimento acumulado</p><p className="text-2xl font-bold text-green-600">+23.4%</p></div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Building2 size={18} className="text-purple-600" />Tipos de Conta</h4>
                <div className="flex items-center justify-center mb-4"><div className="relative w-40 h-40"><svg viewBox="0 0 100 100" className="transform -rotate-90"><circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="20"/><circle cx="50" cy="50" r="40" fill="none" stroke="#8b5cf6" strokeWidth="20" strokeDasharray={`${consultorioPercentage * 2.51} 251`} strokeLinecap="round"/><circle cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" strokeWidth="20" strokeDasharray={`${clinicaPercentage * 2.51} 251`} strokeDashoffset={`-${consultorioPercentage * 2.51}`} strokeLinecap="round"/></svg><div className="absolute inset-0 flex items-center justify-center"><div className="text-center"><p className="text-2xl font-bold text-gray-900">{clientsMetrics.length}</p><p className="text-xs text-gray-500">Total</p></div></div></div></div>
                <div className="space-y-2">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div><span className="text-sm text-gray-700">Consultório</span></div><span className="font-bold text-gray-900">{consultorioCount} ({consultorioPercentage}%)</span></div>
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-sm text-gray-700">Clínica</span></div><span className="font-bold text-gray-900">{clinicaCount} ({clinicaPercentage}%)</span></div>
                </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4"><h4 className="font-bold text-gray-800 flex items-center gap-2"><Zap size={18} className="text-yellow-600" />Automações</h4><div className="relative"><select value={automationPeriod} onChange={(e) => setAutomationPeriod(e.target.value as '7d' | '30d')} className="appearance-none pl-2 pr-6 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-yellow-500/20 cursor-pointer"><option value="7d">7 dias</option><option value="30d">30 dias</option></select><ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" /></div></div>
                <div className="space-y-4">
                <div><div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-600">Confirmações</span><span className="text-xs font-bold text-gray-900">{currentAutoStats.confirmations.count}</span></div><div className="bg-gray-100 rounded-full h-2 overflow-hidden"><div className="bg-green-500 h-full" style={{ width: `${currentAutoStats.confirmations.rate}%` }}></div></div><span className="text-xs text-green-600 font-medium">{currentAutoStats.confirmations.rate}% entregue</span></div>
                <div><div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-600">Lembretes 24h</span><span className="text-xs font-bold text-gray-900">{currentAutoStats.reminders.count}</span></div><div className="bg-gray-100 rounded-full h-2 overflow-hidden"><div className="bg-blue-500 h-full" style={{ width: `${currentAutoStats.reminders.rate}%` }}></div></div><span className="text-xs text-blue-600 font-medium">{currentAutoStats.reminders.rate}% entregue</span></div>
                <div><div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-600">Recuperação</span><span className="text-xs font-bold text-gray-900">{currentAutoStats.recovery.count}</span></div><div className="bg-gray-100 rounded-full h-2 overflow-hidden"><div className="bg-orange-500 h-full" style={{ width: `${currentAutoStats.recovery.rate}%` }}></div></div><span className="text-xs text-orange-600 font-medium">{currentAutoStats.recovery.rate}% reagendou</span></div>
                <div><div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-600">Reviews</span><span className="text-xs font-bold text-gray-900">{currentAutoStats.reviews.count}</span></div><div className="bg-gray-100 rounded-full h-2 overflow-hidden"><div className="bg-purple-500 h-full" style={{ width: `${currentAutoStats.reviews.rate}%` }}></div></div><span className="text-xs text-purple-600 font-medium">{currentAutoStats.reviews.rate}% respondeu</span></div>
                </div>
            </div>
      </div>

      {/* LOGS GLOBAIS DO SISTEMA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 size={20} className="text-gray-600" />
            Logs Globais do Sistema
            </h3>
            <button className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
            Ver todos os logs
            <ExternalLink size={14} />
            </button>
        </div>
        
        <div className="space-y-2 font-mono text-xs max-h-64 overflow-y-auto">
            {systemLogs.map((log, idx) => (
            <div key={idx} className={`flex items-start gap-3 p-2 rounded ${
                log.level === 'error' ? 'bg-red-50' :
                log.level === 'warning' ? 'bg-yellow-50' :
                'bg-gray-50'
            }`}>
                <span className="text-gray-400 shrink-0">[{log.time}]</span>
                <span className={`font-bold shrink-0 ${
                log.level === 'error' ? 'text-red-600' :
                log.level === 'warning' ? 'text-yellow-600' :
                'text-green-600'
                }`}>
                {log.level === 'error' ? '❌' : log.level === 'warning' ? '⚠️' : '✅'}
                </span>
                <span className="flex-1 text-gray-700">{log.message}</span>
            </div>
            ))}
        </div>
      </div>

      {/* SAÚDE TÉCNICA DO SISTEMA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><Activity size={20} className="text-green-600" />Saúde Técnica do Sistema</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-gray-700">Webhooks (24h)</span><CheckCircle size={16} className="text-green-500" /></div>
              <div className="bg-gray-100 rounded-full h-3 overflow-hidden mb-2"><div className="bg-green-500 h-full" style={{ width: '98.5%' }}></div></div>
              <div className="flex items-center justify-between text-xs"><span className="text-gray-600">4.523 enviados</span><span className="font-bold text-green-600">98.5%</span></div>
              <p className="text-xs text-gray-500 mt-1">68 falhas registradas</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-gray-700">Evolution API</span><CheckCircle size={16} className="text-green-500" /></div>
              <div className="bg-gray-100 rounded-full h-3 overflow-hidden mb-2"><div className="bg-green-500 h-full" style={{ width: '100%' }}></div></div>
              <div className="flex items-center justify-between text-xs"><span className="text-gray-600">15/15 instâncias</span><span className="font-bold text-green-600">100%</span></div>
              <p className="text-xs text-gray-500 mt-1">Todas online</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-gray-700">Tempo Resposta</span><CheckCircle size={16} className="text-green-500" /></div>
              <div className="bg-gray-100 rounded-full h-3 overflow-hidden mb-2"><div className="bg-green-500 h-full" style={{ width: '60%' }}></div></div>
              <div className="flex items-center justify-between text-xs"><span className="text-gray-600">Meta: &lt;2s</span><span className="font-bold text-green-600">1.2s</span></div>
              <p className="text-xs text-gray-500 mt-1">Ótima performance</p>
            </div>
          </div>
      </div>

      {/* EXPORTAÇÃO DE DADOS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Download size={20} className="text-blue-600" />
          Exportar Dados
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-900">Relatório de Clientes</h4>
              <Download size={18} className="text-gray-400 group-hover:text-blue-600" />
            </div>
            <p className="text-sm text-gray-600 mb-3">
              PDF completo com métricas de todos os clientes
            </p>
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              Gerar PDF
            </button>
          </div>
          
          <div className="p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-all cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-900">Planilha de Performance</h4>
              <Download size={18} className="text-gray-400 group-hover:text-green-600" />
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Excel com dados detalhados de agendamentos
            </p>
            <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
              Gerar Excel
            </button>
          </div>
          
          <div className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-900">Logs de Webhooks</h4>
              <Download size={18} className="text-gray-400 group-hover:text-purple-600" />
            </div>
            <p className="text-sm text-gray-600 mb-3">
              CSV com histórico de webhooks enviados
            </p>
            <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
              Gerar CSV
            </button>
          </div>
          
          <div className="p-4 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-all cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-900">Dados para Analytics</h4>
              <Download size={18} className="text-gray-400 group-hover:text-orange-600" />
            </div>
            <p className="text-sm text-gray-600 mb-3">
              JSON estruturado para análises externas
            </p>
            <button className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
              Gerar JSON
            </button>
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-3">
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Este mês</option>
            <option value="custom">Período customizado</option>
          </select>
          
          <p className="text-xs text-gray-500">
            Selecione o período antes de exportar
          </p>
        </div>
      </div>

      {/* AÇÕES RÁPIDAS (Floating Sidebar) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setShowQuickActions(!showQuickActions)}
          className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 transition-all flex items-center justify-center hover:scale-110"
        >
          <Zap size={24} />
        </button>
        
        {showQuickActions && (
          <div className="absolute bottom-16 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-64 animate-in slide-in-from-bottom-4">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Zap size={16} className="text-blue-600" />
              Ações Rápidas
            </h4>
            
            <div className="space-y-2">
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium text-left flex items-center gap-2">
                <UserPlus size={16} />
                Criar Cliente
              </button>
              
              <button className="w-full px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium text-left flex items-center gap-2">
                <MessageSquare size={16} />
                Email em Massa
              </button>
              
              <button className="w-full px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium text-left flex items-center gap-2">
                <BarChart3 size={16} />
                Relatório Mensal
              </button>
              
              <button className="w-full px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium text-left flex items-center gap-2">
                <Eye size={16} />
                Ver Logs Sistema
              </button>
              
              <button className="w-full px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium text-left flex items-center gap-2">
                <Phone size={16} />
                Suporte Ativo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
