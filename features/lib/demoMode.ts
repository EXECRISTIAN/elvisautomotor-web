// Modo demostración: para mostrar la propuesta en una URL temporal antes de que el cliente la apruebe.
// DEMO_MODE=true  → banner visible, sitio no indexable y formularios públicos que no guardan datos.
// DEMO_PASSWORD   → (opcional) pide usuario/contraseña al entrar (autenticación básica HTTP).
export function isDemoMode() {
  return process.env.DEMO_MODE === 'true'
}

export const DEMO_SUBMISSION_MESSAGE =
  'Este es un sitio de demostración: los formularios no envían ni guardan datos. Para consultas reales comunícate por los canales oficiales.'
