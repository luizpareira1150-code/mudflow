
/**
 * Security Utility: Input Sanitizer (Defense-in-Depth)
 * 
 * Prevents Stored XSS (Cross-Site Scripting) using a multi-layer approach:
 * 1. Pre-stripping: Removes high-risk tags (script, iframe, object) via Regex.
 * 2. Parsing: Uses DOMParser to safely extract only text content.
 * 3. Protocol Blocking: Prevents 'javascript:' URIs.
 */

export const sanitizeInput = (input: string | undefined | null): string => {
  if (!input) return '';
  if (typeof input !== 'string') return String(input);

  // Layer 1: Protocol Blocking (Prevent javascript: links)
  // This is crucial if the output is ever used in <a href="...">
  if (/^\s*javascript:/i.test(input)) {
    return "";
  }

  // Layer 2: Aggressive Tag Stripping (Regex)
  // Removes entire blocks of dangerous tags to prevent DOMParser exploits (mXSS)
  // flags: g (global), i (insensitive)
  let safeText = input
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
    .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "")
    .replace(/<object\b[^>]*>([\s\S]*?)<\/object>/gim, "")
    .replace(/<embed\b[^>]*>([\s\S]*?)<\/embed>/gim, "")
    .replace(/<form\b[^>]*>([\s\S]*?)<\/form>/gim, "")
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");

  // Layer 3: Contextual Sanitization (DOMParser)
  // Extracts only text content, effectively neutralizing all HTML entities and remaining tags.
  if (typeof DOMParser !== 'undefined') {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(safeText, 'text/html');
        return doc.body.textContent || "";
    } catch (e) {
        console.error("DOMParser sanitization failed, falling back to regex strip", e);
        // Fallback: Strip all remaining angle brackets if DOMParser fails
        return safeText.replace(/<[^>]*>/g, '');
    }
  }

  // Environment Fallback (e.g., SSR)
  // Just strip brackets to be safe
  return safeText.replace(/<[^>]*>/g, '');
};
