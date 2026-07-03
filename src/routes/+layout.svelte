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
    <div class="app-shell" class:sidebar-collapsed={!sidebarOpen}>

      <!-- ===================== SIDEBAR ===================== -->
      <aside class="sidebar">
        <div class="sidebar-brand">
          <span class="brand-icon">⚡</span>
          {#if sidebarOpen}
            <span class="brand-name">GestorPyme</span>
          {/if}
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
              {#if sidebarOpen}
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
