import { prisma } from '$lib/server/prisma.js';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  const hoy   = new Date();
  const año   = hoy.getFullYear();
  const mes   = hoy.getMonth(); // 0-based

  const inicioMes = new Date(año, mes, 1);
  const finMes    = new Date(año, mes + 1, 0, 23, 59, 59);

  // ── Consultas paralelas ─────────────────────────────────────────────────
  const [
    cotizacionesMes,
    pagosMes,
    cotizacionesPendientes,
    cotizacionesActivas,
    pagosUltimos6Meses,
    todasCotizaciones,
    clientesConPendiente,
    ultimasCotizaciones,
  ] = await Promise.all([

    // KPI 1: Total facturado este mes (no BORRADOR)
    prisma.cotizacion.findMany({
      where: {
        createdAt: { gte: inicioMes, lte: finMes },
        estado:    { not: 'BORRADOR' }
      },
      select: { total: true }
    }),

    // KPI 2: Total cobrado este mes
    prisma.pago.findMany({
      where: { fechaPago: { gte: inicioMes, lte: finMes } },
      select: { monto: true }
    }),

    // KPI 3: Cartera pendiente (ENVIADA o ACEPTADA con saldo)
    prisma.cotizacion.findMany({
      where: { estado: { in: ['ENVIADA', 'ACEPTADA', 'VENCIDA'] } },
      select: { total: true, pagos: { select: { monto: true } } }
    }),

    // KPI 4: Cotizaciones activas (ENVIADA | ACEPTADA)
    prisma.cotizacion.count({
      where: { estado: { in: ['ENVIADA', 'ACEPTADA'] } }
    }),

    // Gráfica 1: Pagos de los últimos 6 meses
    prisma.pago.findMany({
      where: {
        fechaPago: {
          gte: new Date(año, mes - 5, 1)
        }
      },
      select: { monto: true, fechaPago: true }
    }),

    // Gráfica 2: Cotizaciones por estado
    prisma.cotizacion.findMany({
      select: { estado: true }
    }),

    // Top 3 clientes con mayor pendiente
    prisma.cotizacion.findMany({
      where: { estado: { in: ['ENVIADA', 'ACEPTADA', 'VENCIDA'] } },
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        pagos:   { select: { monto: true } }
      }
    }),

    // Últimas 5 cotizaciones — solo select, sin include
    prisma.cotizacion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id:        true,
        folio:     true,
        estado:    true,
        total:     true,
        createdAt: true,
        cliente:   { select: { nombre: true } }
      }
    }),
  ]);

  // ── Calcular KPIs ──────────────────────────────────────────────────────
  const totalFacturadoMes = cotizacionesMes.reduce((a, c) => a + Number(c.total), 0);
  const totalCobradoMes   = pagosMes.reduce((a, p) => a + Number(p.monto), 0);
  const carteraPendiente  = cotizacionesPendientes.reduce((a, c) => {
    const cobrado = c.pagos.reduce((s, p) => s + Number(p.monto), 0);
    return a + Math.max(0, Number(c.total) - cobrado);
  }, 0);

  // ── Gráfica 1: Ingresos por mes (últimos 6 meses) ─────────────────────
  const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const mesesLabels = [];
  const ingresosPorMes = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(año, mes - i, 1);
    const etiqueta = `${MESES_ES[d.getMonth()]} ${d.getFullYear()}`;
    mesesLabels.push(etiqueta);

    const suma = pagosUltimos6Meses
      .filter(p => {
        const fp = new Date(p.fechaPago);
        return fp.getMonth() === d.getMonth() && fp.getFullYear() === d.getFullYear();
      })
      .reduce((acc, p) => acc + Number(p.monto), 0);

    ingresosPorMes.push(suma);
  }

  // ── Gráfica 2: Cotizaciones por estado ────────────────────────────────
  const estadoCount = {};
  for (const c of todasCotizaciones) {
    estadoCount[c.estado] = (estadoCount[c.estado] ?? 0) + 1;
  }
  const cotizacionesPorEstado = Object.entries(estadoCount).map(([estado, count]) => ({
    estado, count
  }));

  // ── Top 3 clientes con mayor pendiente ────────────────────────────────
  const pendientePorCliente = {};

  for (const cot of clientesConPendiente) {
    const cobrado = cot.pagos.reduce((a, p) => a + Number(p.monto), 0);
    const pendiente = Math.max(0, Number(cot.total) - cobrado);
    if (!pendiente) continue;

    const cid = cot.cliente.id;
    if (!pendientePorCliente[cid]) {
      pendientePorCliente[cid] = {
        id:       cot.cliente.id,
        nombre:   cot.cliente.nombre,
        empresa:  cot.cliente.empresa,
        pendiente: 0
      };
    }
    pendientePorCliente[cid].pendiente += pendiente;
  }

  const topClientes = Object.values(pendientePorCliente)
    .sort((a, b) => b.pendiente - a.pendiente)
    .slice(0, 3);

  return {
    kpis: {
      totalFacturadoMes,
      totalCobradoMes,
      carteraPendiente,
      cotizacionesActivas,
    },
    grafica1: { labels: mesesLabels, datos: ingresosPorMes },
    grafica2: cotizacionesPorEstado,
    ultimasCotizaciones: ultimasCotizaciones.map(c => ({
      ...c,
      total: Number(c.total),
    })),
    topClientes,
  };
}
