
export const validateCPF = (cpf: string): boolean => {
  // Remove non-numeric characters
  const cleaned = cpf.replace(/\D/g, '');
  
  // Check length
  if (cleaned.length !== 11) return false;
  
  // Check for repeated digits (e.g. 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validate verification digits
  let sum = 0;
  let remainder;
  
  // First digit
  for (let i = 1; i <= 9; i++) 
    sum = sum + parseInt(cleaned.substring(i-1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cleaned.substring(9, 10))) return false;
  
  // Second digit
  sum = 0;
  for (let i = 1; i <= 10; i++) 
    sum = sum + parseInt(cleaned.substring(i-1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cleaned.substring(10, 11))) return false;
  
  return true;
};

export const formatCPF = (cpf: string): string => {
  if (!cpf) return '';
  // Formats for display: "12345678900" -> "123.456.789-00"
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return `${cleaned.slice(0,3)}.${cleaned.slice(3,6)}.${cleaned.slice(6,9)}-${cleaned.slice(9)}`;
};

export const normalizeCPF = (cpf: string): string => {
  return cpf.replace(/\D/g, '');
};
