
export const normalizePhone = (phone: string): string => {
  // Removes all non-numeric characters
  // Example: "(11) 99999-9999" -> "11999999999"
  return phone.replace(/\D/g, '');
};

export const formatPhone = (phone: string): string => {
  if (!phone) return '';
  // Formats for display
  // Example: "11999999999" -> "(11) 99999-9999"
  const cleaned = normalizePhone(phone);
  
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
  }
  return phone;
};
