// Enlaces wa.me. El número se configura en el panel (Configuración de la tienda → WhatsApp).
export function whatsappHref(number: string, message?: string) {
  const digits = String(number || '').replace(/\D/g, '')
  if (!/^\d{8,15}$/.test(digits)) return ''
  const text = message?.trim()
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
