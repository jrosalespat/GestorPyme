<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { ESTADO_CONFIG } from '$lib/schemas/cotizacion.js';

  let { data } = $props();
  const { kpis, grafica1, grafica2, ultimasCotizaciones, topClientes } = data;

  // ── Helpers ────────────────────────────────
  function mxn(v) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN', maximumFractionDigits: 0
    }).format(v ?? 0);
  }

  function fmt(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  // ── KPI cards config ──────────────────────
  const KPIs = [
    {
      icon: '📈',
      label: 'Facturado este mes',
      valor: mxn(kpis.totalFacturadoMes),
      sub: 'Cotizaciones aprobadas en el mes',
      accent: 'purple',
    },
    {
      icon: '💳',
      label: 'Cobrado este mes',
      valor: mxn(kpis.totalCobradoMes),
      sub: 'Pagos registrados en el mes',
      accent: 'green',
    },
    {
      icon: '⏳',
      label: 'Cartera pendiente',
      valor: mxn(kpis.carteraPendiente),
      sub: 'Saldo por cobrar en cotizaciones activas',
      accent: 'yellow',
    },
    {
      icon: '📄',
      label: 'Cotizaciones activas',
      valor: kpis.cotizacionesActivas,
      sub: 'Enviadas o aprobadas',
      accent: 'blue',
    },
  ];

  // ── Chart.js — inicialización ─────────────
  let canvasBar   = $state(null);
  let canvasDona  = $state(null);
  let chartBar    = null;
  let chartDona   = null;

  // Colores para la dona
  const DONA_COLORS = {
    BORRADOR:  '#8b8fa8',
    ENVIADA:   '#fbbf24',
    ACEPTADA:  '#34d399',
    RECHAZADA: '#f87171',
    VENCIDA:   '#fb923c',
    PAGADA:    '#2dd4bf',
  };

  onMount(async () => {
    if (!browser) return;

    // Importar Chart.js dinámicamente para evitar SSR crash
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);

    // ── Gráfica de Barras: Ingresos por mes ────────────
    if (canvasBar) {
      chartBar = new Chart(canvasBar, {
        type: 'bar',
        data: {
          labels: grafica1.labels,
          datasets: [{
            label: 'Ingresos cobrados',
            data: grafica1.datos,
            backgroundColor: 'rgba(108,99,255,0.7)',
            borderColor: 'rgba(108,99,255,1)',
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ' ' + new Intl.NumberFormat('es-MX', {
                  style: 'currency', currency: 'MXN', maximumFractionDigits: 0
                }).format(ctx.parsed.y)
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#8b8fa8', font: { size: 11 } },
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: {
                color: '#8b8fa8',
                font: { size: 11 },
                callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
              },
              beginAtZero: true,
            }
          }
        }
      });
    }

    // ── Gráfica Dona: por estado ─────────────────────
    if (canvasDona && grafica2.length > 0) {
      chartDona = new Chart(canvasDona, {
        type: 'doughnut',
        data: {
          labels: grafica2.map(e => ESTADO_CONFIG[e.estado]?.label ?? e.estado),
          datasets: [{
            data: grafica2.map(e => e.count),
            backgroundColor: grafica2.map(e => DONA_COLORS[e.estado] ?? '#8b8fa8'),
            borderColor: '#0f1117',
            borderWidth: 3,
            hoverOffset: 8,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#d4d4e8',
                font: { size: 11 },
                padding: 14,
                usePointStyle: true,
              }
            },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.parsed} cotizaciones`
              }
            }
          }
        }
      });
    }

    // Limpiar al desmontar
    return () => {
      chartBar?.destroy();
      chartDona?.destroy();
    };
  });
</script>

<svelte:head><title>Dashboard – GestorPyme</title></svelte:head>

<div class="dash">

  <!-- ══ KPIs ══════════════════════════════════════════════════════════ -->
  <div class="kpi-grid">
    {#each KPIs as k}
      <div class="kpi-card kpi-{k.accent}">
        <div class="kpi-top">
          <span class="kpi-icon">{k.icon}</span>
          <div class="kpi-indicator kpi-ind-{k.accent}"></div>
        </div>
        <div class="kpi-valor">{k.valor}</div>
        <div class="kpi-label">{k.label}</div>
        <div class="kpi-sub">{k.sub}</div>
      </div>
    {/each}
  </div>

  <!-- ══ Gráficas ══════════════════════════════════════════════════════ -->
  <div class="charts-row">
    <!-- Barras: Ingresos 6 meses -->
    <div class="chart-card chart-wide">
      <div class="chart-header">
        <div>
          <h3 class="chart-title">Ingresos cobrados</h3>
          <p class="chart-sub">Últimos 6 meses</p>
        </div>
      </div>
      <div class="chart-body">
        <canvas bind:this={canvasBar}></canvas>
      </div>
    </div>

    <!-- Dona: por estado -->
    <div class="chart-card chart-narrow">
      <div class="chart-header">
        <div>
          <h3 class="chart-title">Cotizaciones</h3>
          <p class="chart-sub">Por estado</p>
        </div>
      </div>
      <div class="chart-body chart-body-dona">
        {#if grafica2.length === 0}
          <div class="no-data">Sin datos aún</div>
        {:else}
          <canvas bind:this={canvasDona}></canvas>
        {/if}
      </div>
    </div>
  </div>

  <!-- ══ Tablas ═══════════════════════════════════════════════════════ -->
  <div class="tables-row">

    <!-- Últimas cotizaciones -->
    <div class="table-card">
      <div class="table-header">
        <h3 class="table-title">Últimas cotizaciones</h3>
        <a href="/cotizaciones" class="ver-todo">Ver todas →</a>
      </div>
      {#if ultimasCotizaciones.length === 0}
        <p class="no-data-txt">Aún no hay cotizaciones.</p>
      {:else}
        <table class="mini-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {#each ultimasCotizaciones as c (c.id)}
              {@const cfg = ESTADO_CONFIG[c.estado]}
              <tr>
                <td><a href="/cotizaciones/{c.id}" class="folio-lnk">{c.folio}</a></td>
                <td class="truncate">{c.cliente?.nombre ?? '—'}</td>
                <td>
                  <span class="mini-badge"
                    style="color:{cfg?.color}; background:{cfg?.bg}; border-color:{cfg?.border}">
                    {cfg?.label ?? c.estado}
                  </span>
                </td>
                <td class="mono">{mxn(c.total)}</td>
                <td class="date-cell">{fmt(c.createdAt)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <!-- Top 3 clientes con más pendiente -->
    <div class="table-card">
      <div class="table-header">
        <h3 class="table-title">Top clientes con pendiente</h3>
        <a href="/cobranza" class="ver-todo">Ver cobranza →</a>
      </div>
      {#if topClientes.length === 0}
        <p class="no-data-txt">Sin cartera pendiente. 🎉</p>
      {:else}
        <div class="top-clientes">
          {#each topClientes as c, i}
            <div class="top-item">
              <div class="top-rank">#{i + 1}</div>
              <div class="top-info">
                <a href="/clientes/{c.id}" class="top-nombre">{c.nombre}</a>
                {#if c.empresa}<span class="top-empresa">{c.empresa}</span>{/if}
              </div>
              <div class="top-pendiente">{mxn(c.pendiente)}</div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

  </div>

</div>

<style>
/* ── Layout ─────────────────── */
.dash { display: flex; flex-direction: column; gap: 20px; }

/* ── KPI Grid ────────────────── */
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }

.kpi-card {
  background: #1a1d27;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: transform .2s, box-shadow .2s;
  position: relative;
  overflow: hidden;
}
.kpi-card::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  border-radius: 14px;
  transition: opacity .2s;
}
.kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,.35); }
.kpi-card:hover::before { opacity: 1; }

.kpi-purple { border-color: rgba(108,99,255,.3); }
.kpi-purple::before { background: rgba(108,99,255,.04); }
.kpi-green  { border-color: rgba(52,211,153,.3); }
.kpi-green::before  { background: rgba(52,211,153,.04); }
.kpi-yellow { border-color: rgba(251,191,36,.3); }
.kpi-yellow::before { background: rgba(251,191,36,.04); }
.kpi-blue   { border-color: rgba(96,165,250,.3); }
.kpi-blue::before   { background: rgba(96,165,250,.04); }

.kpi-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
.kpi-icon { font-size: 1.5rem; }

.kpi-indicator {
  width: 8px; height: 8px; border-radius: 50%;
  animation: pulse 2s infinite;
}
.kpi-ind-purple { background: #6c63ff; box-shadow: 0 0 6px rgba(108,99,255,.6); }
.kpi-ind-green  { background: #34d399; box-shadow: 0 0 6px rgba(52,211,153,.6); }
.kpi-ind-yellow { background: #fbbf24; box-shadow: 0 0 6px rgba(251,191,36,.6); }
.kpi-ind-blue   { background: #60a5fa; box-shadow: 0 0 6px rgba(96,165,250,.6); }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: .4; }
}

.kpi-valor { font-size: 1.5rem; font-weight: 800; color: #f0f0f5; letter-spacing: -.02em; }
.kpi-label { font-size: 0.78rem; font-weight: 600; color: #d4d4e8; margin-top: 2px; }
.kpi-sub   { font-size: 0.7rem; color: #8b8fa8; }

/* ── Charts ──────────────────── */
.charts-row { display: grid; grid-template-columns: 1fr 340px; gap: 14px; }
@media (max-width: 900px) { .charts-row { grid-template-columns: 1fr; } }

.chart-card {
  background: #1a1d27;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  padding: 20px;
}
.chart-header { margin-bottom: 16px; }
.chart-title  { font-size: 0.9rem; font-weight: 700; color: #f0f0f5; }
.chart-sub    { font-size: 0.72rem; color: #8b8fa8; margin-top: 2px; }
.chart-body   { position: relative; height: 200px; }
.chart-body-dona { height: 240px; }
.no-data { display: flex; align-items: center; justify-content: center; height: 100%; color: #8b8fa8; font-size: 0.85rem; }

/* ── Tables row ──────────────── */
.tables-row { display: grid; grid-template-columns: 1fr 320px; gap: 14px; }
@media (max-width: 900px) { .tables-row { grid-template-columns: 1fr; } }

.table-card {
  background: #1a1d27;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  padding: 20px;
}
.table-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.table-title  { font-size: 0.875rem; font-weight: 700; color: #f0f0f5; }
.ver-todo { font-size: 0.75rem; color: #a78bfa; text-decoration: none; font-weight: 500; }
.ver-todo:hover { text-decoration: underline; }

.mini-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.mini-table thead tr { border-bottom: 1px solid rgba(255,255,255,.06); }
.mini-table th { text-align: left; padding: 6px 8px; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8b8fa8; }
.mini-table td { padding: 8px 8px; color: #d4d4e8; border-bottom: 1px solid rgba(255,255,255,.04); }
.mini-table tr:last-child td { border-bottom: none; }
.mini-table tbody tr:hover { background: rgba(255,255,255,.02); }

.folio-lnk { color: #a78bfa; text-decoration: none; font-weight: 600; font-size: 0.78rem; }
.folio-lnk:hover { text-decoration: underline; }
.truncate { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mono { font-family: 'Courier New', monospace; font-size: 0.78rem; }
.date-cell { color: #8b8fa8; font-size: 0.75rem; }

.mini-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 0.65rem; font-weight: 600; border: 1px solid; white-space: nowrap; }

/* Top clientes */
.top-clientes { display: flex; flex-direction: column; gap: 10px; }
.top-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: rgba(255,255,255,.03); border-radius: 8px; border: 1px solid rgba(255,255,255,.05); }
.top-rank { font-size: 0.9rem; font-weight: 800; color: #6c63ff; min-width: 24px; }
.top-info { flex: 1; min-width: 0; }
.top-nombre { color: #a78bfa; text-decoration: none; font-size: 0.85rem; font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.top-nombre:hover { text-decoration: underline; }
.top-empresa { font-size: 0.72rem; color: #8b8fa8; }
.top-pendiente { font-size: 0.85rem; font-weight: 700; color: #fbbf24; font-family: 'Courier New', monospace; white-space: nowrap; }

.no-data-txt { color: #8b8fa8; font-size: 0.85rem; text-align: center; padding: 24px 0; }
</style>
