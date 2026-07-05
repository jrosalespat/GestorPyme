import { prisma } from '$lib/server/prisma.js';
import { fail, error, redirect } from '@sveltejs/kit';
import { TRANSICIONES } from '$lib/schemas/cotizacion.js';
import { pagoSchema } from '$lib/schemas/cotizacion.js';

// ── LOAD ───────────────────────────────────────────────────────────────────
/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  const cot = await prisma.cotizacion.findUnique({
    where: { id: params.id },
    include: {
      cliente:   { select: { id: true, nombre: true, empresa: true, email: true, telefono: true } },
      conceptos: { orderBy: { orden: 'asc' } },
      pagos:     { orderBy: { fechaPago: 'desc' } },
      historial: { orderBy: { createdAt: 'asc' } },
    }
  });

  if (!cot) throw error(404, 'Cotización no encontrada');

  // Serializar Decimals
  return {
    cot: {
      ...cot,
      subtotal:  Number(cot.subtotal),
      descuento: Number(cot.descuento),
      iva:       Number(cot.iva),
      total:     Number(cot.total),
      conceptos: cot.conceptos.map(c => ({
        ...c,
        cantidad:       Number(c.cantidad),
        precioUnitario: Number(c.precioUnitario),
        descuento:      Number(c.descuento),
        subtotal:       Number(c.subtotal),
      })),
      pagos: cot.pagos.map(p => ({
        ...p,
        monto: Number(p.monto),
      })),
      cobrado:   cot.pagos.reduce((acc, p) => acc + Number(p.monto), 0),
    },
    transicionesPermitidas: TRANSICIONES[cot.estado] ?? [],
  };
}

// ── ACTIONS ────────────────────────────────────────────────────────────────
/** @type {import('./$types').Actions} */
export const actions = {

  // ── Cambiar estado ───────────────────────────────────────────────────────
  cambiarEstado: async ({ params, request, locals }) => {
    const fd = await request.formData();
    const nuevoEstado = fd.get('nuevoEstado')?.toString();

    if (!nuevoEstado) return fail(400, { error: 'Estado requerido' });

    const cot = await prisma.cotizacion.findUnique({ where: { id: params.id } });
    if (!cot) return fail(404, { error: 'Cotización no encontrada' });

    // Validar transición permitida
    const permitidos = TRANSICIONES[cot.estado] ?? [];
    if (!permitidos.includes(nuevoEstado)) {
      return fail(400, {
        error: `Transición no permitida: ${cot.estado} → ${nuevoEstado}`
      });
    }

    const userId = locals.auth?.()?.userId ?? null;

    await prisma.$transaction([
      prisma.cotizacion.update({
        where: { id: params.id },
        data:  { estado: nuevoEstado }
      }),
      prisma.historialCot.create({
        data: {
          cotizacionId:   params.id,
          estadoAnterior: cot.estado,
          estadoNuevo:    nuevoEstado,
          cambiadoPor:    userId,
          nota: fd.get('nota')?.toString() || null,
        }
      })
    ]);

    // Placeholder email si pasa a ENVIADA
    if (nuevoEstado === 'ENVIADA') {
      console.log(`[Resend] Reenviar cotización ${cot.folio} al cliente (estado: ENVIADA)`);
      // TODO: await enviarCotizacion(cot.id);
    }

    return { success: true, flash: `Estado actualizado a ${nuevoEstado}` };
  },

  // ── Registrar pago ───────────────────────────────────────────────────────
  registrarPago: async ({ params, request }) => {
    const fd = await request.formData();

    const raw = {
      monto:      fd.get('monto')?.toString()      ?? '',
      metodoPago: fd.get('metodoPago')?.toString() ?? '',
      referencia: fd.get('referencia')?.toString() ?? '',
      notas:      fd.get('notas')?.toString()      ?? '',
      fechaPago:  fd.get('fechaPago')?.toString()  ?? '',
    };

    const result = pagoSchema.safeParse(raw);
    if (!result.success) {
      const errors = {};
      for (const [k, msgs] of Object.entries(result.error.flatten().fieldErrors)) {
        errors[k] = msgs[0];
      }
      return fail(400, { erroresPago: errors, valuesPago: raw });
    }

    const cot = await prisma.cotizacion.findUnique({
      where: { id: params.id },
      include: { pagos: { select: { monto: true } } }
    });
    if (!cot) return fail(404, { error: 'Cotización no encontrada' });

    const cobradoActual = cot.pagos.reduce((acc, p) => acc + Number(p.monto), 0);
    const totalCot      = Number(cot.total);
    const montoPago     = result.data.monto;

    await prisma.pago.create({
      data: {
        cotizacionId: params.id,
        monto:        montoPago,
        metodoPago:   result.data.metodoPago,
        referencia:   result.data.referencia || null,
        notas:        result.data.notas      || null,
        fechaPago:    new Date(result.data.fechaPago),
      }
    });

    // Auto-marcar PAGADA si ya se cubrió el total
    if (cobradoActual + montoPago >= totalCot && cot.estado === 'ACEPTADA') {
      await prisma.$transaction([
        prisma.cotizacion.update({ where: { id: params.id }, data: { estado: 'PAGADA' } }),
        prisma.historialCot.create({
          data: {
            cotizacionId:   params.id,
            estadoAnterior: 'ACEPTADA',
            estadoNuevo:    'PAGADA',
            nota:           'Marcada como PAGADA automáticamente al registrar pago completo',
          }
        })
      ]);
    }

    const nuevoCobrado = cobradoActual + montoPago;
    const saldoPendiente = Math.max(0, totalCot - nuevoCobrado);

    return { success: true, flash: 'Pago registrado correctamente.', saldoPendiente };
  },

  // ── Eliminar pago ─────────────────────────────────────────────────────────
  eliminarPago: async ({ params, request }) => {
    const fd    = await request.formData();
    const pagoId = fd.get('pagoId')?.toString();

    if (!pagoId) return fail(400, { error: 'ID de pago requerido' });

    // Verificar que la cotización existe y no está en estado PAGADA
    const cot = await prisma.cotizacion.findUnique({
      where: { id: params.id },
      include: { pagos: { select: { id: true, monto: true } } }
    });

    if (!cot) return fail(404, { error: 'Cotización no encontrada' });

    if (cot.estado === 'PAGADA') {
      return fail(400, { error: 'No se puede eliminar pagos de una cotización ya pagada' });
    }

    // Verificar que el pago pertenece a esta cotización
    const pago = cot.pagos.find(p => p.id === pagoId);
    if (!pago) return fail(404, { error: 'Pago no encontrado' });

    await prisma.pago.delete({ where: { id: pagoId } });

    // Recalcular saldo pendiente
    const cobradoNuevo = cot.pagos
      .filter(p => p.id !== pagoId)
      .reduce((acc, p) => acc + Number(p.monto), 0);
    const saldoPendiente = Math.max(0, Number(cot.total) - cobradoNuevo);

    return { success: true, flash: 'Pago eliminado.', saldoPendiente, _accion: 'eliminarPago' };
  },
};
