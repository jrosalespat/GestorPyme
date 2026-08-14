import 'dart:async';
import 'dart:collection';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'offline_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  InAppWebViewController? _webViewController;
  double _progress = 0.0;
  bool _isLoading = true;
  bool _isOffline = false;
  int _currentTabIndex = 0;
  bool _showBackButton = false;
  bool _isSignInPage = false;
  String _pageTitle = 'GestorPyme';

  final String _baseUrl = 'https://gestorpyme.onrender.com';
  late StreamSubscription<List<ConnectivityResult>> _connectivitySubscription;

  // CSS de inyección para adaptar el diseño web a la app móvil
  final String _injectedCss = """
    aside.sidebar, header.app-header, .sidebar-footer, .toggle-btn {
      display: none !important;
    }
    .app-shell {
      display: block !important;
      grid-template-columns: 1fr !important;
      height: 100vh !important;
      overflow: auto !important;
    }
    .main-wrapper {
      display: block !important;
      height: auto !important;
      min-height: 100vh !important;
      overflow: visible !important;
    }
    .app-content {
      padding: 16px !important;
      overflow-y: visible !important;
      height: auto !important;
    }
    body {
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch;
      background-color: #0f1117 !important;
    }
  """;

  @override
  void initState() {
    super.initState();
    _checkConnectivity();
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((List<ConnectivityResult> results) {
      final hasConnection = results.isNotEmpty && results.first != ConnectivityResult.none;
      setState(() {
        _isOffline = !hasConnection;
      });
      if (hasConnection && _webViewController != null) {
        _webViewController?.reload();
      }
    });
  }

  @override
  void dispose() {
    _connectivitySubscription.cancel();
    super.dispose();
  }

  Future<void> _checkConnectivity() async {
    final result = await Connectivity().checkConnectivity();
    final hasConnection = result.isNotEmpty && result.first != ConnectivityResult.none;
    setState(() {
      _isOffline = !hasConnection;
    });
  }

  void _onTabTapped(int index) {
    if (_webViewController == null) return;

    String targetPath = '/dashboard';
    switch (index) {
      case 0:
        targetPath = '/dashboard';
        break;
      case 1:
        targetPath = '/clientes';
        break;
      case 2:
        targetPath = '/cotizaciones';
        break;
      case 3:
        targetPath = '/cobranza';
        break;
    }

    _webViewController?.loadUrl(
      urlRequest: URLRequest(
        url: WebUri('$_baseUrl$targetPath'),
      ),
    );
  }

  void _syncNavigationState(WebUri? uri) {
    if (uri == null) return;
    final path = uri.path;

    // Detectar si está en la página de inicio de sesión
    final isSignIn = path.startsWith('/sign-in');

    int index = _currentTabIndex;
    String title = 'GestorPyme';
    bool showBack = false;

    if (path.startsWith('/dashboard')) {
      index = 0;
      title = 'Dashboard';
    } else if (path.startsWith('/clientes')) {
      index = 1;
      title = 'Clientes';
      if (path != '/clientes' && path != '/clientes/') {
        showBack = true;
        if (path.contains('/nueva') || path.contains('/crear')) {
          title = 'Nuevo Cliente';
        } else {
          title = 'Detalle de Cliente';
        }
      }
    } else if (path.startsWith('/cotizaciones')) {
      index = 2;
      title = 'Cotizaciones';
      if (path != '/cotizaciones' && path != '/cotizaciones/') {
        showBack = true;
        if (path.contains('/nueva') || path.contains('/crear')) {
          title = 'Nueva Cotización';
        } else {
          title = 'Detalle de Cotización';
        }
      }
    } else if (path.startsWith('/cobranza')) {
      index = 3;
      title = 'Cobranza';
      if (path != '/cobranza' && path != '/cobranza/') {
        showBack = true;
      }
    } else if (isSignIn) {
      title = 'Iniciar Sesión';
    }

    setState(() {
      _currentTabIndex = index;
      _pageTitle = title;
      _showBackButton = showBack;
      _isSignInPage = isSignIn;
    });
  }

  void _applyThemeAndLayout() {
    // Inyectamos CSS para ocultar el header y sidebar web
    _webViewController?.evaluateJavascript(source: """
      (function() {
        var styleId = 'mobile-injected-styles';
        var style = document.getElementById(styleId);
        if (!style) {
          style = document.createElement('style');
          style.id = styleId;
          style.innerHTML = `$_injectedCss`;
          document.head.appendChild(style);
        }
      })();
    """);
  }

  Future<bool> _onWillPop() async {
    if (_webViewController != null && await _webViewController!.canGoBack()) {
      await _webViewController!.goBack();
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    if (_isOffline) {
      return OfflineScreen(
        onRetry: () {
          _checkConnectivity();
          if (!_isOffline && _webViewController != null) {
            _webViewController?.reload();
          }
        },
      );
    }

    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        backgroundColor: const Color(0xff0f1117),
        appBar: AppBar(
          backgroundColor: const Color(0xff1a1d27),
          elevation: 4,
          shadowColor: Colors.black26,
          title: Text(
            _pageTitle,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 18,
            ),
          ),
          leading: _showBackButton
              ? IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  onPressed: () async {
                    if (await _webViewController!.canGoBack()) {
                      await _webViewController!.goBack();
                    }
                  },
                )
              : Container(
                  margin: const EdgeInsets.all(12),
                  child: const Center(
                    child: Text(
                      '⚡',
                      style: TextStyle(fontSize: 20),
                    ),
                  ),
                ),
          actions: [
            if (!_isSignInPage)
              IconButton(
                icon: const Icon(Icons.refresh, color: Color(0xff8b8fa8)),
                onPressed: () {
                  _webViewController?.reload();
                },
              ),
          ],
          bottom: _isLoading
              ? PreferredSize(
                  preferredSize: const Size.fromHeight(2.0),
                  child: LinearProgressIndicator(
                    value: _progress,
                    backgroundColor: const Color(0xff22263a),
                    valueColor: const AlwaysStoppedAnimation<Color>(Color(0xff6c63ff)),
                    minHeight: 2.0,
                  ),
                )
              : null,
        ),
        body: RefreshIndicator(
          color: const Color(0xff6c63ff),
          backgroundColor: const Color(0xff1a1d27),
          onRefresh: () async {
            await _webViewController?.reload();
          },
          child: InAppWebView(
            initialUrlRequest: URLRequest(
              url: WebUri('$_baseUrl/dashboard'),
            ),
            initialSettings: InAppWebViewSettings(
              userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
              useShouldOverrideUrlLoading: true,
              mediaPlaybackRequiresUserGesture: false,
              useOnDownloadStart: true,
              javaScriptEnabled: true,
              domStorageEnabled: true,
              databaseEnabled: true,
              thirdPartyCookiesEnabled: true,
              sharedCookiesEnabled: true,
              supportZoom: false,
              verticalScrollBarEnabled: false,
              horizontalScrollBarEnabled: false,
            ),
            initialUserScripts: UnmodifiableListView<UserScript>([
              UserScript(
                source: """
                  (function() {
                    var style = document.createElement('style');
                    style.innerHTML = `$_injectedCss`;
                    document.head.appendChild(style);
                  })();
                """,
                injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
              ),
            ]),
            onWebViewCreated: (controller) {
              _webViewController = controller;
            },
            onLoadStart: (controller, url) {
              setState(() {
                _isLoading = true;
                _progress = 0.0;
              });
              _syncNavigationState(url);
            },
            onLoadStop: (controller, url) async {
              setState(() {
                _isLoading = false;
              });
              _syncNavigationState(url);
              _applyThemeAndLayout();
            },
            onProgressChanged: (controller, progress) {
              setState(() {
                _progress = progress / 100;
                if (progress == 100) {
                  _isLoading = false;
                }
              });
              _applyThemeAndLayout();
            },
            onUpdateVisitedHistory: (controller, url, androidIsReload) {
              _syncNavigationState(url);
              _applyThemeAndLayout();
            },
            onReceivedError: (controller, request, error) {
              // Interceptar fallas DNS o de conexión y mostrar pantalla offline
              final errorTypeStr = error.type.toString().toUpperCase();
              if (errorTypeStr.contains('CONNECT') ||
                  errorTypeStr.contains('TIMEOUT') ||
                  errorTypeStr.contains('HOST_LOOKUP') ||
                  errorTypeStr.contains('NOT_CONNECTED')) {
                setState(() {
                  _isOffline = true;
                });
              }
            },
            onDownloadStartRequest: (controller, downloadStartRequest) async {
              // Abrir las descargas (ej. PDFs de cotizaciones) en el navegador del sistema
              final url = downloadStartRequest.url;
              await ChromeSafariBrowser().open(
                url: url,
                settings: ChromeSafariBrowserSettings(
                  shareState: CustomTabsShareState.SHARE_STATE_ON,
                  barCollapsingEnabled: true,
                ),
              );
            },
          ),
        ),
        bottomNavigationBar: _isSignInPage
            ? null // Ocultar barra de pestañas en pantalla de login
            : Container(
                decoration: const BoxDecoration(
                  border: Border(
                    top: BorderSide(color: Color(0xff22263a), width: 1),
                  ),
                ),
                child: BottomNavigationBar(
                  type: BottomNavigationBarType.fixed,
                  backgroundColor: const Color(0xff1a1d27),
                  selectedItemColor: const Color(0xff6c63ff),
                  unselectedItemColor: const Color(0xff8b8fa8),
                  currentIndex: _currentTabIndex,
                  onTap: _onTabTapped,
                  selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                  unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12),
                  items: const [
                    BottomNavigationBarItem(
                      icon: Padding(
                        padding: EdgeInsets.only(bottom: 4),
                        child: Text('📊', style: TextStyle(fontSize: 20)),
                      ),
                      label: 'Dashboard',
                    ),
                    BottomNavigationBarItem(
                      icon: Padding(
                        padding: EdgeInsets.only(bottom: 4),
                        child: Text('👥', style: TextStyle(fontSize: 20)),
                      ),
                      label: 'Clientes',
                    ),
                    BottomNavigationBarItem(
                      icon: Padding(
                        padding: EdgeInsets.only(bottom: 4),
                        child: Text('📄', style: TextStyle(fontSize: 20)),
                      ),
                      label: 'Cotizaciones',
                    ),
                    BottomNavigationBarItem(
                      icon: Padding(
                        padding: EdgeInsets.only(bottom: 4),
                        child: Text('💰', style: TextStyle(fontSize: 20)),
                      ),
                      label: 'Cobranza',
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
