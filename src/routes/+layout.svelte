<script>
  import './layout.css';
  import { page } from '$app/stores';
  import { ClerkProvider, ClerkLoaded, UserButton } from 'svelte-clerk';
  import { PUBLIC_CLERK_PUBLISHABLE_KEY } from '$env/static/public';

  let { children, data } = $props();

  const navItems = [
    { href: '/dashboard',    label: 'Dashboard',    icon: '📊' },
    { href: '/clientes',     label: 'Clientes',     icon: '👥' },
    { href: '/cotizaciones', label: 'Cotizaciones', icon: '📄' },
    { href: '/cobranza',     label: 'Cobranza',     icon: '💰' },
  ];

  let sidebarOpen = $state(true);

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  // La ruta /sign-in no lleva el shell de la app
  let isSignInPage = $derived($page.url.pathname.startsWith('/sign-in'));

  // Título de la sección activa
  let pageTitle = $derived(
    navItems.find(n => $page.url.pathname.startsWith(n.href))?.label ?? 'GestorPyme'
  );
  let mobileSidebarOpen = $state(false);

  $effect(() => {
    // Cerrar sidebar al cambiar de ruta
    const path = $page.url.pathname;
    mobileSidebarOpen = false;
  });
</script>

<svelte:head>
  <title>{pageTitle} – GestorPyme</title>
  <meta name="description" content="Sistema de gestión para pequeñas y medianas empresas" />
</svelte:head>

<!--
  ClerkProvider inicializa Clerk en el cliente con la publishable key.
  El initialState proviene del servidor (inyectado por svelte-clerk/server en hooks.server.js).
-->
<ClerkProvider publishableKey={PUBLIC_CLERK_PUBLISHABLE_KEY} initialState={data?.initialState}>

  {#if isSignInPage}
    <!-- Páginas públicas: sign-in sin shell -->
    {@render children()}

  {:else}
    <!-- Shell protegido: handleClerk en hooks.server.js redirige a /sign-in si no hay sesión -->
    <!-- Barra superior (Header móvil) visible solo en pantallas pequeñas (md:hidden) -->
    <div class="mobile-header">
      <div class="flex items-center gap-2">
        <span class="text-xl">⚡</span>
        <span class="text-lg font-bold bg-gradient-to-r from-[#6c63ff] to-[#a78bfa] bg-clip-text text-transparent">GestorPyme</span>
      </div>
      <button class="mobile-menu-btn" onclick={() => mobileSidebarOpen = true} aria-label="Abrir menú">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>
    </div>

    <div class="app-shell" class:sidebar-collapsed={!sidebarOpen}>

      <!-- Backdrop en móvil -->
      {#if mobileSidebarOpen}
        <div class="fixed inset-0 z-40 bg-black/60 md:hidden" role="presentation" onclick={() => mobileSidebarOpen = false}></div>
      {/if}

      <!-- ===================== SIDEBAR ===================== -->
      <aside class="sidebar fixed inset-y-0 left-0 z-50 w-[240px] transition-transform duration-300 ease-in-out md:translate-x-0 md:relative md:flex md:flex-col md:h-screen {mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} {!sidebarOpen ? 'md:w-[64px]' : 'md:w-[240px]'}" style="background: var(--bg-surface); border-right: 1px solid var(--border); display: flex; flex-direction: column;">
        <div class="sidebar-brand flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.08)] min-h-[64px] md:py-5 md:px-4">
          <div class="flex items-center gap-2">
            <span class="brand-icon">⚡</span>
            {#if sidebarOpen || mobileSidebarOpen}
              <span class="brand-name">GestorPyme</span>
            {/if}
          </div>
          <!-- Botón de cerrar solo móvil -->
          <button class="mobile-close-btn md:hidden" onclick={() => mobileSidebarOpen = false} aria-label="Cerrar menú">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <nav class="sidebar-nav">
          {#each navItems as item}
            <a
              href={item.href}
              class="nav-link"
              class:active={$page.url.pathname.startsWith(item.href)}
              title={item.label}
            >
              <span class="nav-icon">{item.icon}</span>
              {#if sidebarOpen || mobileSidebarOpen}
                <span class="nav-label">{item.label}</span>
              {/if}
            </a>
          {/each}
        </nav>

        <div class="sidebar-footer">
          <button class="toggle-btn" onclick={toggleSidebar} title="Colapsar menú">
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
      </aside>

      <!-- ===================== MAIN ===================== -->
      <div class="main-wrapper">
        <!-- HEADER -->
        <header class="app-header">
          <div class="header-left">
            <h1 class="page-title">{pageTitle}</h1>
          </div>

          <div class="header-right">
            <ClerkLoaded>
              <div class="user-info">
                {#if data?.user}
                  <div class="user-details">
                    <span class="user-name">
                      {data.user.firstName ?? ''} {data.user.lastName ?? ''}
                    </span>
                    <span class="user-email">
                      {data.user.emailAddresses?.[0]?.emailAddress ?? ''}
                    </span>
                  </div>
                {/if}
                <!-- Avatar + dropdown de cuenta + cerrar sesión (nativo de Clerk) -->
                <UserButton afterSignOutUrl="/sign-in" />
              </div>
            </ClerkLoaded>
          </div>
        </header>

        <!-- CONTENIDO DE LA RUTA -->
        <main class="app-content">
          {@render children()}
        </main>
      </div>
    </div>
  {/if}

</ClerkProvider>
