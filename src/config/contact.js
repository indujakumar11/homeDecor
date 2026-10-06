// WhatsApp contact number for the floating "Chat on WhatsApp" button.
// Set VITE_WHATSAPP_NUMBER in .env (gitignored) — never hardcode a number
// here. Vite reads it at startup, so restart the dev server after changing it.
// Normalized to digits only, which is the format wa.me expects (country code
// + number, no "+", spaces, hyphens or brackets), e.g. 91XXXXXXXXXX.
export const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '');

// Returns null when no number is configured, so callers can render nothing
// instead of a broken https://wa.me/?text=... link.
export function getWhatsAppUrl(message) {
  if (!WHATSAPP_NUMBER) return null;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Opens a WhatsApp chat pre-filled with `message`, for form submissions.
// Must be called synchronously from the submit handler — after a delay the
// user gesture is lost and the new tab is blocked as a popup. If the browser
// blocks it anyway, WhatsApp opens in the current tab instead. Returns false
// (and opens nothing) when no number is configured.
export function openWhatsApp(message) {
  const url = getWhatsAppUrl(message);
  if (!url) return false;
  const waWindow = window.open(url, '_blank');
  if (waWindow) {
    waWindow.opener = null;
  } else {
    window.location.href = url;
  }
  return true;
}
