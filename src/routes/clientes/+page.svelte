<script>
  // Clientes – stub inicial
</script>

<svelte:head>
  <title>Clientes – GestorPyme</title>
</svelte:head>

<div class="page-header">
  <h2>Clientes</h2>
  <button class="btn-primary">+ Nuevo cliente</button>
</div>

<div class="empty-state">
  <span class="empty-icon">👥</span>
  <p>Aún no hay clientes registrados.</p>
  <span class="empty-sub">Crea el primero haciendo clic en "Nuevo cliente".</span>
</div>

<style>
  .page-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 24px;
  }
  .page-header h2 { font-size: 1.25rem; font-weight: 600; }

  .btn-primary {
    background: #6c63ff; color: #fff; border: none;
    border-radius: 8px; padding: 8px 16px;
    font-size: 0.875rem; font-weight: 600; cursor: pointer;
    transition: background .2s;
  }
  .btn-primary:hover { background: #7c74ff; }

  .empty-state {
    display: flex; flex-direction: column; align-items: center;
    gap: 8px; padding: 64px 24px;
    border: 1px dashed rgba(255,255,255,.1); border-radius: 12px;
    color: #8b8fa8;
  }
  .empty-icon { font-size: 3rem; }
  .empty-state p { font-size: 1rem; font-weight: 500; color: #f0f0f5; }
  .empty-sub { font-size: 0.8rem; }
</style>
