import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'screens/splash_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Forzar orientación vertical y configurar colores de barra de estado/navegación
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);
  
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: Color(0xff1a1d27),
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  runApp(const GestorPymeApp());
}

class GestorPymeApp extends StatelessWidget {
  const GestorPymeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GestorPyme',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        primaryColor: const Color(0xff6c63ff),
        scaffoldBackgroundColor: const Color(0xff0f1117),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xff6c63ff),
          secondary: Color(0xffa78bfa),
          surface: Color(0xff1a1d27),
          background: Color(0xff0f1117),
          error: Color(0xffef4444),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xff1a1d27),
          elevation: 0,
          centerTitle: false,
          iconTheme: IconThemeData(color: Colors.white),
        ),
        cardTheme: CardThemeData(
          color: const Color(0xff1a1d27),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xff22263a), width: 1),
          ),
          elevation: 2,
        ),
        fontFamily: 'sans-serif', // Fallback a sans-serif estándar del sistema Android
      ),
      home: const SplashScreen(),
    );
  }
}
