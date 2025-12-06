
import { AgendaReleaseSchedule, AgendaReleaseType, DayOfWeek } from '../types';

const RELEASE_SCHEDULE_KEY = 'medflow_agenda_release_schedule';

class AgendaReleaseService {
  
  private getSchedules(): AgendaReleaseSchedule[] {
    const stored = localStorage.getItem(RELEASE_SCHEDULE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private setSchedules(schedules: AgendaReleaseSchedule[]) {
    localStorage.setItem(RELEASE_SCHEDULE_KEY, JSON.stringify(schedules));
  }

  async getSchedule(doctorId: string, organizationId: string): Promise<AgendaReleaseSchedule | null> {
    const schedules = this.getSchedules();
    return schedules.find(s => s.doctorId === doctorId && s.organizationId === organizationId) || null;
  }

  async saveSchedule(schedule: Omit<AgendaReleaseSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgendaReleaseSchedule> {
    const schedules = this.getSchedules();
    const existingIndex = schedules.findIndex(s => s.doctorId === schedule.doctorId && s.organizationId === schedule.organizationId);

    if (existingIndex >= 0) {
      const existing = schedules[existingIndex];
      const updated = {
        ...existing,
        ...schedule,
        updatedAt: new Date().toISOString()
      };
      schedules[existingIndex] = updated;
      this.setSchedules(schedules);
      return updated;
    } else {
      const newSchedule: AgendaReleaseSchedule = {
        ...schedule,
        id: `release_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      schedules.push(newSchedule);
      this.setSchedules(schedules);
      return newSchedule;
    }
  }

  /**
   * Verifica se uma data específica está liberada para agendamento
   */
  async isDateReleased(doctorId: string, organizationId: string, targetDate: string): Promise<{
    released: boolean;
    reason?: string;
    releaseDate?: string;
  }> {
    const schedule = await this.getSchedule(doctorId, organizationId);
    
    if (!schedule || !schedule.enabled || schedule.releaseType === AgendaReleaseType.ALWAYS_OPEN) {
      return { released: true };
    }

    const now = new Date();
    // Use target date at end of day to be permissive on same-day checks if needed, 
    // but typically we compare "Now" vs "Release Date".
    const target = new Date(targetDate + 'T00:00:00');

    switch (schedule.releaseType) {
      case AgendaReleaseType.WEEKLY_RELEASE:
        return this.checkWeeklyRelease(schedule, now, target);
      
      case AgendaReleaseType.MONTHLY_RELEASE:
        return this.checkMonthlyRelease(schedule, now, target);
      
      case AgendaReleaseType.CUSTOM_DATE:
        return this.checkCustomRelease(schedule, now, target);
      
      default:
        return { released: true };
    }
  }

  private checkWeeklyRelease(
    schedule: AgendaReleaseSchedule, 
    now: Date, 
    target: Date
  ): { released: boolean; reason?: string; releaseDate?: string } {
    
    if (!schedule.weeklyConfig) return { released: true };
    
    const { dayOfWeek, hour, advanceDays } = schedule.weeklyConfig;
    
    // Calcular quando a agenda dessa semana do 'target' foi/será liberada
    const targetWeekStart = new Date(target);
    targetWeekStart.setDate(target.getDate() - target.getDay()); // Domingo da semana alvo
    
    // Data de liberação baseada na semana do alvo
    const releaseDate = new Date(targetWeekStart);
    releaseDate.setDate(targetWeekStart.getDate() + dayOfWeek);
    
    const [releaseHour, releaseMinute] = hour.split(':').map(Number);
    releaseDate.setHours(releaseHour, releaseMinute, 0, 0);
    
    // Ajustar para a semana de liberação (ex: libera na segunda da semana anterior -> advanceDays)
    // Se advanceDays = 0, libera na própria semana.
    // Se advanceDays = 7, libera 1 semana antes.
    // Lógica correta: Release Date = (Target Week Start + Release Day) - Advance Days Offset logic is usually "Days before target".
    // Mas a especificação diz: "Ex: Abre segunda para quarta (2 dias antes)".
    
    // Simplificação: Vamos assumir que a configuração define "Em qual dia da semana a agenda abre" e "Quantos dias antes do alvo".
    // Mas a config pede "AdvanceDays".
    // Vamos usar a lógica: "A agenda para a data X abre na data Y".
    // Y = Data X - AdvanceDays.
    // MAS, a regra diz "Abre Semanalmente em dia específico".
    // Então: Agenda para a Semana X abre no dia Y da semana (X-1).
    
    // Vamos usar a lógica do Prompt: "Atende quarta, abre segunda 7h".
    // Isso significa que para a Quarta (Target), a liberação é na Segunda da MESMA semana.
    
    // Reajuste: Encontrar a "Segunda Feira" (Release Day) imediatamente anterior ao Target com base no AdvanceDays?
    // Não, a regra WEEKLY é fixa: "Toda Segunda feira abre a agenda para X dias a frente" ou "Para a semana seguinte".
    
    // Interpretação mais robusta:
    // A agenda para a semana do Target abre no ReleaseDay desta semana (ou semana anterior dependendo do advance).
    // Se advanceDays for pequeno (ex: 2), é na mesma semana.
    
    // Vamos calcular o Release Date exato para o Target Date específico.
    // Se Release é Segunda e Target é Quarta.
    // Release Date = Segunda feira da semana do Target.
    
    // Se Target for Domingo (inicio semana) e Release for Segunda:
    // A agenda de Domingo abriria na Segunda anterior?
    
    // Vamos fixar: A agenda para a Semana N é liberada no dia D da Semana (N - offset).
    // Onde offset é calculado pelo advanceDays.
    
    // Simplificando conforme pedido:
    // ReleaseDate é o dia da semana configurado na semana do alvo, menos semanas se necessário.
    // Mas o exemplo "Abre segunda para quarta" sugere mesma semana.
    
    const targetDayOfWeek = target.getDay();
    const daysDiff = targetDayOfWeek - dayOfWeek; // Se target Qua(3) e Release Seg(1), diff = 2.
    
    // A data de liberação exata para ESTE target específico
    const calculatedReleaseDate = new Date(target);
    calculatedReleaseDate.setDate(target.getDate() - daysDiff);
    
    // Se o target for antes do dia de release na semana (ex: target Terça, Release Quarta), 
    // então a liberação deve ter sido na semana anterior?
    // O parametro `advanceDays` ajuda a decidir.
    // Se advanceDays = 2. Target Quarta. Release deve ser 2 dias antes (Segunda).
    
    // Vamos usar `advanceDays` como a regra principal.
    // A data de liberação é Target - AdvanceDays? 
    // NÃO, porque a regra é "WEEKLY RELEASE", ou seja, abre em lote.
    
    // LÓGICA DE LOTE SEMANAL:
    // A agenda da semana inteira abre num dia específico.
    // Encontrar o início da semana do Target (Domingo).
    // A data de liberação é: InicioSemana + ReleaseDayOfWeek - (WeeksOffset * 7).
    // Onde WeeksOffset é derivado de advanceDays (ex: se advance > 7).
    
    const weeksOffset = Math.floor(advanceDays / 7);
    const releaseDateForBlock = new Date(targetWeekStart);
    releaseDateForBlock.setDate(releaseDateForBlock.getDate() + dayOfWeek - (weeksOffset * 7));
    releaseDateForBlock.setHours(releaseHour, releaseMinute, 0, 0);
    
    if (now >= releaseDateForBlock) {
      return { released: true };
    } else {
      return {
        released: false,
        reason: `Agenda semanal libera em ${releaseDateForBlock.toLocaleDateString('pt-BR')} às ${hour}`,
        releaseDate: releaseDateForBlock.toISOString()
      };
    }
  }

  private checkMonthlyRelease(
    schedule: AgendaReleaseSchedule,
    now: Date,
    target: Date
  ): { released: boolean; reason?: string; releaseDate?: string } {
    
    if (!schedule.monthlyConfig) return { released: true };
    
    const { releaseDay, fallbackToWeekday, hour, targetMonthOffset } = schedule.monthlyConfig;
    
    // Mês alvo do agendamento
    const targetYear = target.getFullYear();
    const targetMonth = target.getMonth();
    
    // Mês em que a agenda deveria ser liberada
    // Ex: Target Março (2). Offset 1. Release Fevereiro (1).
    let releaseMonth = targetMonth - targetMonthOffset;
    let releaseYear = targetYear;
    
    // Ajuste de ano
    while (releaseMonth < 0) {
        releaseMonth += 12;
        releaseYear -= 1;
    }
    
    // Data de liberação base
    let releaseDate = new Date(releaseYear, releaseMonth, releaseDay);
    
    // Se cair em fim de semana e fallback ativado
    if (fallbackToWeekday) {
      const day = releaseDate.getDay();
      if (day === 0) { // Domingo -> Sexta
        releaseDate.setDate(releaseDate.getDate() - 2);
      } else if (day === 6) { // Sábado -> Sexta
        releaseDate.setDate(releaseDate.getDate() - 1);
      }
    }
    
    const [releaseHour, releaseMinute] = hour.split(':').map(Number);
    releaseDate.setHours(releaseHour, releaseMinute, 0, 0);
    
    if (now >= releaseDate) {
      return { released: true };
    } else {
      return {
        released: false,
        reason: `Agenda mensal libera em ${releaseDate.toLocaleDateString('pt-BR')} às ${hour}`,
        releaseDate: releaseDate.toISOString()
      };
    }
  }

  private checkCustomRelease(
    schedule: AgendaReleaseSchedule,
    now: Date,
    target: Date
  ): { released: boolean; reason?: string; releaseDate?: string } {
    
    if (!schedule.customDates || schedule.customDates.length === 0) {
      return { released: true };
    }
    
    // Verifica se a data alvo cai em algum intervalo configurado
    for (const custom of schedule.customDates) {
      // Ajustar strings para objetos Date (comparação segura zerando horas)
      const start = new Date(custom.targetStartDate + 'T00:00:00');
      const end = new Date(custom.targetEndDate + 'T23:59:59');
      
      // Target dentro do range?
      if (target >= start && target <= end) {
        const releaseDate = new Date(custom.releaseDate + 'T00:00:00');
        // Adicionar hora padrão 00:00 se não especificado, ou tratar hora atual
        
        if (now >= releaseDate) {
          return { released: true };
        } else {
          return {
            released: false,
            reason: `Agenda especial libera em ${releaseDate.toLocaleDateString('pt-BR')}`,
            releaseDate: releaseDate.toISOString()
          };
        }
      }
    }
    
    // Se não cai em nenhum range customizado, assumimos liberado ou bloqueado?
    // Padrão: Se usar Custom Dates, datas fora dos ranges estão abertas ou fechadas?
    // Geralmente Custom Date é pra "Exceptions". Se não tá na lista, segue fluxo normal (aberto).
    return { released: true };
  }
}

export const agendaReleaseService = new AgendaReleaseService();
