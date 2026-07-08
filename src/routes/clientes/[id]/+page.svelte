<script>
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';

  let { data, form } = $props();
  let { cliente, kpis } = $derived(data);

  // ── Flash tras desactivar ──────────────────
  let flash = $state('');
  $effect(() => {
    if (form?.success && form?.flash) {
      flash = form.flash;
      setTimeout(() => goto('/clientes'), 2000);
    }
  });

  // ── Helpers ────────────────────────────────
  function fmt(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function mxn(val) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN', maximumFractionDigits: 2
    }).format(val ?? 0);
  }

  const ESTADO_LABEL = {
    BORRADOR:  { label: 'Borrador',  color: '#8b8fa8' },
    ENVIADA:   { label: 'Enviada',   color: '#60a5fa' },
    ACEPTADA:  { label: 'Aceptada',  color: '#34d399' },
    RECHAZADA: { label: 'Rechazada', color: '#f87171' },
    VENCIDA:   { label: 'Vencida',   color: '#fbbf24' },
    PAGADA:    { label: 'Pagada',    color: '#4ade80' },
  };

  // Confirm antes de desactivar
  let formRef = $state(null);
  function confirmarDesactivar(e) {
    const ok = confirm(
      `¿Desactivar a "${cliente.nombre}"?\n\nEsta acción ocultará al cliente de los listados activos. Se puede reactivar desde la base de datos.`
    );
    if (!ok) e.preventDefault();
  }
</script>

<svelte:head>
  <title>{cliente.nombre} – GestorPyme</title>
</svelte:head>

