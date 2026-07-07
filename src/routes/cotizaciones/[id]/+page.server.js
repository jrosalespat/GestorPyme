import { prisma } from '$lib/server/prisma.js';
import { fail, error, redirect } from '@sveltejs/kit';
import { TRANSICIONES } from '$lib/schemas/cotizacion.js';
import { pagoSchema } from '$lib/schemas/cotizacion.js';
import { sendEmail } from '$lib/server/resend.js';

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

    const cot = await prisma.cotizacion.findUnique({
      where: { id: params.id },
      include: { cliente: true, conceptos: true }
    });
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

    // Enviar email si pasa a ENVIADA
    if (nuevoEstado === 'ENVIADA' && cot.cliente?.email) {
      const formattedTotal = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: cot.moneda || 'MXN'
      }).format(Number(cot.total));

      const formattedFecha = cot.fechaVence ? new Date(cot.fechaVence).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'No especificada';

      const formatCurrency = (val) => new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: cot.moneda || 'MXN'
      }).format(Number(val));

      const conceptsHtmlRows = cot.conceptos.map(c => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px; text-align: left; font-size: 14px; color: #374151;">${c.descripcion}</td>
          <td style="padding: 8px; text-align: left; font-size: 14px; color: #374151;">${c.cantidad}</td>
          <td style="padding: 8px; text-align: left; font-size: 14px; color: #374151;">${formatCurrency(c.subtotal)}</td>
        </tr>
      `).join('');

      const emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 25px;">
            <h1 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.05em;">GestorPyme</h1>
            <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">Cotización de servicios / productos</p>
          </div>
          
          <h2 style="color: #1f2937; font-size: 20px; margin-top: 0; font-weight: 600;">Estimado/a ${cot.cliente.nombre},</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #4b5563; margin-bottom: 20px;">
            Es un placer saludarle. Le compartimos los detalles de la cotización <strong>${cot.folio}</strong> que hemos preparado para usted.
          </p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; font-weight: 500;">Folio:</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${cot.folio}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; font-weight: 500;">Total:</td>
                <td style="padding: 6px 0; color: #10b981; font-size: 16px; font-weight: 700; text-align: right;">${formattedTotal}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; font-weight: 500;">Vencimiento:</td>
                <td style="padding: 6px 0; color: #dfc218; font-size: 14px; font-weight: 600; text-align: right;">${formattedFecha}</td>
              </tr>
            </table>
          </div>

          <h3 style="color: #1e3a8a; font-size: 16px; font-weight: 600; margin-top: 25px; margin-bottom: 10px;">Detalle de la Cotización</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569;">Concepto/Descripción</th>
                <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569; width: 80px;">Cantidad</th>
                <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569; width: 130px;">Subtotal/Importe</th>
              </tr>
            </thead>
            <tbody>
              ${conceptsHtmlRows}
            </tbody>
          </table>
          
          <p style="font-size: 15px; line-height: 1.6; color: #4b5563;">
            Para revisar el detalle completo, aceptar o rechazar esta cotización, por favor ingrese a nuestro portal. Si tiene alguna duda o requiere modificaciones, por favor contáctenos a través de nuestros canales oficiales.
          </p>
          
          <div style="margin-top: 35px; border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">Este es un correo automático enviado por <strong>GestorPyme</strong>.</p>
            <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} GestorPyme. Todos los derechos reservados.</p>
          </div>
        </div>
      `;

      await sendEmail({
        to: cot.cliente.email,
        subject: `Nueva Cotización ${cot.folio} - GestorPyme`,
        html: emailHtml
      });
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
