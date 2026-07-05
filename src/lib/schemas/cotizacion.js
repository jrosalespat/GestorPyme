import { z } from 'zod';

// ── Transiciones de estado permitidas ───────────────────────────────────────
export const TRANSICIONES = {
  BORRADOR:   ['ENVIADA'],
  ENVIADA:    ['ACEPTADA', 'RECHAZADA', 'BORRADOR'],
  ACEPTADA:   ['PAGADA', 'VENCIDA'],
  RECHAZADA:  [],
  VENCIDA:    ['BORRADOR'],
  PAGADA:     [],
};

// ── Colores de badge por estado ─────────────────────────────────────────────
export const ESTADO_CONFIG = {
  BORRADOR:   { label: 'Borrador',   bg: 'rgba(139,143,168,.15)', color: '#8b8fa8', border: 'rgba(139,143,168,.3)' },
  ENVIADA:    { label: 'Enviada',    bg: 'rgba(251,191,36,.12)',  color: '#fbbf24', border: 'rgba(251,191,36,.3)' },
  ACEPTADA:   { label: 'Aceptada',   bg: 'rgba(52,211,153,.12)', color: '#34d399', border: 'rgba(52,211,153,.3)' },
  RECHAZADA:  { label: 'Rechazada',  bg: 'rgba(248,113,113,.12)',color: '#f87171', border: 'rgba(248,113,113,.3)' },
  VENCIDA:    { label: 'Vencida',    bg: 'rgba(251,146,60,.12)', color: '#fb923c', border: 'rgba(251,146,60,.3)' },
  PAGADA:     { label: 'Pagada',     bg: 'rgba(45,212,191,.12)', color: '#2dd4bf', border: 'rgba(45,212,191,.3)' },
};

// ── Schema de un concepto individual ────────────────────────────────────────
export const conceptoSchema = z.object({
  descripcion:    z.string().min(1, 'La descripción es requerida').max(500).trim(),
  cantidad:       z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  unidad:         z.string().max(30).trim().default('pieza'),
  precioUnitario: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  descuento:      z.coerce.number().min(0).max(100).default(0),
});

// ── Schema principal de la cotización ───────────────────────────────────────
export const cotizacionSchema = z.object({
  clienteId:  z.string().min(1, 'Selecciona un cliente'),
  notas:      z.string().max(2000).trim().optional().or(z.literal('')),
  terminos:   z.string().max(2000).trim().optional().or(z.literal('')),
  validezDias: z.coerce.number().int().min(1).max(365).default(30),
  moneda:     z.enum(['MXN', 'USD']).default('MXN'),
  aplicaIva:  z.enum(['si', 'no']).default('si'),
  estado:     z.enum(['BORRADOR', 'ENVIADA']).default('BORRADOR'),
  conceptos:  z.array(conceptoSchema).min(1, 'Agrega al menos un concepto'),
});

// ── Parser de FormData para la acción de guardar ────────────────────────────
/**
 * Extrae y parsea los datos de un formulario de cotización.
 * Los conceptos se serializan como campos indexados:
 *   desc_0, qty_0, unit_0, price_0, disc_0 …
 * @param {FormData} fd
 */
export function parseCotizacionForm(fd) {
  // Detectar cuántos conceptos hay
  const conceptos = [];
  let i = 0;
  while (fd.has(`desc_${i}`)) {
    conceptos.push({
      descripcion:    fd.get(`desc_${i}`)?.toString().trim()  ?? '',
      cantidad:       fd.get(`qty_${i}`)?.toString()          ?? '1',
      unidad:         fd.get(`unit_${i}`)?.toString().trim()  ?? 'pieza',
      precioUnitario: fd.get(`price_${i}`)?.toString()        ?? '0',
      descuento:      fd.get(`disc_${i}`)?.toString()         ?? '0',
    });
    i++;
  }

  const raw = {
    clienteId:   fd.get('clienteId')?.toString()   ?? '',
    notas:       fd.get('notas')?.toString()        ?? '',
    terminos:    fd.get('terminos')?.toString()     ?? '',
    validezDias: fd.get('validezDias')?.toString()  ?? '30',
    moneda:      fd.get('moneda')?.toString()        ?? 'MXN',
    aplicaIva:   fd.get('aplicaIva')?.toString()    ?? 'si',
    estado:      fd.get('estado')?.toString()        ?? 'BORRADOR',
    conceptos,
  };

  const result = cotizacionSchema.safeParse(raw);

  if (!result.success) {
    const errors = {};
    const flat = result.error.flatten();
    // errores de campos raíz
    for (const [k, msgs] of Object.entries(flat.fieldErrors)) {
      errors[k] = msgs[0];
    }
    // errores de conceptos (nested)
    if (flat.fieldErrors.conceptos) errors.conceptos = flat.fieldErrors.conceptos[0];
    return { data: null, errors, values: raw };
  }

  return { data: result.data, errors: null, values: raw };
}

// ── Schema de pago ───────────────────────────────────────────────────────────
export const pagoSchema = z.object({
  monto:      z.coerce.number().positive('El monto debe ser mayor a 0'),
  metodoPago: z.enum(['EFECTIVO','TRANSFERENCIA','TARJETA_CREDITO','TARJETA_DEBITO','CHEQUE','OTRO']),
  referencia: z.string().max(100).trim().optional().or(z.literal('')),
  notas:      z.string().max(500).trim().optional().or(z.literal('')),
  fechaPago:  z.string().min(1, 'La fecha de pago es requerida'),
});