<!-- Flash toast -->
{#if flash}
  <div class="toast">{flash}</div>
{/if}

<!-- Error del form -->
{#if form?.error}
  <div class="banner-error">{form.error}</div>
{/if}

<!-- ── Breadcrumb ──────────────────────────── -->
<div class="breadcrumb">
  <a href="/clientes" class="bc-link">← Clientes</a>
  <span class="bc-sep">/</span>
  <span>{cliente.nombre}</span>
</div>

<!-- ── Perfil header ───────────────────────── -->
<div class="perfil-header">
  <div class="avatar">
    {cliente.nombre.charAt(0).toUpperCase()}
  </div>
  <div class="perfil-info">
    <h2 class="perfil-nombre">{cliente.nombre}</h2>
    {#if cliente.empresa}
      <p class="perfil-empresa">{cliente.empresa}</p>
    {/if}
    <div class="perfil-meta">
      {#if cliente.rfc}
        <span class="meta-chip">RFC: {cliente.rfc}</span>
      {/if}
      <span class="meta-chip">{cliente.email}</span>
      {#if cliente.telefono}
        <span class="meta-chip">📞 {cliente.telefono}</span>
      {/if}
    </div>
  </div>
  <div class="perfil-actions">
    {#if cliente.activo}
      <form
        method="POST"
        action="?/desactivar"
        bind:this={formRef}
        use:enhance
      >
        <button
          type="submit"
          class="btn-danger"
          onclick={confirmarDesactivar}
        >
          🚫 Desactivar cliente
        </button>
      </form>
    {:else}
      <span class="badge-inactivo">🔴 Cliente inactivo</span>
    {/if}
  </div>
</div>

<!-- ── KPIs financieros ─────────────────────── -->
<div class="kpis">
  <div class="kpi-card">
    <span class="kpi-label">Total facturado</span>
    <span class="kpi-value">{mxn(kpis.totalFacturado)}</span>
    <span class="kpi-sub">cotizaciones enviadas/aceptadas/pagadas</span>
  </div>
  <div class="kpi-card cobrado">
    <span class="kpi-label">Total cobrado</span>
    <span class="kpi-value cobrado">{mxn(kpis.totalCobrado)}</span>
    <span class="kpi-sub">pagos registrados</span>
  </div>
  <div class="kpi-card pendiente">
    <span class="kpi-label">Saldo pendiente</span>
    <span class="kpi-value pendiente">{mxn(kpis.totalPendiente)}</span>
    <span class="kpi-sub">por cobrar</span>
  </div>
</div>

<!-- ── Datos adicionales ────────────────────── -->
<div class="info-grid">
  <div class="info-card">
    <h4 class="card-title">Información de contacto</h4>
    <dl class="dl">
      <dt>Correo</dt><dd>{cliente.email}</dd>
      <dt>Teléfono</dt><dd>{cliente.telefono ?? '—'}</dd>
      <dt>Dirección</dt><dd>{cliente.direccion ?? '—'}</dd>
      <dt>Cliente desde</dt><dd>{fmt(cliente.createdAt)}</dd>
      <dt>Última actualización</dt><dd>{fmt(cliente.updatedAt)}</dd>
    </dl>
  </div>
  {#if cliente.notas}
    <div class="info-card">
      <h4 class="card-title">Notas</h4>
      <p class="notas-texto">{cliente.notas}</p>
    </div>
  {/if}
</div>

<!-- ── Cotizaciones ─────────────────────────── -->
<div class="section">
  <div class="section-header">
    <h3 class="section-title">Cotizaciones ({cliente.cotizaciones.length})</h3>
    <a href="/cotizaciones/nueva?clienteId={cliente.id}" class="btn-primary">
      + Nueva cotización
    </a>
  </div>

  {#if cliente.cotizaciones.length === 0}
    <div class="empty-state">
      <span>📄</span>
      <p>Sin cotizaciones aún.</p>
    </div>
  {:else}
    <div class="table-wrap">
    <div class="w-full overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <table class="cot-table">
        <thead>
          <tr>
            <th>Folio</th>
            <th>Estado</th>
            <th>Total</th>
            <th>Emisión</th>
            <th>Vence</th>
            <th>Cobrado</th>
          </tr>
        </thead>
        <tbody>
          {#each cliente.cotizaciones as cot (cot.id)}
            {@const cobrado = cot.pagos.reduce((a, p) => a + Number(p.monto), 0)}
            {@const est = ESTADO_LABEL[cot.estado] ?? { label: cot.estado, color: '#8b8fa8' }}
            <tr>
              <td>
                <a href="/cotizaciones/{cot.id}" class="folio-link">{cot.folio}</a>
              </td>
              <td>
                <span class="estado-badge" style="color: {est.color}; border-color: {est.color}40; background: {est.color}15">
                  {est.label}
                </span>
              </td>
              <td class="mono">{mxn(cot.total)}</td>
              <td>{fmt(cot.fechaEmision)}</td>
              <td>{fmt(cot.fechaVence)}</td>
              <td class="mono">{mxn(cobrado)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    </div>
  {/if}
</div>

<style>
/* ── Breadcrumb ────────────── */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: #8b8fa8;
  margin-bottom: 20px;
}
.bc-link { color: #a78bfa; text-decoration: none; }
.bc-link:hover { text-decoration: underline; }
.bc-sep { color: #444; }

/* ── Perfil header ─────────── */
.perfil-header {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6c63ff, #a78bfa);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.perfil-info { flex: 1; min-width: 200px; }
.perfil-nombre { font-size: 1.4rem; font-weight: 700; color: #f0f0f5; }
.perfil-empresa { color: #8b8fa8; font-size: 0.9rem; margin-top: 2px; }
.perfil-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.meta-chip {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 0.78rem;
  color: #d4d4e8;
}
.perfil-actions { margin-left: auto; }

/* ── KPIs ─────────────────── */
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.kpi-card {
  background: #1a1d27;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kpi-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8b8fa8;
}
.kpi-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: #f0f0f5;
}
.kpi-value.cobrado  { color: #34d399; }
.kpi-value.pendiente { color: #fbbf24; }
.kpi-sub { font-size: 0.72rem; color: #8b8fa8; }

/* ── Info grid ────────────── */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}
.info-card {
  background: #1a1d27;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  padding: 20px;
}
.card-title {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8b8fa8;
  margin-bottom: 14px;
}
.dl { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; font-size: 0.875rem; }
dt { color: #8b8fa8; font-weight: 500; }
dd { color: #d4d4e8; }
.notas-texto { font-size: 0.875rem; color: #d4d4e8; line-height: 1.6; }

/* ── Section ──────────────── */
.section { margin-bottom: 28px; }
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-title { font-size: 1rem; font-weight: 600; color: #f0f0f5; }

/* ── Table ────────────────── */
.table-wrap {
  background: #1a1d27;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  overflow: hidden;
}
.cot-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.cot-table thead tr {
  background: rgba(255,255,255,.03);
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.cot-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8b8fa8;
}
.cot-table td {
  padding: 11px 16px;
  color: #d4d4e8;
  border-bottom: 1px solid rgba(255,255,255,.05);
}
.cot-table tr:last-child td { border-bottom: none; }
.folio-link { color: #a78bfa; text-decoration: none; font-weight: 600; }
.folio-link:hover { text-decoration: underline; }
.mono { font-family: 'Courier New', monospace; font-size: 0.82rem; }

.estado-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid;
}

/* ── Buttons & badges ──────── */
.btn-primary {
  background: #6c63ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: background .2s;
}
.btn-primary:hover { background: #7c74ff; }

.btn-danger {
  background: transparent;
  color: #fca5a5;
  border: 1px solid rgba(239,68,68,.4);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background .2s, color .2s;
}
.btn-danger:hover { background: rgba(239,68,68,.15); color: #f87171; }

.badge-inactivo {
  font-size: 0.8rem;
  color: #f87171;
  padding: 6px 12px;
  border: 1px solid rgba(239,68,68,.3);
  border-radius: 8px;
  background: rgba(239,68,68,.08);
}

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 48px 24px;
  background: #1a1d27;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  color: #8b8fa8; font-size: 0.9rem;
}
.empty-state span { font-size: 2.5rem; }

/* ── Toast ─────────────────── */
.toast {
  position: fixed;
  bottom: 24px; right: 24px;
  background: #22c55e; color: #fff;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 0.875rem; font-weight: 600;
  box-shadow: 0 4px 24px rgba(0,0,0,.4);
  z-index: 1000;
  animation: slideUp .25s ease;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.banner-error {
  background: rgba(239,68,68,.12);
  border: 1px solid rgba(239,68,68,.3);
  color: #fca5a5;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  margin-bottom: 16px;
}
</style>
