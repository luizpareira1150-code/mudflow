
import { DashboardMetrics, AppointmentStatus, GlobalMetrics, ClientHealthMetrics, OwnerAlert, AccountType } from '../types';
import { appointmentService } from './appointmentService';
import { doctorService } from './doctorService';
import { delay } from './storage';

export const analyticsService = {
  getClinicMetrics: async (clinicId: string, startDate?: string, endDate?: string): Promise<DashboardMetrics> => {
    await delay(300);
    
    // We fetch all appointments because mock service doesn't support advanced filtering yet
    const now = new Date();
    const allAppts = await appointmentService.getAppointments(clinicId, now.toISOString().split('T')[0]); 
    const doctors = await doctorService.getDoctors(clinicId);
    
    // Simulating aggregation from "Database"
    const storageKey = 'medflow_appointments';
    const stored = localStorage.getItem(storageKey);
    let rawAppts: any[] = stored ? JSON.parse(stored) : [];
    
    // Filter by clinic
    rawAppts = rawAppts.filter(a => a.clinicId === clinicId);

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

    // 2. General Status Breakdown (All Sources)
    const statusBreakdown = {
        EM_CONTATO: rawAppts.filter(a => a.status === AppointmentStatus.EM_CONTATO).length,
        AGENDADO: rawAppts.filter(a => a.status === AppointmentStatus.AGENDADO).length,
        ATENDIDO: rawAppts.filter(a => a.status === AppointmentStatus.ATENDIDO).length,
        NAO_VEIO: rawAppts.filter(a => a.status === AppointmentStatus.NAO_VEIO).length,
        BLOQUEADO: rawAppts.filter(a => a.status === AppointmentStatus.BLOQUEADO).length,
    };

    const totalCancelled = Math.floor(appointmentsThisMonth * 0.05); // Mock 5% cancellation

    const totalScheduled = statusBreakdown.AGENDADO + statusBreakdown.ATENDIDO + statusBreakdown.NAO_VEIO;
    const totalAttended = statusBreakdown.ATENDIDO;
    const totalNoShow = statusBreakdown.NAO_VEIO;

    const attendanceRate = totalScheduled > 0 ? (totalAttended / totalScheduled) * 100 : 0;
    const noShowRate = totalScheduled > 0 ? (totalNoShow / totalScheduled) * 100 : 0;

    // --- AUTOMATION SPECIFIC CALCULATIONS ---
    const automatedSubsetSize = Math.floor(totalScheduled * 0.45); 
    const interactions = Math.floor(automatedSubsetSize * 1.5); // Leads
    const scheduledAuto = automatedSubsetSize;
    const attendedAuto = Math.floor(scheduledAuto * 0.85); // 85% attendance on automated
    
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
    // Mock Data for Owner Dashboard
    // In a real app, this would iterate over all clinics/tenants
    return {
        global: {
            activeClients: 12,
            totalClients: 12,
            totalAppointmentsThisMonth: 1250,
            growthRate: 15,
            automationSuccessRate: 92,
            totalAutomationsSent: 3400,
            mrr: 4500
        },
        clients: [
            {
                clientId: 'org_clinica_001',
                clientName: 'Clínica Multi-Médicos',
                accountType: AccountType.CLINICA,
                lastUsed: new Date().toISOString(),
                appointmentsThisMonth: 450,
                automationsActive: true,
                healthScore: 'healthy',
                occupancyRate: 85,
                monthlyScheduled: 450,
                growthVsLastMonth: 12,
                availableSlots: 600,
                noShowRate: 5,
                webhookStatus: 'healthy',
                needsTrafficAnalysis: false,
                weeklyContacts: 120,
                weeklyScheduled: 90,
                weeklyAttended: 85,
                weeklyCancelled: 2,
                monthlyContacts: 500,
                monthlyAttended: 420,
                monthlyCancelled: 15
            },
            {
                clientId: 'org_consultorio_001',
                clientName: 'Consultório Dr. Solo',
                accountType: AccountType.CONSULTORIO,
                lastUsed: new Date(Date.now() - 86400000).toISOString(),
                appointmentsThisMonth: 120,
                automationsActive: false,
                healthScore: 'attention',
                occupancyRate: 60,
                monthlyScheduled: 120,
                growthVsLastMonth: -5,
                availableSlots: 200,
                noShowRate: 12,
                webhookStatus: 'error',
                needsTrafficAnalysis: true,
                weeklyContacts: 40,
                weeklyScheduled: 30,
                weeklyAttended: 25,
                weeklyCancelled: 3,
                monthlyContacts: 150,
                monthlyAttended: 100,
                monthlyCancelled: 10
            }
        ],
        alerts: [
            {
                id: 'alert_1',
                type: 'critical',
                clientName: 'Consultório Dr. Solo',
                title: 'Webhook Falhando',
                message: 'Integração N8N retornando 404 há 2 dias.',
                actionType: 'OPEN_CONFIG',
                actionPayload: 'org_consultorio_001'
            }
        ]
    };
  }
};
