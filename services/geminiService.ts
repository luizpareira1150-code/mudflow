import { GoogleGenAI } from "@google/genai";
import { Patient, Appointment } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateSmartSummary = async (patient: Patient): Promise<string> => {
  if (!apiKey) return "API Key not configured. Please add GEMINI_API_KEY to your environment.";

  try {
    const prompt = `
      Act as a medical assistant. Generate a brief, professional 2-sentence clinical summary for a dashboard view for the following patient.
      Highlight their condition and the immediate next step.
      
      Patient Name: ${patient.name}
      Condition: ${patient.condition}
      Status: ${patient.status}
      Birth Date: ${patient.birthDate || 'N/A'}
      Next Step: ${patient.nextStep}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No summary available.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate summary at this time.";
  }
};

export const generateWebhookPayload = async (event: string, contextData: any): Promise<any> => {
  if (!apiKey) {
    // Fallback if no API key
    return {
      event,
      timestamp: new Date().toISOString(),
      data: contextData,
      mock: true,
      clinicId: 'ORG001'
    };
  }

  try {
    const prompt = `
      Generate a realistic JSON webhook payload for a medical CRM system integrating with N8N (Evolution API context).
      The structure should mimic the following interface:
      
      interface N8NWebhookPayload {
        event: string;
        data: {
            appointmentId?: string;
            doctorName?: string;
            patientName?: string;
            patientPhone?: string;
            reason?: string; 
            notes?: string;
            oldStatus?: string;
            newStatus?: string;
            date?: string;
            time?: string;
        };
        timestamp: string;
        clinicId: string; 
      }

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
    if (!apiKey) return "AI analysis requires API Key.";

    try {
        const prompt = `
            Analyze these recent clinic appointments and suggest a general operational improvement for the clinic managers in one short paragraph.
            Focus on status trends (e.g., high cancellation rates (NAO_VEIO), bottlenecks in 'EM_CONTATO').
            
            Appointments Data: ${JSON.stringify(appointments, (key, value) => {
                if (key === 'patientId' || key === 'clinicId') return undefined; // Remove IDs to save tokens
                return value;
            })}
        `;
         const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || "No analysis generated.";

    } catch (e) {
        console.error(e);
        return "Analysis unavailable.";
    }
}