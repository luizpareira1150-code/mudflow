
import { DashboardMetrics, AppointmentStatus, GlobalMetrics, ClientHealthMetrics, OwnerAlert, AccountType, Organization } from '../types';
import { appointmentService } from './appointmentService';
import { doctorService } from './doctorService';
import { delay, getStorage, STORAGE_KEYS, initialOrganizations, initialAppointments, initialSettings } from './storage';

export const analyticsService = {
  getClinicMetrics: async (clinicId: string, startDate?: string, endDate?: string): Promise<DashboardMetrics> => {
    await delay(300);
    
    const now = new Date();
    // Fetch directly from storage to ensure we have all data
    const allAppts = getStorage(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
    const doctors = await doctorService.getDoctors(clinicId);
    
    // Filter by clinic
    let rawAppts = allAppts.filter(a => a.clinicId === clinicId);

    // Filter by Date Range if provided
    if (startDate && endDate) {
        rawAppts = rawAppts.filter(a => a.date >= startDate && a.date <= endDate);
    }

    // --- GENERAL CALCULATIONS ---

    // 1. Time Periods
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    
    const appointmentsThisMonth = rawAppts.filter(a => a.date >= firstDayThisMonth && a.date <= lastDayThisMonth).length;
    const appointmentsLastMonth = rawAppts.filter(a => a.date >= firstDayLastMonth && a.date <= lastDayLastMonth).length;

    // 2. General Status Breakdown
    const statusBreakdown = {
        EM_CONTATO: rawAppts.filter(a => a.status === AppointmentStatus.EM_CONTATO).length,
        AGENDADO: rawAppts.filter(a => a.status === AppointmentStatus.AGENDADO).length,
        ATENDIDO: rawAppts.filter(a => a.status === AppointmentStatus.ATENDIDO).length,
        NAO_VEIO: rawAppts.filter(a => a.status === AppointmentStatus.NAO_VEIO).length,
        BLOQUEADO: rawAppts.filter(a => a.status === AppointmentStatus.BLOQUEADO).length,
    };

    const totalCancelled = 0; // In a real app we'd track cancellations in a separate table or log

    const totalScheduled = statusBreakdown.AGENDADO + statusBreakdown.ATENDIDO + statusBreakdown.NAO_VEIO;
    const totalAttended = statusBreakdown.ATENDIDO;
    const totalNoShow = statusBreakdown.NAO_VEIO;

    const attendanceRate = totalScheduled > 0 ? (totalAttended / totalScheduled) * 100 : 0;
    const noShowRate = totalScheduled > 0 ? (totalNoShow / totalScheduled) * 100 : 0;

    // --- AUTOMATION SPECIFIC CALCULATIONS ---
    // Simulação baseada nos dados reais: Consideramos "EM_CONTATO" e agendamentos criados via N8N
    // Como não temos flag explícita "via_automation" em todos os legados, vamos estimar ou usar metadados se disponíveis
    const interactions = statusBreakdown.EM_CONTATO + totalScheduled; 
    const scheduledAuto = totalScheduled; // Assume sistema é usado primariamente para isso
    const attendedAuto = totalAttended;
    
    const minutesSaved = scheduledAuto * 10;
    const hoursSaved = Math.floor(minutesSaved / 60);

    const automationMetrics = {
        totalInteractions: interactions,
        scheduledAutomatically: scheduledAuto,
        attendedViaAutomation: attendedAuto,
        conversionRate: interactions > 0 ? (scheduledAuto / interactions) * 100 : 0,
        efficiencyRate: scheduledAuto > 0 ? (attendedAuto / scheduledAuto) * 100 : 0,
        estimatedTimeSaved: hoursSaved
    };

    // 3. Doctor Stats
    const doctorStats = doctors.map(doc => {
        const docAppts = rawAppts.filter(a => a.doctorId === doc.id);
        const docAttended = docAppts.filter(a => a.status === AppointmentStatus.ATENDIDO).length;
        const docNoShow = docAppts.filter(a => a.status === AppointmentStatus.NAO_VEIO).length;
        const docScheduled = docAppts.filter(a => 
            a.status === AppointmentStatus.AGENDADO || 
            a.status === AppointmentStatus.ATENDIDO || 
            a.status === AppointmentStatus.NAO_VEIO
        ).length;

        return {
            doctorId: doc.id,
            doctorName: doc.name,
            totalAppointments: docAppts.length,
            attended: docAttended,
            noShow: docNoShow,
            attendanceRate: docScheduled > 0 ? (docAttended / docScheduled) * 100 : 0
        };
    });

    // 4. Top Procedures
    const procedureCounts: Record<string, number> = {};
    rawAppts.forEach(a => {
        if (a.procedure) {
            procedureCounts[a.procedure] = (procedureCounts[a.procedure] || 0) + 1;
        }
    });

    const topProcedures = Object.entries(procedureCounts)
        .map(([procedure, count]) => ({ procedure, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // 5. Timeline (Last 30 days)
    const timeline: { date: string; agendado: number; atendido: number; naoVeio: number; }[] = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        
        const dayAppts = rawAppts.filter(a => a.date === dateStr);
        
        timeline.push({
            date: dateStr,
            agendado: dayAppts.filter(a => a.status === AppointmentStatus.AGENDADO).length,
            atendido: dayAppts.filter(a => a.status === AppointmentStatus.ATENDIDO).length,
            naoVeio: dayAppts.filter(a => a.status === AppointmentStatus.NAO_VEIO).length,
        });
    }

    return {
        general: {
            appointmentsThisMonth,
            appointmentsLastMonth,
            totalScheduled,
            totalAttended,
            totalNoShow,
            totalCancelled,
            attendanceRate,
            noShowRate
        },
        automation: automationMetrics,
        doctorStats,
        topProcedures,
        timeline
    };
  },

  getOwnerDashboardMetrics: async (): Promise<{ global: GlobalMetrics, clients: ClientHealthMetrics[], alerts: OwnerAlert[] }> => {
    await delay(300);
    
    // --- REAL DATA AGGREGATION ---
    const orgs = getStorage(STORAGE_KEYS.ORGS, initialOrganizations);
    const allAppts = getStorage(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
    const settings = getStorage(STORAGE_KEYS.CLINIC_SETTINGS, initialSettings);

    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const totalApptsThisMonth = allAppts.filter(a => a.date >= firstDayThisMonth && a.date <= lastDayThisMonth).length;

    // Calculate MRR (Based on actual subscription value)
    let mrr = 0;
    
    const clientMetrics: ClientHealthMetrics[] = orgs.map(org => {
        const orgAppts = allAppts.filter(a => a.clinicId === org.id);
        const orgSettings = settings.find(s => s.clinicId === org.id);
        
        // MRR Calculation: Use the stored value or fallback to estimate
        const orgValue = org.subscriptionValue !== undefined ? org.subscriptionValue : (org.accountType === AccountType.CLINICA ? 400 : 150);
        mrr += orgValue;

        // Metrics
        const monthAppts = orgAppts.filter(a => a.date >= firstDayThisMonth && a.date <= lastDayThisMonth);
        const totalScheduled = monthAppts.length; // Simplified for dashboard list
        const totalAttended = monthAppts.filter(a => a.status === AppointmentStatus.ATENDIDO).length;
        const totalNoShow = monthAppts.filter(a => a.status === AppointmentStatus.NAO_VEIO).length;
        
        // ✅ DYNAMIC CAPACITY CALCULATION (Fixing Zombie Data)
        // Estimate Capacity: 
        // Consultorio: 1 Doctor * 20 days * 15 slots = 300 slots/month
        // Clinica: Est. 5 Active Doctors * 20 days * 15 slots = 1500 slots/month
        const estimatedCapacity = org.accountType === AccountType.CONSULTORIO ? 300 : 1500;
        
        const availableSlots = Math.max(0, estimatedCapacity - totalScheduled);
        const occupancyRate = totalScheduled > 0 
            ? Math.min((totalScheduled / estimatedCapacity) * 100, 100) 
            : 0;

        const noShowRate = totalScheduled > 0 ? (totalNoShow / totalScheduled) * 100 : 0;
        
        // Health Score Logic
        let healthScore: 'healthy' | 'attention' | 'risk' = 'healthy';
        
        if (totalScheduled === 0) healthScore = 'risk';
        else if (noShowRate > 20 || occupancyRate < 10) healthScore = 'attention';

        return {
            clientId: org.id,
            clientName: org.name,
            accountType: org.accountType,
            lastUsed: new Date().toISOString(), // In real app, check audit logs
            appointmentsThisMonth: totalScheduled,
            automationsActive: !!orgSettings?.n8nWebhookUrl,
            healthScore,
            occupancyRate,
            monthlyScheduled: totalScheduled,
            growthVsLastMonth: 0, // Needs historical data
            availableSlots,
            noShowRate,
            webhookStatus: orgSettings?.n8nWebhookUrl ? 'healthy' : 'error',
            needsTrafficAnalysis: totalScheduled < 10,
            weeklyContacts: 0,
            weeklyScheduled: 0,
            weeklyAttended: 0,
            weeklyCancelled: 0,
            monthlyContacts: 0,
            monthlyAttended: totalAttended,
            monthlyCancelled: 0
        };
    });

    const alerts: OwnerAlert[] = clientMetrics.filter(c => c.healthScore === 'risk').map(c => ({
        id: `alert_${c.clientId}`,
        type: 'critical',
        clientName: c.clientName,
        title: 'Baixo Volume / Risco de Churn',
        message: 'Cliente com zero agendamentos neste mês.',
        actionType: 'CONTACT_PHONE',
        actionPayload: c.clientName
    }));

    return {
        global: {
            activeClients: orgs.length,
            totalClients: orgs.length,
            totalAppointmentsThisMonth: totalApptsThisMonth,
            growthRate: 0, // Needs history
            automationSuccessRate: 100,
            totalAutomationsSent: 0,
            mrr
        },
        clients: clientMetrics,
        alerts
    };
  }
};
