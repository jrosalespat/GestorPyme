<script>
  import { enhance } from '$app/forms';
  import { ESTADO_CONFIG } from '$lib/schemas/cotizacion.js';

  let { data, form } = $props();

  // ── Toast ────────────────────────────────
  let flash = $state('');
  let flashId = $state(''); // ID de la cotización que acaba de recibir recordatorio
  $effect(() => {
    if (form?.success && form?.flash) {
      flash = form.flash;
      flashId = form.recordatorioId ?? '';
      setTimeout(() => { flash = ''; flashId = ''; }, 4000);
    }
  });

  // ── Helpers ──────────────────────────────
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

  // Color de urgencia según días transcurridos
  function urgenciaClass(dias) {
    if (dias > 30) return 'urgente';
    if (dias > 15) return 'alerta';
    return '';
  }

  function urgenciaLabel(dias) {
    if (dias > 30) return 'Vencida';
    if (dias > 15) return 'Próxima';
    return 'Al corriente';
  }

  function urgenciaColor(dias) {
    if (dias > 30) return '#f87171';
    if (dias > 15) return '#fbbf24';
    return '#34d399';
  }
  // Contadores de urgencia
  let cntVencidas = $derived(data.cartera.filter(c => c.diasTranscurridos > 30).length);
  let cntAlertas  = $derived(data.cartera.filter(c => c.diasTranscurridos > 15 && c.diasTranscurridos <= 30).length);
  let cntAlDia    = $derived(data.cartera.filter(c => c.diasTranscurridos <= 15).length);
</script>

<svelte:head><title>Cobranza – GestorPyme</title></svelte:head>

