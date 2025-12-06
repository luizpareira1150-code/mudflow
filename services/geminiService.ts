
import { GoogleGenAI } from "@google/genai";
import { Patient, Appointment } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateSmartSummary = async (patient: Patient, appointments: Appointment[]): Promise<string> => {
  if (!ai) {
    const total = appointments.length;
    const attended = appointments.filter(a => a.status === 'ATENDIDO').length;
    const noShow = appointments.filter(a => a.status === 'NAO_VEIO').length;
    
    return `📋 **Perfil Operacional do Paciente**

• **Histórico:** ${attended} presenças / ${noShow} faltas.
• **Taxa de Comparecimento:** ${(total > 0 ? (attended/total * 100) : 0).toFixed(0)}%

💡 **Nota:** Dados insuficientes para gerar um perfil comportamental completo. Continue agendando para alimentar a IA.`;
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Resumo indisponível no momento.";
  } catch (error) {
    console.error("Gemini API Error:", error);
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
      Return ONLY the JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (text) {
        return JSON.parse(text);
    }
    return { error: "Empty response" };
    
  } catch (error) {
    console.error("Gemini Payload Gen Error:", error);
    return {
      event,
      timestamp: new Date().toISOString(),
      data: contextData,
      note: "Generated via fallback (AI error)"
    };
  }
};

export const analyzeRecoveryTrend = async (appointments: Appointment[]): Promise<string> => {
    if (!ai) {
        return `📊 **Aguardando Dados**

O sistema precisa de mais agendamentos reais para gerar insights operacionais válidos.

💡 **Dica:** Configure seus horários e comece a agendar pacientes para desbloquear a análise de gargalos e sugestões de otimização.`;
    }

    try {
        const prompt = `
            Analise estes agendamentos recentes da clínica e sugira uma melhoria operacional geral para os gestores em um parágrafo curto.
            Foque em eficiência de agenda, horários de pico e taxas de cancelamento.
            NÃO mencione tratamentos médicos ou diagnósticos.
            Responda em Português do Brasil.
            
            Dados de Agendamentos: ${JSON.stringify(appointments, (key, value) => {
                if (key === 'patientId' || key === 'clinicId') return undefined; // Remove IDs to save tokens
                return value;
            })}
        `;
         const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || "Análise não gerada.";

    } catch (e) {
        console.error(e);
        return "Análise indisponível.";
    }
}
