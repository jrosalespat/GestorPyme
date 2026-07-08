<script>
  import { ESTADO_CONFIG } from '$lib/schemas/cotizacion.js';

  let { data } = $props();

  // ── Filtros reactivos ──────────────────────
  let filtroEstado  = $state('');
  let filtroCliente = $state('');

  let filtradas = $derived(
    data.cotizaciones.filter(c => {
      const matchEstado  = !filtroEstado  || c.estado === filtroEstado;
      const matchCliente = !filtroCliente ||
        c.cliente.nombre.toLowerCase().includes(filtroCliente.toLowerCase()) ||
        (c.cliente.empresa ?? '').toLowerCase().includes(filtroCliente.toLowerCase());
      return matchEstado && matchCliente;
    })
  );

  const ESTADOS = ['BORRADOR','ENVIADA','ACEPTADA','RECHAZADA','VENCIDA','PAGADA'];

  // ── Helpers ────────────────────────────────
  function mxn(v) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN', maximumFractionDigits: 2
    }).format(v ?? 0);
  }

  function fmt(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function badge(estado) {
    return ESTADO_CONFIG[estado] ?? { label: estado, bg: '#333', color: '#fff', border: '#444' };
  }

  // Estadísticas resumen
  let totalGeneral   = $derived(data.cotizaciones.reduce((a, c) => a + c.total, 0));
  let totalCobrado   = $derived(data.cotizaciones.reduce((a, c) => a + c.cobrado, 0));
  let pendientes     = $derived(data.cotizaciones.filter(c => c.estado === 'ENVIADA').length);
</script>

<svelte:head><title>Cotizaciones – GestorPyme</title></svelte:head>

<!-- ── Header ──────────────────────────────── -->
<div class="pg-header">
  <div>
    <h2 class="pg-title">Cotizaciones</h2>
    <p class="pg-sub">{data.cotizaciones.length} cotizaciones en total</p>
  </div>
  <a href="/cotizaciones/nueva" class="btn-primary">+ Nueva cotización</a>
</div>

<!-- ── KPIs resumen ────────────────────────── -->
<div class="kpi-bar">
  <div class="kpi-item">
    <span class="kpi-label">Total facturado</span>
    <span class="kpi-val">{mxn(totalGeneral)}</span>
  </div>
  <div class="kpi-item">
    <span class="kpi-label">Total cobrado</span>
    <span class="kpi-val cobrado">{mxn(totalCobrado)}</span>
  </div>
  <div class="kpi-item">
    <span class="kpi-label">Por cobrar</span>
    <span class="kpi-val pendiente">{mxn(totalGeneral - totalCobrado)}</span>
  </div>
  <div class="kpi-item">
    <span class="kpi-label">Enviadas pendientes</span>
    <span class="kpi-val">{pendientes}</span>
  </div>
</div>

<!-- ── Filtros ──────────────────────────────── -->
<div class="toolbar">
  <input
    class="search-input"
    type="search"
    placeholder="🔍 Buscar cliente…"
    bind:value={filtroCliente}
  />
  <select class="select-filter" bind:value={filtroEstado}>
    <option value="">Todos los estados</option>
    {#each ESTADOS as e}
      <option value={e}>{ESTADO_CONFIG[e]?.label ?? e}</option>
    {/each}
  </select>
  <span class="count-badge">{filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''}</span>
</div>

<!-- ── Tabla ───────────────────────────────── -->
<div class="table-wrap">
  {#if filtradas.length === 0}
    <div class="empty-state">
      <span>📄</span>
      <p>{filtroEstado || filtroCliente ? 'Sin resultados para ese filtro.' : 'Aún no hay cotizaciones.'}</p>
    </div>
  {:else}
      <table class="cot-table">
        <thead>
          <tr>
            <th>Folio</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Emisión</th>
            <th>Vence</th>
            <th>Total</th>
            <th>Cobrado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each filtradas as c (c.id)}
            {@const cfg = badge(c.estado)}
            <tr>
              <td>
                <a href="/cotizaciones/{c.id}" class="folio-link">{c.folio}</a>
              </td>
              <td>
                <span class="cliente-nombre">{c.cliente.nombre}</span>
                {#if c.cliente.empresa}
                  <span class="cliente-sub">{c.cliente.empresa}</span>
                {/if}
              </td>
              <td>
                <span class="badge"
                  style="color:{cfg.color}; background:{cfg.bg}; border-color:{cfg.border}">
                  {cfg.label}
                </span>
              </td>
              <td>{fmt(c.fechaEmision)}</td>
              <td class:vencido={c.estado !== 'PAGADA' && c.fechaVence && new Date(c.fechaVence) < new Date()}>
                {fmt(c.fechaVence)}
              </td>
              <td class="mono">{mxn(c.total)}</td>
              <td class="mono cobrado-cell">{mxn(c.cobrado)}</td>
              <td>
                <a href="/cotizaciones/{c.id}" class="btn-icon" title="Ver detalle">👁</a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
  {/if}
</div>

<style>
/* ── Header ────────────── */
.pg-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
.pg-title  { font-size: 1.25rem; font-weight: 700; color: #f0f0f5; }
.pg-sub    { font-size: 0.8rem; color: #8b8fa8; margin-top: 2px; }

/* ── KPI bar ───────────── */
.kpi-bar {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.kpi-item {
  background: #1a1d27;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kpi-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8b8fa8; }
.kpi-val   { font-size: 1.2rem; font-weight: 700; color: #f0f0f5; }
.kpi-val.cobrado  { color: #34d399; }
.kpi-val.pendiente { color: #fbbf24; }

/* ── Toolbar ───────────── */
.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.search-input {
  flex: 1; min-width: 200px;
  background: #1a1d27; border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px; color: #f0f0f5; padding: 9px 12px;
  font-size: 0.875rem; outline: none; transition: border-color .2s;
}
.search-input:focus { border-color: #6c63ff; }
.search-input::placeholder { color: #8b8fa8; }
.select-filter {
  background: #1a1d27; border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px; color: #f0f0f5; padding: 9px 12px;
  font-size: 0.875rem; cursor: pointer; outline: none;
}
.count-badge { font-size: 0.75rem; color: #8b8fa8; white-space: nowrap; }

/* ── Table ─────────────── */
.table-wrap { background: #1a1d27; border-radius: 12px; border: 1px solid rgba(255,255,255,.08); overflow-x: auto; max-width: 100%; }
.cot-table  { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.cot-table thead tr { background: rgba(255,255,255,.03); border-bottom: 1px solid rgba(255,255,255,.08); }
.cot-table th { text-align: left; padding: 12px 14px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8b8fa8; }
.cot-table td { padding: 11px 14px; color: #d4d4e8; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
.cot-table tr:last-child td { border-bottom: none; }
.cot-table tbody tr:hover { background: rgba(255,255,255,.02); }

.folio-link { color: #a78bfa; text-decoration: none; font-weight: 600; }
.folio-link:hover { text-decoration: underline; }
.cliente-nombre { display: block; font-weight: 500; color: #f0f0f5; }
.cliente-sub { display: block; font-size: 0.75rem; color: #8b8fa8; }
.badge {
  display: inline-block; padding: 3px 10px; border-radius: 20px;
  font-size: 0.72rem; font-weight: 600; border: 1px solid;
}
.mono { font-family: 'Courier New', monospace; font-size: 0.83rem; }
.cobrado-cell { color: #34d399; }
.vencido { color: #f87171; }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 60px 24px; color: #8b8fa8; font-size: 0.9rem; }
.empty-state span { font-size: 2.5rem; }

.btn-primary {
  background: #6c63ff; color: #fff; border: none; border-radius: 8px;
  padding: 9px 18px; font-size: 0.875rem; font-weight: 600; cursor: pointer;
  text-decoration: none; display: inline-block; transition: background .2s;
}
.btn-primary:hover { background: #7c74ff; }
.btn-icon {
  background: transparent; border: 1px solid rgba(255,255,255,.1);
  border-radius: 6px; padding: 4px 8px; font-size: 0.85rem;
  cursor: pointer; transition: background .15s; text-decoration: none;
}
.btn-icon:hover { background: rgba(255,255,255,.08); }
</style>