<!-- Toast -->
{#if flash}
  <div class="toast">✅ {flash}</div>
{/if}

{#if form?.error}
  <div class="banner-error">{form.error}</div>
{/if}

<!-- ── Header ──────────────────────────────── -->
<div class="pg-header">
  <div>
    <h2 class="pg-title">Cartera de cobranza</h2>
    <p class="pg-sub">
      {data.cartera.length} cuenta{data.cartera.length !== 1 ? 's' : ''} por cobrar
    </p>
  </div>
  <div class="cartera-total">
    <span class="cartera-label">Cartera pendiente total</span>
    <span class="cartera-monto">{mxn(data.totalCartera)}</span>
  </div>
</div>

<!-- ── Badges de resumen ────────────────────── -->
<div class="resumen-bar">
  <div class="resumen-chip urgente">
    <span class="chip-num">{cntVencidas}</span>
    <span class="chip-label">Más de 30 días</span>
  </div>
  <div class="resumen-chip alerta">
    <span class="chip-num">{cntAlertas}</span>
    <span class="chip-label">15–30 días</span>
  </div>
  <div class="resumen-chip ok">
    <span class="chip-num">{cntAlDia}</span>
    <span class="chip-label">Menos de 15 días</span>
  </div>
</div>

<!-- ── Tabla ───────────────────────────────── -->
{#if data.cartera.length === 0}
  <div class="empty-state">
    <span>🎉</span>
    <p>¡Sin cuentas pendientes!</p>
    <span class="empty-sub">Todas las cotizaciones enviadas están al corriente.</span>
  </div>
{:else}
  <div class="table-wrap">
    <div class="w-full overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <table class="cartera-table">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Folio</th>
          <th>Estado</th>
          <th>Emisión</th>
          <th>Vence</th>
          <th>Total</th>
          <th>Pagado</th>
          <th>Pendiente</th>
          <th>Días</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each data.cartera as c (c.id)}
          {@const urg = urgenciaClass(c.diasTranscurridos)}
          {@const cfg = ESTADO_CONFIG[c.estado]}
          <tr class={urg}>
            <td>
              <a href="/clientes/{c.cliente.id}" class="link">{c.cliente.nombre}</a>
              {#if c.cliente.empresa}
                <span class="sub">{c.cliente.empresa}</span>
              {/if}
            </td>
            <td>
              <a href="/cotizaciones/{c.id}" class="link folio">{c.folio}</a>
            </td>
            <td>
              <span class="badge"
                style="color:{cfg?.color}; background:{cfg?.bg}; border-color:{cfg?.border}">
                {cfg?.label ?? c.estado}
              </span>
            </td>
            <td>{fmt(c.fechaEmision)}</td>
            <td class:text-warn={c.diasTranscurridos > 30}>{fmt(c.fechaVence)}</td>
            <td class="mono">{mxn(c.total)}</td>
            <td class="mono cobrado">{mxn(c.cobrado)}</td>
            <td class="mono">
              <strong style="color:{urgenciaColor(c.diasTranscurridos)}">
                {mxn(c.saldoPendiente)}
              </strong>
            </td>
            <td>
              <span class="dias-badge" class:dias-urg={c.diasTranscurridos > 30} class:dias-alerta={c.diasTranscurridos > 15 && c.diasTranscurridos <= 30}>
                {c.diasTranscurridos}d
              </span>
            </td>
            <td>
              <form method="POST" action="?/enviarRecordatorio" use:enhance>
                <input type="hidden" name="cotizacionId"  value={c.id} />
                <input type="hidden" name="emailCliente"  value={c.cliente.email} />
                <input type="hidden" name="nombreCliente" value={c.cliente.nombre} />
                <input type="hidden" name="folio"         value={c.folio} />
                <input type="hidden" name="pendiente"     value={c.saldoPendiente} />
                <button
                  type="submit"
                  class="btn-recordatorio"
                  class:sent={flashId === c.id}
                  title="Enviar recordatorio de pago"
                >
                  {flashId === c.id ? '✅ Enviado' : '📧 Recordatorio'}
                </button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
  </div>
{/if}

<style>
/* ── Header ─────────────────── */
.pg-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.pg-title  { font-size: 1.25rem; font-weight: 700; color: #f0f0f5; }
.pg-sub    { font-size: 0.8rem; color: #8b8fa8; margin-top: 2px; }

.cartera-total { text-align: right; }
.cartera-label { display: block; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8b8fa8; margin-bottom: 4px; }
.cartera-monto { font-size: 1.6rem; font-weight: 700; color: #f87171; }

/* ── Resumen bar ─────────────── */
.resumen-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.resumen-chip {
  display: flex; align-items: center; gap: 10px;
  background: #1a1d27; border: 1px solid rgba(255,255,255,.08);
  border-radius: 10px; padding: 12px 16px; flex: 1; min-width: 120px;
}
.resumen-chip.urgente { border-color: rgba(248,113,113,.3); background: rgba(248,113,113,.05); }
.resumen-chip.alerta  { border-color: rgba(251,191,36,.3);  background: rgba(251,191,36,.05); }
.resumen-chip.ok      { border-color: rgba(52,211,153,.3);  background: rgba(52,211,153,.05); }
.chip-num   { font-size: 1.5rem; font-weight: 700; color: #f0f0f5; }
.chip-label { font-size: 0.75rem; color: #8b8fa8; }
.resumen-chip.urgente .chip-num { color: #f87171; }
.resumen-chip.alerta  .chip-num { color: #fbbf24; }
.resumen-chip.ok      .chip-num { color: #34d399; }

/* ── Table ───────────────────── */
.table-wrap { background: #1a1d27; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; overflow: hidden; }
.cartera-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.cartera-table thead tr { background: rgba(255,255,255,.03); border-bottom: 1px solid rgba(255,255,255,.08); }
.cartera-table th { text-align: left; padding: 11px 14px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8b8fa8; }
.cartera-table td { padding: 11px 14px; color: #d4d4e8; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
.cartera-table tr:last-child td { border-bottom: none; }

/* Filas urgentes */
.cartera-table tr.urgente { background: rgba(248,113,113,.04); }
.cartera-table tr.urgente:hover { background: rgba(248,113,113,.08); }
.cartera-table tr.alerta  { background: rgba(251,191,36,.03); }
.cartera-table tr.alerta:hover  { background: rgba(251,191,36,.07); }
.cartera-table tbody tr:not(.urgente):not(.alerta):hover { background: rgba(255,255,255,.02); }

.link { color: #a78bfa; text-decoration: none; }
.link:hover { text-decoration: underline; }
.link.folio { font-weight: 600; }
.sub { display: block; font-size: 0.72rem; color: #8b8fa8; margin-top: 1px; }
.mono { font-family: 'Courier New', monospace; font-size: 0.82rem; }
.cobrado { color: #34d399; }
.text-warn { color: #f87171; }

.badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; border: 1px solid; }

/* Días badge */
.dias-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; background: rgba(52,211,153,.12); color: #34d399; border: 1px solid rgba(52,211,153,.25); }
.dias-badge.dias-alerta { background: rgba(251,191,36,.12); color: #fbbf24; border-color: rgba(251,191,36,.3); }
.dias-badge.dias-urg    { background: rgba(248,113,113,.12); color: #f87171; border-color: rgba(248,113,113,.3); }

/* Botón recordatorio */
.btn-recordatorio {
  background: rgba(108,99,255,.12); color: #a78bfa;
  border: 1px solid rgba(108,99,255,.3); border-radius: 7px;
  padding: 5px 10px; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; white-space: nowrap; transition: all .2s;
}
.btn-recordatorio:hover { background: rgba(108,99,255,.25); color: #c4b5fd; }
.btn-recordatorio.sent { background: rgba(34,197,94,.1); color: #4ade80; border-color: rgba(34,197,94,.3); }

/* Empty state */
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 72px 24px; color: #8b8fa8; }
.empty-state span:first-child { font-size: 3rem; }
.empty-state p { font-size: 1rem; font-weight: 600; color: #f0f0f5; margin: 0; }
.empty-sub { font-size: 0.85rem; }

/* Banner error / toast */
.banner-error { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3); color: #fca5a5; border-radius: 8px; padding: 10px 16px; font-size: 0.875rem; margin-bottom: 16px; }
.toast { position: fixed; bottom: 24px; right: 24px; background: #22c55e; color: #fff; padding: 12px 20px; border-radius: 10px; font-size: 0.875rem; font-weight: 600; box-shadow: 0 4px 24px rgba(0,0,0,.4); z-index: 1000; animation: slideUp .25s ease; }
@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
</style>
