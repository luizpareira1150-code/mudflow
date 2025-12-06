
import { User } from '../types';

/**
 * MONITORING FACADE SERVICE
 * 
 * Este serviço atua como uma camada de abstração para ferramentas de observabilidade
 * como Sentry, Datadog, PostHog, LogRocket, etc.
 * 
 * Vantagem: Se você quiser trocar o Sentry pelo Datadog no futuro, 
 * altera apenas este arquivo, e não o código inteiro.
 */

type LogLevel = 'info' | 'warning' | 'error' | 'critical';

interface ErrorContext {
  clinicId?: string;
  userId?: string;
  action?: string;
  [key: string]: any;
}

class MonitoringService {
  private isProduction = process.env.NODE_ENV === 'production';

  constructor() {
    // Inicialização de serviços externos (ex: Sentry.init) ficaria aqui
    if (this.isProduction) {
      console.log('[MONITORING] Production Mode Initialized');
    }
  }

  /**
   * Rastreia exceções e erros de código
   */
  trackError(error: Error, context?: ErrorContext) {
    // 1. Log no Console (Sempre útil, mesmo em prod para debug rápido se tiver acesso)
    console.group('🚨 [MONITORING] Exception Captured');
    console.error(error);
    console.table(context);
    console.groupEnd();

    // 2. Enviar para Sentry/External (Simulado)
    if (this.isProduction) {
      // Sentry.captureException(error, { extra: context });
    }
  }

  /**
   * Rastreia eventos de negócio (ex: "Botão Clicado", "Agendamento Criado")
   * Útil para Analytics (Mixpanel, PostHog)
   */
  trackEvent(eventName: string, properties?: Record<string, any>) {
    console.log(`📊 [ANALYTICS] ${eventName}`, properties);
    
    // if (this.isProduction) {
    //   PostHog.capture(eventName, properties);
    // }
  }

  /**
   * Rastreia métricas de performance (Latency, Success Rate)
   * Útil para Datadog/NewRelic
   */
  trackMetric(metricName: string, value: number, tags?: Record<string, string>) {
    // Ex: appointment_creation_latency: 150ms
    // Ex: webhook_success_rate: 1 (count)
    
    // Log visual para performance
    if (metricName.includes('latency') && value > 2000) {
      console.warn(`🐢 [PERFORMANCE] Slow Operation: ${metricName} took ${value.toFixed(2)}ms`, tags);
    } else {
      console.debug(`⚡ [METRIC] ${metricName}: ${value}`, tags);
    }
  }

  /**
   * Identifica o usuário para sessão de log
   */
  setUser(user: User) {
    // Sentry.setUser({ id: user.id, email: user.email });
    // LogRocket.identify(user.id, { name: user.name });
    console.log('[MONITORING] User Context Set:', user.username);
  }
}

export const monitoringService = new MonitoringService();
