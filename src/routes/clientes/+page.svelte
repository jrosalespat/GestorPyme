<script>
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';

  let { data, form } = $props();

  // ── Búsqueda y paginación ──────────────────
  let busqueda = $state('');
  let pagina   = $state(1);
  const POR_PAGINA = 20;

  let clientesFiltrados = $derived(
    data.clientes.filter(c => {
      const q = busqueda.toLowerCase();
      return (
        c.nombre.toLowerCase().includes(q) ||
        (c.empresa ?? '').toLowerCase().includes(q) ||
        (c.rfc ?? '').toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    })
  );

  let totalPaginas = $derived(Math.max(1, Math.ceil(clientesFiltrados.length / POR_PAGINA)));

  let clientesPagina = $derived(
    clientesFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  );

  // Resetear página al cambiar búsqueda
  $effect(() => { busqueda; pagina = 1; });

  // ── Estado del modal ───────────────────────
  let showModal  = $state(false);
  let modoEditar = $state(false);
  let clienteEdit = $state(null); // cliente seleccionado para editar

  function abrirCrear() {
    clienteEdit = null;
    modoEditar  = false;
    showModal   = true;
  }

  function abrirEditar(c) {
    clienteEdit = c;
    modoEditar  = true;
    showModal   = true;
  }

  function cerrarModal() {
    showModal   = false;
    clienteEdit = null;
    modoEditar  = false;
  }

  // ── Flash tras submit exitoso ──────────────
  let flash = $state('');

  $effect(() => {
    if (form?.success && form?.flash) {
      flash = form.flash;
      showModal = false;
      invalidate('app:clientes');
      setTimeout(() => flash = '', 4000);
    }
    // Reabrir modal con errores
    if (form?.errors && !form?.success) {
      showModal = true;
      modoEditar = form.action === 'editar';
    }
  });

  // ── Valores del formulario con fallback a errores devueltos ──
  let vals = $derived(form?.values ?? {});
  let errs = $derived(form?.errors ?? {});

  // ── Helpers ────────────────────────────────
  function fmt(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
</script>

<svelte:head>
  <title>Clientes – GestorPyme</title>
</svelte:head>

<!-- ── Toast flash ─────────────────────────── -->
{#if flash}
  <div class="toast">✅ {flash}</div>
{/if}

<!-- ── Header ──────────────────────────────── -->
<div class="pg-header">
  <div>
    <h2 class="pg-title">Clientes</h2>
    <p class="pg-sub">{data.clientes.length} clientes activos</p>
  </div>
  <button class="btn-primary" onclick={abrirCrear}>+ Nuevo cliente</button>
</div>

<!-- ── Búsqueda ────────────────────────────── -->
<div class="toolbar">
  <div class="search-wrap">
    <span class="search-icon">🔍</span>
    <input
      class="search-input"
      type="search"
      placeholder="Buscar por nombre, empresa, RFC o correo…"
      bind:value={busqueda}
    />
  </div>
  <span class="count-badge">{clientesFiltrados.length} resultado{clientesFiltrados.length !== 1 ? 's' : ''}</span>
</div>

<!-- ── Tabla ───────────────────────────────── -->
<div class="table-wrap">
  {#if clientesPagina.length === 0}
    <div class="empty-state">
      <span>👥</span>
      <p>{busqueda ? 'Sin resultados para esa búsqueda.' : 'Aún no hay clientes. ¡Crea el primero!'}</p>
    </div>
  {:else}
      <table class="clientes-table">
        <thead>
          <tr>
            <th>Nombre / Empresa</th>
            <th>RFC</th>
            <th>Correo</th>
            <th>Teléfono</th>
            <th>Alta</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {#each clientesPagina as c (c.id)}
            <tr>
              <td>
                <a href="/clientes/{c.id}" class="cliente-link">{c.nombre}</a>
                {#if c.empresa}<span class="empresa-sub">{c.empresa}</span>{/if}
              </td>
              <td class="mono">{c.rfc ?? '—'}</td>
              <td>{c.email}</td>
              <td>{c.telefono ?? '—'}</td>
              <td>{fmt(c.createdAt)}</td>
              <td class="actions-cell">
                <a href="/clientes/{c.id}" class="btn-icon" title="Ver perfil">👁</a>
                <button class="btn-icon" title="Editar" onclick={() => abrirEditar(c)}>✏️</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

    <!-- ── Paginación ──────────────────────── -->
    {#if totalPaginas > 1}
      <div class="pagination">
        <button
          class="pag-btn"
          disabled={pagina === 1}
          onclick={() => pagina--}
        >‹ Anterior</button>

        {#each Array.from({ length: totalPaginas }, (_, i) => i + 1) as p}
          <button
            class="pag-btn"
            class:active={p === pagina}
            onclick={() => pagina = p}
          >{p}</button>
        {/each}

        <button
          class="pag-btn"
          disabled={pagina === totalPaginas}
          onclick={() => pagina++}
        >Siguiente ›</button>
      </div>
    {/if}
  {/if}
</div>

<!-- ═══════════════════════════════════════════
     MODAL — Crear / Editar cliente
═══════════════════════════════════════════ -->
{#if showModal}
  <!-- Overlay -->
  <div class="modal-overlay" role="presentation" onclick={cerrarModal}></div>

  <div class="modal" role="dialog" aria-modal="true" aria-label={modoEditar ? 'Editar cliente' : 'Nuevo cliente'}>
    <div class="modal-header">
      <h3>{modoEditar ? 'Editar cliente' : 'Nuevo cliente'}</h3>
      <button class="modal-close" onclick={cerrarModal}>✕</button>
    </div>

    <form
      method="POST"
      action="?/{modoEditar ? 'editar' : 'crear'}"
      class="modal-form"
      use:enhance
    >
      {#if modoEditar}
        <input type="hidden" name="id" value={clienteEdit?.id ?? form?.editId ?? ''} />
      {/if}

      <!-- Error global del formulario -->
      {#if errs._form}
        <div class="form-error-banner">{errs._form}</div>
      {/if}

      <div class="form-grid">
        <!-- Nombre -->
        <div class="field">
          <label for="nombre">Nombre <span class="req">*</span></label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            class:invalid={errs.nombre}
            value={vals.nombre ?? clienteEdit?.nombre ?? ''}
            required
          />
          {#if errs.nombre}<span class="field-error">{errs.nombre}</span>{/if}
        </div>

        <!-- Empresa -->
        <div class="field">
          <label for="empresa">Empresa</label>
          <input
            id="empresa"
            name="empresa"
            type="text"
            class:invalid={errs.empresa}
            value={vals.empresa ?? clienteEdit?.empresa ?? ''}
          />
          {#if errs.empresa}<span class="field-error">{errs.empresa}</span>{/if}
        </div>

        <!-- RFC -->
        <div class="field">
          <label for="rfc">RFC</label>
          <input
            id="rfc"
            name="rfc"
            type="text"
            placeholder="Ej: XAXX010101000"
            class:invalid={errs.rfc}
            value={vals.rfc ?? clienteEdit?.rfc ?? ''}
            oninput={(e) => { e.currentTarget.value = e.currentTarget.value.toUpperCase(); }}
          />
          {#if errs.rfc}<span class="field-error">{errs.rfc}</span>{/if}
        </div>

        <!-- Correo -->
        <div class="field">
          <label for="email">Correo <span class="req">*</span></label>
          <input
            id="email"
            name="email"
            type="email"
            class:invalid={errs.email}
            value={vals.email ?? clienteEdit?.email ?? ''}
            required
          />
          {#if errs.email}<span class="field-error">{errs.email}</span>{/if}
        </div>

        <!-- Teléfono -->
        <div class="field">
          <label for="telefono">Teléfono</label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            class:invalid={errs.telefono}
            value={vals.telefono ?? clienteEdit?.telefono ?? ''}
          />
          {#if errs.telefono}<span class="field-error">{errs.telefono}</span>{/if}
        </div>

        <!-- Dirección (full width) -->
        <div class="field full">
          <label for="direccion">Dirección</label>
          <input
            id="direccion"
            name="direccion"
            type="text"
            class:invalid={errs.direccion}
            value={vals.direccion ?? clienteEdit?.direccion ?? ''}
          />
          {#if errs.direccion}<span class="field-error">{errs.direccion}</span>{/if}
        </div>

        <!-- Notas (full width) -->
        <div class="field full">
          <label for="notas">Notas</label>
          <textarea
            id="notas"
            name="notas"
            rows="3"
            class:invalid={errs.notas}
            placeholder="Información adicional sobre el cliente…"
          >{vals.notas ?? clienteEdit?.notas ?? ''}</textarea>
          {#if errs.notas}<span class="field-error">{errs.notas}</span>{/if}
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-ghost" onclick={cerrarModal}>Cancelar</button>
        <button type="submit" class="btn-primary">
          {modoEditar ? 'Guardar cambios' : 'Crear cliente'}
        </button>
      </div>
    </form>
  </div>
{/if}

<style>
/* ── Layout ───────────────── */
.pg-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 16px;
}
.pg-title { font-size: 1.25rem; font-weight: 700; color: #f0f0f5; }
.pg-sub   { font-size: 0.8rem; color: #8b8fa8; margin-top: 2px; }

/* ── Toolbar ──────────────── */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.search-wrap {
  position: relative;
  flex: 1;
  min-width: 220px;
}
.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9rem;
}
.search-input {
  width: 100%;
  background: #1a1d27;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px;
  color: #f0f0f5;
  padding: 9px 12px 9px 36px;
  font-size: 0.875rem;
  outline: none;
  transition: border-color .2s;
}
.search-input:focus { border-color: #6c63ff; }
.search-input::placeholder { color: #8b8fa8; }
.count-badge {
  font-size: 0.75rem;
  color: #8b8fa8;
  white-space: nowrap;
}

/* ── Table ────────────────── */
.table-wrap {
  background: #1a1d27;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.08);
  overflow-x: auto;
  max-width: 100%;
}
.clientes-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.clientes-table thead tr {
  background: rgba(255,255,255,.03);
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.clientes-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8b8fa8;
}
.clientes-table tbody tr {
  border-bottom: 1px solid rgba(255,255,255,.05);
  transition: background .15s;
}
.clientes-table tbody tr:last-child { border-bottom: none; }
.clientes-table tbody tr:hover { background: rgba(255,255,255,.03); }
.clientes-table td {
  padding: 12px 16px;
  color: #d4d4e8;
  vertical-align: middle;
}
.cliente-link {
  color: #a78bfa;
  text-decoration: none;
  font-weight: 600;
}
.cliente-link:hover { text-decoration: underline; }
.empresa-sub {
  display: block;
  font-size: 0.75rem;
  color: #8b8fa8;
  margin-top: 1px;
}
.mono { font-family: 'Courier New', monospace; font-size: 0.82rem; }
.actions-cell { white-space: nowrap; }

/* ── Empty state ─────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 60px 24px;
  color: #8b8fa8;
  font-size: 0.9rem;
}
.empty-state span { font-size: 2.5rem; }

/* ── Buttons ──────────────── */
.btn-primary {
  background: #6c63ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 9px 18px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background .2s;
  white-space: nowrap;
}
.btn-primary:hover { background: #7c74ff; }

.btn-ghost {
  background: transparent;
  color: #8b8fa8;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 8px;
  padding: 9px 18px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background .2s, color .2s;
}
.btn-ghost:hover { background: rgba(255,255,255,.06); color: #f0f0f5; }

.btn-icon {
  background: transparent;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background .15s;
  margin-left: 4px;
}
.btn-icon:hover { background: rgba(255,255,255,.08); }

/* ── Pagination ───────────── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px;
  border-top: 1px solid rgba(255,255,255,.06);
}
.pag-btn {
  background: transparent;
  border: 1px solid rgba(255,255,255,.1);
  color: #8b8fa8;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all .15s;
}
.pag-btn:hover:not(:disabled) { background: rgba(255,255,255,.08); color: #f0f0f5; }
.pag-btn.active { background: #6c63ff; border-color: #6c63ff; color: #fff; }
.pag-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── Toast ────────────────── */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #22c55e;
  color: #fff;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 4px 24px rgba(0,0,0,.4);
  z-index: 1000;
  animation: slideUp .25s ease;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Modal ────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.6);
  backdrop-filter: blur(4px);
  z-index: 200;
}
.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 201;
  background: #1a1d27;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 16px;
  width: min(640px, 95vw);
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 64px rgba(0,0,0,.6);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}
.modal-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: #f0f0f5;
}
.modal-close {
  background: transparent;
  border: none;
  color: #8b8fa8;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background .15s, color .15s;
}
.modal-close:hover { background: rgba(255,255,255,.08); color: #f0f0f5; }

/* ── Form ─────────────────── */
.modal-form { padding: 20px 24px 24px; }

.form-error-banner {
  background: rgba(239,68,68,.15);
  border: 1px solid rgba(239,68,68,.3);
  color: #fca5a5;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.85rem;
  margin-bottom: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.field { display: flex; flex-direction: column; gap: 5px; }
.field.full { grid-column: 1 / -1; }

label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #8b8fa8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.req { color: #ef4444; }

input, textarea {
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
input:focus, textarea:focus { border-color: #6c63ff; }
input.invalid, textarea.invalid { border-color: #ef4444; }

.field-error {
  font-size: 0.75rem;
  color: #fca5a5;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,.06);
}
</style>
