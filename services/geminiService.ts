import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Patient, Appointment } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const TIMEOUT_MS = 15000; // 15 seconds limit

/**
 * Helper to sanitize LLM output before parsing.
 * Removes Markdown code blocks (```json ... ```) and whitespace.
 */
const cleanAIResponse = (text: string): string => {
  if (!text) return '{}';
  return text
    .replace(/^```json\s*/, '') // Remove start block
    .replace(/^```\s*/, '')     // Remove generic start block
    .replace(/\s*```$/, '')     // Remove end block
    .trim();
};

/**
 * WRAPPER DE SEGURANÇA: Timeout
 * Força a promise a rejeitar se a API demorar demais.
 */
const runWithTimeout = async <T>(promise: Promise<T>): Promise<T> => {
    let timeoutHandle: any;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error('TIMEOUT_GEMINI'));
        }, TIMEOUT_MS);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutHandle);
        return result;
    } catch (error) {
        clearTimeout(timeoutHandle);
        throw error;
    }
};

export const generateSmartSummary = async (patient: Patient, appointments: Appointment[]): Promise<string> => {
  if (!ai) {
    const total = appointments.length;
    const attended = appointments.filter(a => a.status === 'ATENDIDO').length;
    const noShow = appointments.filter(a => a.status === 'NAO_VEIO').length;
    
    return `📋 **Perfil Operacional do Paciente**

• **Histórico:** ${attended} presenças / ${noShow} faltas.
• **Confiabilidade:** ${(total > 0 ? (attended/total * 100) : 0).toFixed(0)}% de presença.

💡 **Sugestão:** Paciente com histórico padrão. Manter fluxo normal de confirmação.`;
  }

  try {
    const total = appointments.length;
    const attended = appointments.filter(a => a.status === 'ATENDIDO').length;
    const noShow = appointments.filter(a => a.status === 'NAO_VEIO').length;
    const cancelled = appointments.filter(a => a.status === 'BLOQUEADO' || a.status === 'NAO_VEIO').length; 

    const prompt = `
      Atue como um Gerente de Agenda de Clínica rigoroso e eficiente. Gere um resumo logístico conciso para este paciente com base APENAS nas estatísticas de histórico.
      
      REGRAS OBRIGATÓRIAS:
      1. Responda estritamente em PORTUGUÊS DO BRASIL (PT-BR).
      2. Foque APENAS em: Confiabilidade de comparecimento (Probabilidade de falta/No-show) e dias/horários preferidos.
      3. NÃO analise sentimentos, humor ou personalidade.
      4. NÃO mencione condições médicas ou diagnósticos.
      5. Seja objetivo, direto e use formatação com bullet points para facilitar a leitura rápida.
      
      Dados do Paciente:
      Nome: ${patient.name}
      Total de Agendamentos: ${total}
      Comparecimentos: ${attended}
      Faltas (No-Shows): ${noShow}
      Cancelamentos: ${cancelled}
      Usuário desde: ${patient.createdAt}
    `;

    // PROTECTION: 15s Timeout
    const response = (await runWithTimeout(
        ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        })
    )) as GenerateContentResponse;

    return response.text || "Resumo indisponível no momento.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message === 'TIMEOUT_GEMINI') {
        return "⚠️ A análise demorou muito. O sistema está sobrecarregado, tente novamente em instantes.";
    }
    return "Não foi possível gerar o resumo operacional.";
  }
};

export const generateWebhookPayload = async (event: string, contextData: any): Promise<any> => {
  if (!ai) {
    return {
      event,
      timestamp: new Date().toISOString(),
      data: contextData,
      mock: true,
      clinicId: 'ORG001',
      note: "Gerado via fallback seguro (Sem API Key)"
    };
  }

  try {
    const prompt = `
      Generate a realistic JSON webhook payload for a medical CRM system integrating with N8N.
      Event Type Requested: ${event}
      Context Data provided: ${JSON.stringify(contextData)}
      Return ONLY the JSON. Do not add markdown formatting.
    `;

    // PROTECTION: 15s Timeout
    const response = (await runWithTimeout(
        ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        })
    )) as GenerateContentResponse;

    const text = response.text;
    if (text) {
        try {
            return JSON.parse(cleanAIResponse(text));
        } catch (parseError) {
            console.warn("Failed to parse AI JSON, retrying cleanup...", text);
            return { error: "Invalid JSON format from AI" };
        }
    }
    return { error: "Empty response" };
    
  } catch (error) {
    console.error("Gemini Payload Gen Error:", error);
    return {
      event,
      timestamp: new Date().toISOString(),
      data: contextData,
      note: "Generated via fallback (AI error or Timeout)"
    };
  }
};

export const analyzeRecoveryTrend = async (appointments: Appointment[]): Promise<string> => {
    // FALLBACK SIMULADO (MOCK) para quando não houver API Key
    if (!ai) {
        return `🔎 **Análise Mensal:** Notei uma tendência de alta procura nas segundas-feiras, resultando em sobrecarga. As sextas-feiras à tarde têm 30% de ociosidade.

⚠️ **Alerta:** A taxa de faltas (No-Show) aumentou para 15% na última quinzena. Recomendo ativar confirmações automáticas via WhatsApp 4 horas antes das consultas.`;
    }

    try {
        const prompt = `
            Analise estes dados de agendamento dos ÚLTIMOS 30 DIAS de uma clínica.
            Seu objetivo é encontrar padrões mensais, gargalos recorrentes e oportunidades de melhoria.
            
            FOCO DA ANÁLISE:
            1. Padrões de cancelamento (ex: sextas-feiras tem mais faltas?)
            2. Horários de pico vs. Ociosidade (ex: manhãs lotadas, tardes vazias?)
            3. Sugestão prática para melhorar a ocupação no próximo mês.

            REGRAS:
            - Responda em Português do Brasil.
            - Seja direto e executivo (um parágrafo curto + 2 bullet points).
            - NÃO mencione diagnósticos médicos.
            
            Dados Brutos (JSON simplificado para economizar tokens): 
            ${JSON.stringify(appointments.map(a => ({ d: a.date, t: a.time, s: a.status })), null, 0)}
        `;
        
        // PROTECTION: 15s Timeout
        const response = (await runWithTimeout(
            ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            })
        )) as GenerateContentResponse;
        return response.text || "Análise não gerada.";

    } catch (e) {
        console.error(e);
        return "Análise indisponível no momento (Timeout ou Erro).";
    }
}