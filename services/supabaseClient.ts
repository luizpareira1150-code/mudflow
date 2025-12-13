
import { createClient } from '@supabase/supabase-js';

// As variáveis de ambiente devem ser configuradas no Vite
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

// Verificação de segurança para não quebrar o app Mock se as chaves não existirem
const isConfigured = supabaseUrl && supabaseAnonKey;

if (!isConfigured) {
    console.warn("⚠️ Supabase: Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas. O app continuará funcionando no modo Mock (LocalStorage).");
}

// Exporta o cliente apenas se configurado, caso contrário null
// Os serviços devem verificar se 'supabase' existe antes de usar.
export const supabase = isConfigured 
    ? createClient(supabaseUrl, supabaseAnonKey) 
    : null;