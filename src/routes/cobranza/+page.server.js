import { prisma } from '$lib/server/prisma.js';
import { fail } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
  const auth = typeof locals.auth === 'function' ? locals.auth() : null;
  const userId = auth?.userId;

  // Traer cotizaciones en estados que pueden tener saldo pendiente
  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      estado: { in: ['ENVIADA', 'ACEPTADA', 'VENCIDA'] }
    },
    include: {
      cliente: { select: { id: true, nombre: true, empresa: true, email: true } },
      pagos:   { select: { monto: true } }
    },
    orderBy: { fechaEmision: 'asc' } // las más antiguas primero (mayor deuda)
  });

  const hoy = new Date();

  // Calcular saldo pendiente, días transcurridos y filtrar solo las con deuda
  const cartera = cotizaciones
    .map(c => {
      const totalCobrado  = c.pagos.reduce((acc, p) => acc + Number(p.monto), 0);
      const totalCot      = Number(c.total);
      const saldoPendiente = totalCot - totalCobrado;
      const fechaRef       = c.fechaEmision;
      const msTranscurridos = hoy - new Date(fechaRef);
      const diasTranscurridos = Math.floor(msTranscurridos / (1000 * 60 * 60 * 24));

      return {
        id:              c.id,
        folio:           c.folio,
        estado:          c.estado,
        cliente:         c.cliente,
        fechaEmision:    c.fechaEmision,
        fechaVence:      c.fechaVence,
        total:           totalCot,
        cobrado:         totalCobrado,
        saldoPendiente,
        diasTranscurridos,
      };
    })
    .filter(c => c.saldoPendiente > 0.009) // más de 1 centavo pendiente
    .sort((a, b) => b.diasTranscurridos - a.diasTranscurridos);

  const totalCartera = cartera.reduce((acc, c) => acc + c.saldoPendiente, 0);

  let historialEvaluaciones = [];
  if (userId) {
    try {
      historialEvaluaciones = await prisma.$queryRaw`
        SELECT e.id, e.calificacion, e.feedback_ia, e.fecha_practica, c.titulo as escenario_titulo
        FROM evaluaciones_cobranza e
        JOIN escenarios_cobranza c ON e.escenario_id = c.id
        WHERE e.usuario_id = ${userId}
        ORDER BY e.fecha_practica DESC
        LIMIT 5;
      `;
    } catch (dbError) {
      console.error("Error al obtener historial de evaluaciones:", dbError);
    }
  }

  return { cartera, totalCartera, historialEvaluaciones };
}

/** @type {import('./$types').Actions} */
export const actions = {
  enviarRecordatorio: async ({ request }) => {
    const fd = await request.formData();
    const cotizacionId = fd.get('cotizacionId')?.toString();
    const emailCliente = fd.get('emailCliente')?.toString();
    const nombreCliente = fd.get('nombreCliente')?.toString();
    const folio        = fd.get('folio')?.toString();
    const pendiente    = fd.get('pendiente')?.toString();

    if (!cotizacionId || !emailCliente) {
      return fail(400, { error: 'Datos insuficientes para enviar recordatorio' });
    }

    // TODO: Implementar envío real con Resend en siguiente sprint
    console.log(
      `[Resend] Recordatorio de pago → ${emailCliente}`,
      { cotizacionId, folio, pendiente, nombreCliente }
    );

    // Placeholder: simular éxito
    return {
      success: true,
      flash:   `Recordatorio enviado a ${emailCliente}`,
      recordatorioId: cotizacionId,
    };
  }
};
