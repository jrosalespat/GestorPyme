<script>
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  const errs = $derived(form?.errors ?? {});
  const vals = $derived(form?.values ?? {});

  // ── Conceptos dinámicos ────────────────────
  let conceptos = $state(
    vals.conceptos?.length
      ? vals.conceptos.map(c => ({
          descripcion: c.descripcion ?? '',
          cantidad: Number(c.cantidad) || 1,
          unidad: c.unidad ?? 'pieza',
          precio: Number(c.precioUnitario) || 0,
          descuento: Number(c.descuento) || 0,
        }))
      : [{ descripcion: '', cantidad: 1, unidad: 'pieza', precio: 0, descuento: 0 }]
  );

  function agregarConcepto() {
    conceptos = [...conceptos, { descripcion: '', cantidad: 1, unidad: 'pieza', precio: 0, descuento: 0 }];
  }

  function eliminarConcepto(i) {
    if (conceptos.length === 1) return;
    conceptos = conceptos.filter((_, idx) => idx !== i);
  }

  // ── Totales reactivos ──────────────────────
  let aplicaIva = $state(vals.aplicaIva !== 'no');

  function subtotalFila(c) {
    return c.cantidad * c.precio * (1 - c.descuento / 100);
  }

  let subtotal   = $derived(conceptos.reduce((acc, c) => acc + subtotalFila(c), 0));
  let ivaAmount  = $derived(aplicaIva ? subtotal * 0.16 : 0);
  let total      = $derived(subtotal + ivaAmount);

  // ── Helpers ────────────────────────────────
  function mxn(v) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN', maximumFractionDigits: 2
    }).format(v ?? 0);
  }

  // Estado del submit: 'borrador' | 'enviada'
  let submitEstado = $state('BORRADOR');
</script>

<svelte:head><title>Nueva cotización – GestorPyme</title></svelte:head>

<div class="breadcrumb">
  <a href="/cotizaciones" class="bc-link">← Cotizaciones</a>
  <span class="bc-sep">/</span>
  <span>Nueva</span>
</div>

<div class="pg-header">
  <div>
    <h2 class="pg-title">Nueva cotización</h2>
    <p class="pg-sub">Folio: <strong>{data.siguienteFolio}</strong></p>
  </div>
</div>

