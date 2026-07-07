<script>
  import { enhance } from '$app/forms';
  import { ESTADO_CONFIG, TRANSICIONES } from '$lib/schemas/cotizacion.js';

  let { data, form } = $props();

  let cot = $derived(data.cot);
  let transiciones = $derived(TRANSICIONES[cot.estado] ?? []);

  // ── Toast ──────────────────────────────────
  let flash = $state('');
  $effect(() => {
    if (form?.success && form?.flash) {
      flash = form.flash;
      showPago = false;
      confirmDeleteId = null;
      setTimeout(() => flash = '', 4000);
    }
  });

  // ── Modal pago ─────────────────────────────
  let showPago = $state(false);
  $effect(() => { if (form?.erroresPago) showPago = true; });
  const errPago = $derived(form?.erroresPago ?? {});
  const valPago = $derived(form?.valuesPago  ?? {});

  // ── Confirmación eliminar pago ─────────────
  /** @type {string|null} */
  let confirmDeleteId = $state(null);

  // ── Helpers ────────────────────────────────
  function mxn(v) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(v ?? 0);
  }
  function fmt(d)   { if (!d) return '—'; return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function fmtTs(d) { if (!d) return '—'; return new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

  const cfg       = $derived(ESTADO_CONFIG[cot.estado] ?? { label: cot.estado, bg: '#333', color: '#fff', border: '#444' });
  const pendiente = $derived(cot.total - cot.cobrado);

  // Color del saldo pendiente
  const pendienteClass = $derived(
    pendiente <= 0 ? 'saldo-ok' : pendiente < cot.total * 0.5 ? 'saldo-warn' : 'saldo-bad'
  );

  const METODOS = [
    { value: 'EFECTIVO',        label: 'Efectivo' },
    { value: 'TRANSFERENCIA',   label: 'Transferencia' },
    { value: 'TARJETA_CREDITO', label: 'Tarjeta crédito' },
    { value: 'TARJETA_DEBITO',  label: 'Tarjeta débito' },
    { value: 'CHEQUE',          label: 'Cheque' },
    { value: 'OTRO',            label: 'Otro' },
  ];
  const LABEL_METODO = Object.fromEntries(METODOS.map(m => [m.value, m.label]));

  const TRANS_LABELS = {
    ENVIADA:   '📤 Marcar como Enviada',
    ACEPTADA:  '✅ Marcar Aceptada',
    RECHAZADA: '❌ Marcar Rechazada',
    BORRADOR:  '↩ Regresar a Borrador',
    PAGADA:    '💰 Marcar Pagada',
    VENCIDA:   '⏰ Marcar Vencida',
  };

  async function descargarPDF() {
    const html2pdf = (await import('html2pdf.js')).default;
    const opciones = {
      margin: 0.5,
      filename: `Cotizacion_${cot.folio}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opciones).from(document.getElementById('cotizacion-pdf')).save();
  }
</script>

<svelte:head><title>{cot.folio} – GestorPyme</title></svelte:head>

<!-- Toast -->
{#if flash}
  <div class="toast">✅ {flash}</div>
{/if}

<!-- Error del form -->
{#if form?.error}
  <div class="banner-error">{form.error}</div>
{/if}

<!-- ── Breadcrumb & Top Actions ──────────────────────────── -->
<div class="breadcrumb-container">
  <div class="breadcrumb">
    <a href="/cotizaciones" class="bc-link">← Cotizaciones</a>
    <span class="bc-sep">/</span>
    <span>{cot.folio}</span>
  </div>

  <div class="top-actions">
    <!-- Botón Descargar PDF -->
    <button class="btn-secondary flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-sm" onclick={descargarPDF}>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" class="btn-icon">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
      </svg>
      Descargar PDF
    </button>

    <!-- Botones de transición de estado -->
    <div class="header-actions">
      {#each transiciones as t}
        <form method="POST" action="?/cambiarEstado" use:enhance>
          <input type="hidden" name="nuevoEstado" value={t} />
          <button type="submit" class="btn-trans" class:btn-danger={t === 'RECHAZADA'}>
            {TRANS_LABELS[t] ?? t}
          </button>
        </form>
      {/each}

      {#if cot.estado === 'ACEPTADA' || cot.estado === 'PAGADA'}
        <button class="btn-primary" onclick={() => showPago = true}>💳 Registrar pago</button>
      {/if}
    </div>
  </div>
</div>

<div id="cotizacion-pdf">
  <!-- ── Header ──────────────────────────────── -->
  <div class="cot-header">
    <div class="header-left">
      <div class="folio-row">
        <h2 class="folio">{cot.folio}</h2>
        <span class="badge"
          style="color:{cfg.color}; background:{cfg.bg}; border-color:{cfg.border}">
          {cfg.label}
        </span>
      </div>
      <p class="cliente-info">
        <a href="/clientes/{cot.cliente.id}" class="cliente-link">{cot.cliente.nombre}</a>
        {#if cot.cliente.empresa} · {cot.cliente.empresa}{/if}
      </p>
      <p class="fechas">
        Emitida: {fmt(cot.fechaEmision)}
        {#if cot.fechaVence} · Vence: <span class:text-warn={pendiente > 0 && new Date(cot.fechaVence) < new Date()}>{fmt(cot.fechaVence)}</span>{/if}
      </p>
    </div>
  </div>

<!-- ── KPIs de montos ───────────────────────── -->
<div class="kpis">
  <div class="kpi-card">
    <span class="kpi-label">Subtotal</span>
    <span class="kpi-val">{mxn(cot.subtotal)}</span>
  </div>
  {#if cot.iva > 0}
    <div class="kpi-card">
      <span class="kpi-label">IVA</span>
      <span class="kpi-val">{mxn(cot.iva)}</span>
    </div>
  {/if}
  <div class="kpi-card">
    <span class="kpi-label">Total</span>
    <span class="kpi-val grand">{mxn(cot.total)}</span>
  </div>
  <div class="kpi-card">
    <span class="kpi-label">Cobrado</span>
    <span class="kpi-val cobrado">{mxn(cot.cobrado)}</span>
  </div>
  <div class="kpi-card">
    <span class="kpi-label">Pendiente</span>
    <span class="kpi-val" class:pendiente={pendiente > 0}>{mxn(pendiente)}</span>
  </div>
</div>

<!-- ── Conceptos ────────────────────────────── -->
<div class="section">
  <h3 class="section-title">Conceptos</h3>
  <div class="table-wrap">
    <table class="detail-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Descripción</th>
          <th>Unidad</th>
          <th>Cant.</th>
          <th>Precio unit.</th>
          <th>Desc. %</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {#each cot.conceptos as c, i}
          <tr>
            <td class="num-cell">{i + 1}</td>
            <td>{c.descripcion}</td>
            <td>{c.unidad}</td>
            <td class="mono">{c.cantidad}</td>
            <td class="mono">{mxn(c.precioUnitario)}</td>
            <td class="mono">{c.descuento > 0 ? `${c.descuento}%` : '—'}</td>
            <td class="mono">{mxn(c.subtotal)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<!-- ── Pagos ─────────────────────────────────── -->
<div class="section">
  <div class="section-header">
    <h3 class="section-title">Pagos ({cot.pagos.length})</h3>
    {#if cot.estado === 'ACEPTADA' || cot.estado === 'ENVIADA'}
      <button class="btn-primary" onclick={() => showPago = true}>💳 Registrar pago</button>
    {/if}
  </div>

  {#if form?.error && form?._accion !== 'eliminarPago'}
    <div class="banner-error" style="margin-bottom:12px">{form.error}</div>
  {/if}

  {#if cot.pagos.length === 0}
    <div class="empty-card">Sin pagos registrados.</div>
  {:else}
    <div class="table-wrap">
      <table class="detail-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Método</th>
            <th>Referencia</th>
            <th>Notas</th>
            <th>Monto</th>
            {#if cot.estado !== 'PAGADA'}<th></th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each cot.pagos as p (p.id)}
            <tr>
              <td>{fmt(p.fechaPago)}</td>
              <td>{LABEL_METODO[p.metodoPago] ?? p.metodoPago}</td>
              <td class="mono">{p.referencia ?? '—'}</td>
              <td>{p.notas ?? '—'}</td>
              <td class="mono cobrado">{mxn(p.monto)}</td>
              {#if cot.estado !== 'PAGADA'}
                <td>
                  <button
                    class="btn-del"
                    title="Eliminar pago"
                    onclick={() => confirmDeleteId = p.id}
                  >🗑</button>
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Resumen de pagos -->
    <div class="pagos-resumen">
      <div class="resumen-row">
        <span class="resumen-label">Total cotización</span>
        <span class="resumen-val mono">{mxn(cot.total)}</span>
      </div>
      <div class="resumen-row">
        <span class="resumen-label">Total pagado</span>
        <span class="resumen-val mono cobrado">{mxn(cot.cobrado)}</span>
      </div>
      <div class="resumen-row grand">
        <span class="resumen-label">Saldo pendiente</span>
        <span class="resumen-val mono {pendienteClass}">{mxn(pendiente)}</span>
      </div>
    </div>
  {/if}
</div>

<!-- ── Historial de estados ─────────────────── -->
<div class="section">
  <h3 class="section-title">Historial de estados</h3>
  <div class="historial">
    {#each cot.historial as h}
      {@const cfgN = ESTADO_CONFIG[h.estadoNuevo]}
      <div class="historial-item">
        <div class="historial-dot" style="background:{cfgN?.color ?? '#8b8fa8'}"></div>
        <div class="historial-body">
          <div class="historial-row">
            {#if h.estadoAnterior}
              <span class="hist-est" style="color:{ESTADO_CONFIG[h.estadoAnterior]?.color ?? '#8b8fa8'}">{ESTADO_CONFIG[h.estadoAnterior]?.label ?? h.estadoAnterior}</span>
              <span class="hist-arrow">→</span>
            {/if}
            <span class="hist-est" style="color:{cfgN?.color ?? '#f0f0f5'}; font-weight:700">{cfgN?.label ?? h.estadoNuevo}</span>
          </div>
          {#if h.nota}<p class="hist-nota">{h.nota}</p>{/if}
          <span class="hist-ts">{fmtTs(h.createdAt)}</span>
        </div>
      </div>
    {/each}
  </div>
</div>

<!-- ── Notas / términos ─────────────────────── -->
{#if cot.notas || cot.terminos}
  <div class="info-grid">
    {#if cot.notas}
      <div class="info-card">
        <h4 class="card-title">Notas</h4>
        <p class="prose">{cot.notas}</p>
      </div>
    {/if}
    {#if cot.terminos}
      <div class="info-card">
        <h4 class="card-title">Términos y condiciones</h4>
        <p class="prose">{cot.terminos}</p>
      </div>
    {/if}
  </div>
{/if}
</div>

<!-- ═══════════════════════════════════════════
     MODAL — Registrar pago
═══════════════════════════════════════════ -->
{#if showPago}
  <div class="modal-overlay" role="presentation" onclick={() => showPago = false}></div>
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-header">
      <h3>Registrar pago</h3>
      <button class="modal-close" onclick={() => showPago = false}>✕</button>
    </div>

    <form method="POST" action="?/registrarPago" class="modal-form" use:enhance>

      {#if errPago._form}
        <div class="banner-error">{errPago._form}</div>
      {/if}

      <div class="form-grid">
        <!-- Monto -->
        <div class="field">
          <label for="monto">Monto <span class="req">*</span></label>
          <input id="monto" name="monto" type="number" step="0.01" min="0.01"
            class:invalid={errPago.monto}
            value={valPago.monto ?? pendiente}
            placeholder="0.00"
          />
          {#if errPago.monto}<span class="field-error">{errPago.monto}</span>{/if}
        </div>

        <!-- Fecha -->
        <div class="field">
          <label for="fechaPago">Fecha de pago <span class="req">*</span></label>
          <input id="fechaPago" name="fechaPago" type="date"
            class:invalid={errPago.fechaPago}
            value={valPago.fechaPago ?? new Date().toISOString().split('T')[0]}
          />
          {#if errPago.fechaPago}<span class="field-error">{errPago.fechaPago}</span>{/if}
        </div>

        <!-- Método -->
        <div class="field full">
          <label for="metodoPago">Método de pago <span class="req">*</span></label>
          <select id="metodoPago" name="metodoPago" class:invalid={errPago.metodoPago}>
            {#each METODOS as m}
              <option value={m.value} selected={valPago.metodoPago === m.value}>{m.label}</option>
            {/each}
          </select>
          {#if errPago.metodoPago}<span class="field-error">{errPago.metodoPago}</span>{/if}
        </div>

        <!-- Referencia -->
        <div class="field">
          <label for="ref">Referencia / folio</label>
          <input id="ref" name="referencia" type="text"
            value={valPago.referencia ?? ''}
            placeholder="Ej: SPEI-12345"
          />
        </div>

        <!-- Notas -->
        <div class="field">
          <label for="notasPago">Notas</label>
          <input id="notasPago" name="notas" type="text"
            value={valPago.notas ?? ''}
            placeholder="Observaciones…"
          />
        </div>
      </div>

      <!-- Resumen pendiente -->
      <div class="pago-resumen">
        <span>Pendiente por cobrar:</span>
        <strong class="pendiente-val">{mxn(pendiente)}</strong>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-ghost" onclick={() => showPago = false}>Cancelar</button>
        <button type="submit" class="btn-primary">Registrar pago</button>
      </div>
    </form>
  </div>
{/if}

<!-- ══ MODAL — Confirmar eliminación de pago ══════════════════════════════ -->
{#if confirmDeleteId}
  <div class="modal-overlay" role="presentation" onclick={() => confirmDeleteId = null}></div>
  <div class="modal modal-sm" role="dialog" aria-modal="true">
    <div class="modal-header">
      <h3>¿Eliminar pago?</h3>
      <button class="modal-close" onclick={() => confirmDeleteId = null}>✕</button>
    </div>
    <div class="modal-form">
      <p class="confirm-text">Esta acción es irreversible. El pago será eliminado permanentemente de esta cotización.</p>
      <form method="POST" action="?/eliminarPago" use:enhance>
        <input type="hidden" name="pagoId" value={confirmDeleteId} />
        <div class="modal-footer">
          <button type="button" class="btn-ghost" onclick={() => confirmDeleteId = null}>Cancelar</button>
          <button type="submit" class="btn-danger-solid">Sí, eliminar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
/* ── Breadcrumb ────────────── */
.breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #8b8fa8; margin-bottom: 16px; }
.bc-link { color: #a78bfa; text-decoration: none; }
.bc-link:hover { text-decoration: underline; }
.bc-sep { color: #444; }

/* ── Header ─────────────────── */
.cot-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.folio-row { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.folio { font-size: 1.5rem; font-weight: 700; color: #f0f0f5; }
.badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; border: 1px solid; }
.cliente-info { font-size: 0.875rem; color: #d4d4e8; margin-bottom: 4px; }
.cliente-link { color: #a78bfa; text-decoration: none; }
.cliente-link:hover { text-decoration: underline; }
.fechas { font-size: 0.8rem; color: #8b8fa8; }
.text-warn { color: #f87171; }

.header-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.btn-trans {
  background: rgba(255,255,255,.06); color: #d4d4e8;
  border: 1px solid rgba(255,255,255,.12); border-radius: 8px;
  padding: 8px 14px; font-size: 0.8rem; font-weight: 500; cursor: pointer;
  transition: all .2s; white-space: nowrap;
}
.btn-trans:hover { background: rgba(255,255,255,.1); color: #fff; }
.btn-trans.btn-danger { color: #fca5a5; border-color: rgba(239,68,68,.3); }
.btn-trans.btn-danger:hover { background: rgba(239,68,68,.1); }

/* ── KPIs ─────────────────────── */
.kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
.kpi-card { background: #1a1d27; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.kpi-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8b8fa8; }
.kpi-val   { font-size: 1.15rem; font-weight: 700; color: #f0f0f5; }
.kpi-val.grand    { color: #a78bfa; }
.kpi-val.cobrado  { color: #34d399; }
.kpi-val.pendiente { color: #fbbf24; }

/* ── Sections ────────────────── */
.section { margin-bottom: 20px; }
.section-title { font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8b8fa8; margin-bottom: 10px; }

/* ── Tables ──────────────────── */
.table-wrap { background: #1a1d27; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; overflow: hidden; }
.detail-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.detail-table thead tr { background: rgba(255,255,255,.03); border-bottom: 1px solid rgba(255,255,255,.08); }
.detail-table th { text-align: left; padding: 10px 14px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8b8fa8; }
.detail-table td { padding: 10px 14px; color: #d4d4e8; border-bottom: 1px solid rgba(255,255,255,.05); }
.detail-table tr:last-child td { border-bottom: none; }
.mono { font-family: 'Courier New', monospace; font-size: 0.83rem; }
.num-cell { color: #8b8fa8; font-size: 0.8rem; }
.cobrado { color: #34d399; }

/* ── Historial ───────────────── */
.historial { display: flex; flex-direction: column; gap: 0; }
.historial-item { display: flex; gap: 16px; position: relative; padding-bottom: 16px; }
.historial-item:not(:last-child)::before { content: ''; position: absolute; left: 7px; top: 18px; bottom: 0; width: 2px; background: rgba(255,255,255,.08); }
.historial-dot { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
.historial-body { flex: 1; background: #1a1d27; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; padding: 10px 14px; }
.historial-row { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; }
.hist-est { font-size: 0.8rem; font-weight: 600; }
.hist-arrow { color: #8b8fa8; }
.hist-nota { font-size: 0.8rem; color: #8b8fa8; margin-top: 4px; }
.hist-ts { font-size: 0.72rem; color: #8b8fa8; display: block; margin-top: 4px; }

/* ── Info grid ───────────────── */
.info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-bottom: 16px; }
.info-card { background: #1a1d27; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 16px 18px; }
.card-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8b8fa8; margin-bottom: 8px; }
.prose { font-size: 0.875rem; color: #d4d4e8; line-height: 1.6; white-space: pre-wrap; }

/* ── Misc ─────────────────────── */
.empty-card { background: #1a1d27; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 24px; text-align: center; color: #8b8fa8; font-size: 0.875rem; }
.banner-error { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3); color: #fca5a5; border-radius: 8px; padding: 10px 16px; font-size: 0.875rem; margin-bottom: 12px; }
.toast { position: fixed; bottom: 24px; right: 24px; background: #22c55e; color: #fff; padding: 12px 20px; border-radius: 10px; font-size: 0.875rem; font-weight: 600; box-shadow: 0 4px 24px rgba(0,0,0,.4); z-index: 1000; animation: slideUp .25s ease; }
@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

/* ── Buttons ─────────────────── */
.btn-primary { background: #6c63ff; color: #fff; border: none; border-radius: 8px; padding: 9px 16px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background .2s; white-space: nowrap; }
.btn-primary:hover { background: #7c74ff; }
.btn-ghost { background: transparent; color: #8b8fa8; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 9px 16px; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all .2s; }
.btn-ghost:hover { background: rgba(255,255,255,.06); color: #f0f0f5; }

/* ── Modal ───────────────────── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); z-index: 200; }
.modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 201; background: #1a1d27; border: 1px solid rgba(255,255,255,.12); border-radius: 16px; width: min(540px, 95vw); max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,.6); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 0; }
.modal-header h3 { font-size: 1.05rem; font-weight: 700; color: #f0f0f5; }
.modal-close { background: transparent; border: none; color: #8b8fa8; font-size: 1.1rem; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
.modal-close:hover { background: rgba(255,255,255,.08); color: #f0f0f5; }
.modal-form { padding: 20px 24px 24px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field.full { grid-column: 1 / -1; }
label { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #8b8fa8; }
.req { color: #ef4444; }
input, select { background: #0f1117; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; color: #f0f0f5; padding: 9px 12px; font-size: 0.875rem; font-family: inherit; outline: none; transition: border-color .2s; }
input:focus, select:focus { border-color: #6c63ff; }
input.invalid, select.invalid { border-color: #ef4444; }
select option { background: #1a1d27; }
.field-error { font-size: 0.75rem; color: #fca5a5; }
.pago-resumen { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,.04); border-radius: 8px; padding: 10px 14px; margin-top: 14px; font-size: 0.875rem; color: #d4d4e8; }
.pendiente-val { color: #fbbf24; font-size: 1rem; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.06); }

/* ── Section header ───────────── */
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.section-header .section-title { margin-bottom: 0; }

/* ── Resumen de pagos ──────────── */
.pagos-resumen { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; padding: 12px 16px; background: rgba(255,255,255,.03); border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,.05); }
.resumen-row { display: flex; gap: 48px; font-size: 0.875rem; color: #d4d4e8; }
.resumen-row.grand { font-size: 1rem; font-weight: 700; color: #f0f0f5; padding-top: 6px; border-top: 1px solid rgba(255,255,255,.06); }
.resumen-label { color: #8b8fa8; font-size: 0.8rem; min-width: 140px; text-align: right; }
.resumen-val { min-width: 110px; text-align: right; }
.saldo-ok   { color: #34d399; }
.saldo-warn { color: #fbbf24; }
.saldo-bad  { color: #f87171; }

/* ── Botón eliminar ──────────────── */
.btn-del { background: transparent; border: 1px solid rgba(239,68,68,.25); color: #f87171; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; transition: all .15s; }
.btn-del:hover { background: rgba(239,68,68,.15); border-color: rgba(239,68,68,.5); }

/* ── Modal de confirmación pequeño ── */
.modal-sm { width: min(400px, 95vw); }
.confirm-text { font-size: 0.875rem; color: #d4d4e8; line-height: 1.6; margin-bottom: 16px; }
.btn-danger-solid { background: #dc2626; color: #fff; border: none; border-radius: 8px; padding: 9px 16px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background .2s; }
.btn-danger-solid:hover { background: #ef4444; }

/* ── Top row actions and breadcrumb layout ── */
.breadcrumb-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 16px;
}
.top-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #f0f0f5;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.25);
}
.btn-icon {
  flex-shrink: 0;
}
</style>
