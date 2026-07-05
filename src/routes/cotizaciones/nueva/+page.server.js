import { prisma } from '$lib/server/prisma.js';
import { fail, redirect } from '@sveltejs/kit';
import { parseCotizacionForm } from '$lib/schemas/cotizacion.js';

// ── LOAD: calcula el siguiente folio y carga clientes ──────────────────────
/** @type {import('./$types').PageServerLoad} */
export async function load() {
  const [clientes, ultimaCot] = await Promise.all([
    prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, empresa: true, email: true }
    }),
    prisma.cotizacion.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { folio: true }
    })
  ]);

  // Calcular siguiente folio: COT-YYYY-NNN
  const year = new Date().getFullYear();
  let seq = 1;
  if (ultimaCot?.folio) {
    const match = ultimaCot.folio.match(/(\d+)$/);
    if (match) seq = parseInt(match[1]) + 1;
  }
  const siguienteFolio = `COT-${year}-${String(seq).padStart(3, '0')}`;

  return { clientes, siguienteFolio };
}

// ── ACTIONS ────────────────────────────────────────────────────────────────
/** @type {import('./$types').Actions} */
export const actions = {

  guardar: async ({ request }) => {
    const fd = await request.formData();
    const { data, errors, values } = parseCotizacionForm(fd);

    if (errors) {
      return fail(400, { errors, values });
    }

    const { conceptos, aplicaIva, estado, clienteId, validezDias, moneda, notas, terminos } = data;

    // ── Calcular totales ─────────────────────────────────────────────────
    const subtotalBase = conceptos.reduce((acc, con) => {
      const sub = con.cantidad * con.precioUnitario * (1 - con.descuento / 100);
      return acc + sub;
    }, 0);

    const ivaVal      = aplicaIva === 'si' ? subtotalBase * 0.16 : 0;
    const totalVal    = subtotalBase + ivaVal;

    // ── Siguiente folio ──────────────────────────────────────────────────
    const ultimaCot = await prisma.cotizacion.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { folio: true }
    });
    const year = new Date().getFullYear();
    let seq = 1;
    if (ultimaCot?.folio) {
      const match = ultimaCot.folio.match(/(\d+)$/);
      if (match) seq = parseInt(match[1]) + 1;
    }
    const folio = `COT-${year}-${String(seq).padStart(3, '0')}`;

    // ── Fecha de vencimiento ─────────────────────────────────────────────
    const fechaVence = new Date();
    fechaVence.setDate(fechaVence.getDate() + validezDias);

    // ── Transacción: crear Cotizacion + Conceptos ────────────────────────
    const nueva = await prisma.$transaction(async (tx) => {
      const cot = await tx.cotizacion.create({
        data: {
          folio,
          clienteId,
          estado,
          subtotal:   subtotalBase,
          iva:        ivaVal,
          descuento:  0,
          total:      totalVal,
          moneda,
          validezDias,
          notas:      notas || null,
          terminos:   terminos || null,
          fechaVence,
          conceptos: {
            create: conceptos.map((con, idx) => {
              const sub = con.cantidad * con.precioUnitario * (1 - con.descuento / 100);
              return {
                descripcion:    con.descripcion,
                cantidad:       con.cantidad,
                unidad:         con.unidad || 'pieza',
                precioUnitario: con.precioUnitario,
                descuento:      con.descuento,
                subtotal:       sub,
                orden:          idx,
              };
            })
          }
        }
      });

      // Registrar en historial
      await tx.historialCot.create({
        data: {
          cotizacionId:  cot.id,
          estadoAnterior: null,
          estadoNuevo:   estado,
          nota: estado === 'ENVIADA' ? 'Cotización creada y enviada al cliente' : 'Cotización creada como borrador',
        }
      });

      return cot;
    });

    // ── Si ENVIADA → placeholder de email ───────────────────────────────
    if (estado === 'ENVIADA') {
      // TODO: implementar envío real con Resend en siguiente sprint
      console.log(`[Resend] Enviar cotización ${folio} al cliente ${clienteId}`);
    }

    redirect(303, `/cotizaciones/${nueva.id}`);
  }
};
