import { z } from 'zod';

export const clienteSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre es requerido' })
    .min(2, 'Mínimo 2 caracteres')
    .max(100, 'Máximo 100 caracteres')
    .trim(),

  empresa: z
    .string()
    .max(100, 'Máximo 100 caracteres')
    .trim()
    .optional()
    .or(z.literal('')),

  rfc: z
    .string()
    .trim()
    .transform(v => v.toUpperCase())   // normalizar ANTES de validar
    .refine(
      v => v === '' || /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(v),
      { message: 'RFC inválido. Formato esperado: 4 letras + 6 dígitos + 3 alfanuméricos (ej. XAXX010101000)' }
    )
    .optional()
    .or(z.literal('')),

  email: z
    .string({ required_error: 'El correo es requerido' })
    .email('Correo electrónico inválido')
    .max(150, 'Máximo 150 caracteres')
    .trim()
    .toLowerCase(),

  telefono: z
    .string()
    .max(20, 'Máximo 20 caracteres')
    .trim()
    .optional()
    .or(z.literal('')),

  direccion: z
    .string()
    .max(300, 'Máximo 300 caracteres')
    .trim()
    .optional()
    .or(z.literal('')),

  notas: z
    .string()
    .max(1000, 'Máximo 1000 caracteres')
    .trim()
    .optional()
    .or(z.literal(''))
});

/**
 * Parsea FormData y devuelve { data, errors }.
 * data es null si hay errores.
 * @param {FormData} formData
 */
export function parseClienteForm(formData) {
  const raw = {
    nombre:    formData.get('nombre')?.toString().trim()              ?? '',
    empresa:   formData.get('empresa')?.toString().trim()             ?? '',
    // Normalizar RFC a mayúsculas en el servidor también
    rfc:       formData.get('rfc')?.toString().trim().toUpperCase()   ?? '',
    email:     formData.get('email')?.toString().trim().toLowerCase() ?? '',
    telefono:  formData.get('telefono')?.toString().trim()            ?? '',
    direccion: formData.get('direccion')?.toString().trim()           ?? '',
    notas:     formData.get('notas')?.toString().trim()               ?? '',
  };

  const result = clienteSchema.safeParse(raw);

  if (!result.success) {
    const errors = {};
    for (const [field, msgs] of Object.entries(result.error.flatten().fieldErrors)) {
      errors[field] = msgs[0]; // primer error por campo
    }
    return { data: null, errors, values: raw };
  }

  return { data: result.data, errors: null, values: raw };
}
