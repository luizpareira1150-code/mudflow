
import React, { useState, useEffect } from 'react';
import { User, DashboardMetrics, AccountType, Organization, Appointment } from '../types';
import { dataService } from '../services/mockSupabase';
import { appointmentService } from '../services/appointmentService'; // Direct service import for analysis
import { analyzeRecoveryTrend } from '../services/geminiService';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  BarChart3,
  Activity,
  Clock,
  Award,
  Zap,
  Target,
  Bot,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Lightbulb
} from 'lucide-react';

interface MetricsDashboardProps {
  user: User;
  organization: Organization | null;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ user, organization }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');
  
  // AI Insight State
  const [aiInsight, setAiInsight] = useState<string>("Analisando dados dos últimos 30 dias...");
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [user.clinicId, period]);

  // AI Analysis Effect (Independent 30-Day Window)
  useEffect(() => {
    const generateAnalysis = async () => {
        setAiLoading(true);
        try {
            // Calculate date range: Today - 30 days
            const today = new Date();
            const past = new Date();
            past.setDate(today.getDate() - 30);
            
            const endDate = today.toISOString().split('T')[0];
            const startDate = past.toISOString().split('T')[0];

            // Fetch historical data directly from service
            const historicalAppts = await appointmentService.getAppointmentsInRange(user.clinicId, startDate, endDate);
            
            if (historicalAppts.length > 5) { // Minimum threshold for analysis
                const insight = await analyzeRecoveryTrend(historicalAppts);
                setAiInsight(insight);
            } else {
                setAiInsight("Aguardando acumular mais histórico (mínimo 5 agendamentos) para gerar análises operacionais confiáveis.");
            }
        } catch (err) {
            console.error("AI Analysis failed:", err);
            setAiInsight("Não foi possível gerar a análise no momento.");
        } finally {
            setAiLoading(false);
        }
    };

    // Small delay to prioritize UI rendering
    const timer = setTimeout(generateAnalysis, 1000);
    return () => clearTimeout(timer);
  }, [user.clinicId]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await dataService.getClinicMetrics(user.clinicId);
      setMetrics(data);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <Activity size={48} className="mx-auto mb-4 text-blue-500 animate-pulse" />
          <p className="text-gray-500">Calculando indicadores...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <p className="text-gray-400">Erro ao carregar métricas.</p>
      </div>
    );
  }

  const monthGrowth = metrics.general.appointmentsLastMonth > 0 
    ? ((metrics.general.appointmentsThisMonth - metrics.general.appointmentsLastMonth) / metrics.general.appointmentsLastMonth) * 100 
    : 0;

  return (
    <div className="h-full overflow-y-auto pb-12 p-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
             <BarChart3 className="text-blue-600" size={32} />
             Dashboard Operacional
          </h1>
          <p className="text-gray-500">
            Visão geral e performance da automação • {organization?.name || 'Sua clínica'}
          </p>
        </div>

        {/* Período Selector */}
        <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === 'week' 
                ? 'bg-blue-50 text-blue-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            7 dias
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === 'month' 
                ? 'bg-blue-50 text-blue-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Este Mês
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === 'all' 
                ? 'bg-blue-50 text-blue-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Total
          </button>
        </div>
      </div>

      {/* --- SEÇÃO 1: VISÃO GERAL (TOTAL GERAL) --- */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Activity size={20} className="text-gray-500" />
            Visão Geral da Clínica
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Agendados */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all border-l-4 border-l-blue-500">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Agendados</p>
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Calendar size={18} /></div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{metrics.general.totalScheduled}</h3>
                <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${monthGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {monthGrowth > 0 ? '+' : ''}{monthGrowth.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">vs mês anterior</span>
                </div>
            </div>

            {/* Total Comparecimentos */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all border-l-4 border-l-emerald-500">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Comparecimentos</p>
                    <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><CheckCircle size={18} /></div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{metrics.general.totalAttended}</h3>
                <p className="text-xs text-gray-500 mt-2">
                    <strong className="text-emerald-600">{metrics.general.attendanceRate.toFixed(1)}%</strong> da agenda realizada
                </p>
            </div>

            {/* Total Faltas */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all border-l-4 border-l-rose-500">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Faltas (No-Show)</p>
                    <div className="bg-rose-50 p-2 rounded-lg text-rose-600"><XCircle size={18} /></div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{metrics.general.totalNoShow}</h3>
                <p className="text-xs text-gray-500 mt-2">
                    <strong className="text-rose-600">{metrics.general.noShowRate.toFixed(1)}%</strong> de ociosidade
                </p>
            </div>

            {/* Cancelamentos */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all border-l-4 border-l-amber-500">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Cancelamentos</p>
                    <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><Clock size={18} /></div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{metrics.general.totalCancelled}</h3>
                <p className="text-xs text-gray-500 mt-2">
                    Horários liberados antecipadamente
                </p>
            </div>
        </div>
      </div>

      {/* --- SEÇÃO 2: FUNIL DE AUTOMAÇÃO (SYSTEM EFFICIENCY) --- */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl shadow-xl p-8 mb-10 text-white relative overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="bg-white/10 p-1.5 rounded-lg backdrop-blur-sm">
                            <Bot size={20} className="text-indigo-300" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Eficiência do Sistema</h2>
                    </div>
                    <p className="text-indigo-200 text-sm">
                        Como a automação (IA + WhatsApp) está economizando tempo e retendo pacientes.
                    </p>
                </div>
                <div className="bg-indigo-500/20 border border-indigo-500/30 rounded-xl px-4 py-2 backdrop-blur-md">
                    <p className="text-xs text-indigo-200 uppercase font-bold tracking-wide">Tempo Economizado</p>
                    <p className="text-2xl font-bold text-white flex items-center gap-1">
                        {metrics.automation.estimatedTimeSaved}h
                        <span className="text-xs font-normal text-indigo-300">este período</span>
                    </p>
                </div>
            </div>

            {/* O FUNIL DE AUTOMAÇÃO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Interações */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 relative group hover:bg-white/10 transition-all">
                    <div className="absolute top-1/2 right-0 -mr-2 hidden md:block z-20">
                        <ArrowRight className="text-indigo-500/50" />
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300"><MessageSquare size={20} /></div>
                        <span className="text-sm font-medium text-indigo-100">Interações IA</span>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{metrics.automation.totalInteractions}</p>
                    <p className="text-xs text-indigo-300">Pacientes atendidos pelo bot</p>
                </div>

                {/* 2. Agendados Automaticamente */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 relative group hover:bg-white/10 transition-all">
                    <div className="absolute top-1/2 right-0 -mr-2 hidden md:block z-20">
                        <ArrowRight className="text-indigo-500/50" />
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300"><Calendar size={20} /></div>
                        <span className="text-sm font-medium text-purple-100">Agendados via Bot</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-white mb-1">{metrics.automation.scheduledAutomatically}</p>
                        <span className="text-xs font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                            {metrics.automation.conversionRate.toFixed(0)}% conv.
                        </span>
                    </div>
                    <p className="text-xs text-purple-300">Sem intervenção humana</p>
                </div>

                {/* 3. Sucesso Real */}
                <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-emerald-500/30 rounded-xl p-5 relative hover:from-green-500/30 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300"><CheckCircle size={20} /></div>
                        <span className="text-sm font-bold text-emerald-100">Comparecimento Real</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-white mb-1">{metrics.automation.attendedViaAutomation}</p>
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                            {metrics.automation.efficiencyRate.toFixed(0)}% sucesso
                        </span>
                    </div>
                    <p className="text-xs text-emerald-300">Pacientes trazidos pelo sistema</p>
                </div>

            </div>
        </div>
      </div>

      {/* --- SEÇÃO 3: ANÁLISES DETALHADAS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Ranking de Médicos */}
        {organization?.accountType === AccountType.CLINICA && metrics.doctorStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Users size={20} className="text-blue-600" />
              Performance por Médico
            </h3>
            <div className="flex-1 space-y-4">
              {metrics.doctorStats
                .sort((a, b) => b.totalAppointments - a.totalAppointments)
                .map((doc, idx) => (
                  <div key={doc.doctorId} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-white hover:shadow-md border border-transparent hover:border-slate-100 transition-all group">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                      idx === 1 ? 'bg-gray-200 text-gray-700' :
                      idx === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-white border border-slate-200 text-slate-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{doc.doctorName}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                         <span className="flex items-center gap-1"><Calendar size={10} /> {doc.totalAppointments} agend.</span>
                         <span className="flex items-center gap-1"><CheckCircle size={10} /> {doc.attendanceRate.toFixed(0)}% presença</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-600">{doc.attended}</p>
                      <p className="text-[10px] uppercase font-bold text-gray-400">Atendidos</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Timeline de Evolução */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-8 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-600" />
            Volume Diário (30 Dias)
            </h3>
            
            <div className="h-64 flex items-end justify-between gap-1">
            {metrics.timeline.map((day, idx) => {
                const total = day.agendado + day.atendido + day.naoVeio;
                const maxTotal = Math.max(...metrics.timeline.map(d => d.agendado + d.atendido + d.naoVeio));
                const height = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                
                const date = new Date(day.date);
                const dayLabel = date.getDate();
                const isToday = day.date === new Date().toISOString().split('T')[0];
                
                return (
                <div key={day.date} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    {/* Bar */}
                    <div 
                    className={`w-full rounded-t-md transition-all duration-300 relative ${isToday ? 'bg-blue-600 opacity-100' : 'bg-slate-300 opacity-60 hover:opacity-100 hover:bg-blue-400'}`}
                    style={{ height: `${height}%`, minHeight: total > 0 ? '6px' : '0' }}
                    >
                    </div>
                    
                    {/* Tooltip on hover */}
                    <div className="invisible group-hover:visible absolute bottom-full mb-2 bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-20 shadow-xl border border-slate-700 pointer-events-none">
                    <div className="font-bold mb-1 border-b border-slate-700 pb-1">{date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                        <span className="text-emerald-400">● Atendidos:</span> <span className="font-bold">{day.atendido}</span>
                        <span className="text-blue-400">● Agendados:</span> <span className="font-bold">{day.agendado}</span>
                        <span className="text-rose-400">● Faltas:</span> <span className="font-bold">{day.naoVeio}</span>
                    </div>
                    </div>
                    
                    {/* Labels (Every 5 days) */}
                    {(idx % 5 === 0 || isToday) && (
                    <span className={`text-[10px] mt-2 absolute -bottom-5 ${isToday ? 'font-bold text-blue-600' : 'text-gray-400'}`}>
                        {dayLabel}
                    </span>
                    )}
                </div>
                );
            })}
            </div>
        </div>
      </div>

      {/* AI Operational Insights Section - Bottom of Page */}
      <div className="mt-8 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-8 rounded-2xl border border-indigo-100 shadow-sm transition-all hover:shadow-md relative overflow-hidden">
         {/* Decorative Background Element */}
         <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -translate-y-1/2 translate-x-1/2"></div>
         
         <div className="flex items-start gap-5 relative z-10">
             <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-indigo-50 shrink-0">
                 <Sparkles className="text-indigo-600" size={28} />
             </div>
             <div className="flex-1">
                 <div className="flex items-center gap-3 mb-3">
                    <h4 className="text-indigo-900 font-bold text-xl tracking-tight">
                        INSIGHTS OPERACIONAIS (IA)
                    </h4>
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wide">
                        Beta • Mensal
                    </span>
                 </div>
                 
                 <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-line bg-white/60 p-4 rounded-xl border border-indigo-50/50">
                     {aiLoading ? (
                         <div className="flex items-center gap-2 text-indigo-500">
                             <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                             Processando últimos 30 dias...
                         </div>
                     ) : (
                         aiInsight
                     )}
                 </div>

                 <div className="mt-4 flex items-center gap-2 text-xs text-indigo-400">
                    <Lightbulb size={12} />
                    <span>Dica gerada com base nos padrões de agendamento dos últimos 30 dias.</span>
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
};