{#if errs._form}
  <div class="banner-error">{errs._form}</div>
{/if}

<form
  method="POST"
  action="?/guardar"
  class="cot-form"
  use:enhance
>
  <!-- Estado oculto, lo controlan los botones de submit -->
  <input type="hidden" name="estado" value={submitEstado} />

  <!-- ═══ SECCIÓN 1: Cliente y configuración ═══════════════════════════ -->
  <section class="card">
    <h3 class="card-title">Datos generales</h3>
    <div class="form-grid">

      <!-- Cliente -->
      <div class="field full">
        <label for="clienteId">Cliente <span class="req">*</span></label>
        {#if data.clientes.length === 0}
          <p class="field-warn">⚠️ No hay clientes activos. <a href="/clientes">Crea uno primero</a>.</p>
        {:else}
          <select
            id="clienteId"
            name="clienteId"
            class:invalid={errs.clienteId}
          >
            <option value="">— Selecciona un cliente —</option>
            {#each data.clientes as c}
              <option value={c.id} selected={vals.clienteId === c.id}>
                {c.nombre}{c.empresa ? ` — ${c.empresa}` : ''}
              </option>
            {/each}
          </select>
        {/if}
        {#if errs.clienteId}<span class="field-error">{errs.clienteId}</span>{/if}
      </div>

      <!-- Moneda -->
      <div class="field">
        <label for="moneda">Moneda</label>
        <select id="moneda" name="moneda">
          <option value="MXN" selected={vals.moneda !== 'USD'}>MXN – Peso mexicano</option>
          <option value="USD" selected={vals.moneda === 'USD'}>USD – Dólar americano</option>
        </select>
      </div>

      <!-- Vigencia -->
      <div class="field">
        <label for="validezDias">Vigencia (días)</label>
        <input
          id="validezDias"
          name="validezDias"
          type="number"
          min="1" max="365"
          value={vals.validezDias ?? 30}
        />
      </div>

      <!-- IVA -->
      <div class="field">
        <label>¿Aplica IVA 16%?</label>
        <div class="radio-group">
          <label class="radio-label">
            <input
              type="radio"
              name="aplicaIva"
              value="si"
              checked={aplicaIva}
              onchange={() => aplicaIva = true}
            /> Sí
          </label>
          <label class="radio-label">
            <input
              type="radio"
              name="aplicaIva"
              value="no"
              checked={!aplicaIva}
              onchange={() => aplicaIva = false}
            /> No
          </label>
        </div>
      </div>

    </div>
  </section>

  <!-- ═══ SECCIÓN 2: Conceptos ══════════════════════════════════════════ -->
  <section class="card">
    <div class="card-header-row">
      <h3 class="card-title">Conceptos</h3>
      <button type="button" class="btn-ghost-sm" onclick={agregarConcepto}>+ Agregar concepto</button>
    </div>

    {#if errs.conceptos}
      <div class="banner-error small">{errs.conceptos}</div>
    {/if}

    <div class="conceptos-wrap">
      <table class="conceptos-table">
        <thead>
          <tr>
            <th style="width:35%">Descripción</th>
            <th style="width:8%">Cant.</th>
            <th style="width:10%">Unidad</th>
            <th style="width:14%">Precio unit.</th>
            <th style="width:8%">Desc. %</th>
            <th style="width:14%">Subtotal</th>
            <th style="width:5%"></th>
          </tr>
        </thead>
        <tbody>
          {#each conceptos as c, i (i)}
            <tr>
              <td>
                <!-- Hidden fields para campos sin input visible propio -->
                <input type="hidden" name="disc_{i}" value={c.descuento} />
                <input
                  class="cell-input"
                  type="text"
                  name="desc_{i}"
                  placeholder="Descripción del servicio o producto…"
                  bind:value={c.descripcion}
                />
              </td>
              <td>
                <input
                  class="cell-input text-center"
                  type="number"
                  name="qty_{i}"
                  min="0.01"
                  step="any"
                  bind:value={c.cantidad}
                />
              </td>
              <td>
                <input
                  class="cell-input"
                  type="text"
                  name="unit_{i}"
                  placeholder="pieza"
                  bind:value={c.unidad}
                />
              </td>
              <td>
                <input
                  class="cell-input text-right"
                  type="number"
                  name="price_{i}"
                  min="0"
                  step="any"
                  bind:value={c.precio}
                />
              </td>
              <td>
                <input
                  class="cell-input text-center"
                  type="number"
                  min="0" max="100"
                  bind:value={c.descuento}
                  oninput={() => { conceptos = [...conceptos]; }}
                />
              </td>
              <td class="subtotal-cell">{mxn(subtotalFila(c))}</td>
              <td>
                <button
                  type="button"
                  class="del-btn"
                  disabled={conceptos.length === 1}
                  onclick={() => eliminarConcepto(i)}
                  title="Eliminar fila"
                >✕</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Totales -->
    <div class="totales">
      <div class="total-row">
        <span>Subtotal</span>
        <span class="mono">{mxn(subtotal)}</span>
      </div>
      {#if aplicaIva}
        <div class="total-row">
          <span>IVA 16%</span>
          <span class="mono">{mxn(ivaAmount)}</span>
        </div>
      {/if}
      <div class="total-row grand">
        <span>Total</span>
        <span class="mono">{mxn(total)}</span>
      </div>
    </div>
  </section>

  <!-- ═══ SECCIÓN 3: Notas y términos ══════════════════════════════════ -->
  <section class="card">
    <h3 class="card-title">Notas y términos</h3>
    <div class="form-grid">
      <div class="field full">
        <label for="notas">Notas internas (no visibles para el cliente)</label>
        <textarea id="notas" name="notas" rows="3" placeholder="Observaciones, comentarios…">{vals.notas ?? ''}</textarea>
      </div>
      <div class="field full">
        <label for="terminos">Términos y condiciones</label>
        <textarea id="terminos" name="terminos" rows="3" placeholder="Ej: Pago a 30 días. Precios no incluyen IVA…">{vals.terminos ?? ''}</textarea>
      </div>
    </div>
  </section>

  <!-- ═══ FOOTER ACCIONES ═══════════════════════════════════════════════ -->
  <div class="form-footer">
    <a href="/cotizaciones" class="btn-ghost">Cancelar</a>
    <div class="submit-group">
      <button
        type="submit"
        class="btn-ghost"
        onclick={() => submitEstado = 'BORRADOR'}
      >
        💾 Guardar borrador
      </button>
      <button
        type="submit"
        class="btn-primary"
        onclick={() => submitEstado = 'ENVIADA'}
      >
        📤 Enviar al cliente
      </button>
    </div>
  </div>

</form>

<style>
/* ── Layout ─────────────────── */
.breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #8b8fa8; margin-bottom: 16px; }
.bc-link { color: #a78bfa; text-decoration: none; }
.bc-link:hover { text-decoration: underline; }
.bc-sep { color: #444; }

.pg-header { margin-bottom: 20px; }
.pg-title  { font-size: 1.25rem; font-weight: 700; color: #f0f0f5; }
.pg-sub    { font-size: 0.8rem; color: #8b8fa8; margin-top: 4px; }

.cot-form  { display: flex; flex-direction: column; gap: 16px; }

/* ── Card ───────────────────── */
.card {
  background: #1a1d27;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  padding: 20px 24px;
}
.card-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.card-title { font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8b8fa8; margin-bottom: 16px; }
.card-header-row .card-title { margin-bottom: 0; }

/* ── Form fields ────────────── */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field.full { grid-column: 1 / -1; }

label { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #8b8fa8; }
.req  { color: #ef4444; }

input[type="text"], input[type="number"], textarea, select {
  background: #0f1117;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px;
  color: #f0f0f5;
  padding: 9px 12px;
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  transition: border-color .2s;
  resize: vertical;
}
input:focus, textarea:focus, select:focus { border-color: #6c63ff; }
input.invalid, select.invalid { border-color: #ef4444; }
select option { background: #1a1d27; }

.radio-group { display: flex; gap: 16px; align-items: center; padding: 10px 0; }
.radio-label { display: flex; align-items: center; gap: 6px; font-size: 0.875rem; color: #d4d4e8; cursor: pointer; text-transform: none; letter-spacing: 0; font-weight: 400; }

.field-warn { font-size: 0.85rem; color: #fbbf24; }
.field-warn a { color: #a78bfa; }
.field-error { font-size: 0.75rem; color: #fca5a5; }

/* ── Conceptos table ─────────── */
.conceptos-wrap { overflow-x: auto; margin: 0 -4px; }
.conceptos-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.conceptos-table thead tr { border-bottom: 1px solid rgba(255,255,255,.08); }
.conceptos-table th { text-align: left; padding: 8px 6px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; color: #8b8fa8; letter-spacing: .04em; }
.conceptos-table td { padding: 5px 4px; vertical-align: middle; }
.conceptos-table tbody tr:not(:last-child) td { border-bottom: 1px solid rgba(255,255,255,.04); }

.cell-input {
  width: 100%; background: #0f1117;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 6px; color: #f0f0f5;
  padding: 6px 8px; font-size: 0.82rem;
  font-family: inherit; outline: none;
  transition: border-color .2s;
}
.cell-input:focus { border-color: #6c63ff; }
.text-center { text-align: center; }
.text-right  { text-align: right; }

.subtotal-cell { text-align: right; font-family: 'Courier New', monospace; color: #a78bfa; font-weight: 600; padding-right: 12px; white-space: nowrap; }

.del-btn {
  background: transparent; border: 1px solid rgba(239,68,68,.3);
  color: #f87171; border-radius: 6px;
  width: 26px; height: 26px;
  cursor: pointer; font-size: 0.7rem;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s;
}
.del-btn:hover:not(:disabled) { background: rgba(239,68,68,.15); }
.del-btn:disabled { opacity: .3; cursor: not-allowed; }

/* ── Totales ─────────────────── */
.totales { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.08); display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.total-row { display: flex; gap: 48px; font-size: 0.875rem; color: #d4d4e8; }
.total-row.grand { font-size: 1.1rem; font-weight: 700; color: #f0f0f5; padding-top: 6px; border-top: 1px solid rgba(255,255,255,.08); }
.mono { font-family: 'Courier New', monospace; min-width: 110px; text-align: right; }

/* ── Banners ─────────────────── */
.banner-error {
  background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3);
  color: #fca5a5; border-radius: 8px; padding: 10px 16px;
  font-size: 0.875rem; margin-bottom: 12px;
}
.banner-error.small { font-size: 0.8rem; padding: 8px 12px; margin-top: 8px; margin-bottom: 0; }

/* ── Footer acciones ─────────── */
.form-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 4px 0 8px; }
.submit-group { display: flex; gap: 10px; }

.btn-primary {
  background: #6c63ff; color: #fff; border: none; border-radius: 8px;
  padding: 10px 20px; font-size: 0.875rem; font-weight: 600; cursor: pointer;
  text-decoration: none; display: inline-block; transition: background .2s;
}
.btn-primary:hover { background: #7c74ff; }

.btn-ghost {
  background: transparent; color: #8b8fa8; border: 1px solid rgba(255,255,255,.12);
  border-radius: 8px; padding: 10px 18px; font-size: 0.875rem; font-weight: 500;
  cursor: pointer; text-decoration: none; display: inline-block; transition: all .2s;
}
.btn-ghost:hover { background: rgba(255,255,255,.06); color: #f0f0f5; }

.btn-ghost-sm {
  background: transparent; color: #6c63ff; border: 1px solid rgba(108,99,255,.3);
  border-radius: 6px; padding: 6px 12px; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; transition: all .2s;
}
.btn-ghost-sm:hover { background: rgba(108,99,255,.1); }
</style>
