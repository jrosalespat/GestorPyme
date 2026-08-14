import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'home_shell.dart';

class SecurityScreen extends StatefulWidget {
  final bool isUnlockMode; // true = unlock app, false = setup new PIN

  const SecurityScreen({super.key, required this.isUnlockMode});

  @override
  State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen> {
  String _pin = '';
  String _confirmPin = '';
  bool _isConfirming = false;
  String _errorMessage = '';
  String _savedPin = '';

  @override
  void initState() {
    super.initState();
    if (widget.isUnlockMode) {
      _loadSavedPin();
    }
  }

  Future<void> _loadSavedPin() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _savedPin = prefs.getString('app_pin') ?? '';
    });
  }

  void _onKeyPress(String value) {
    if (_pin.length < 4) {
      setState(() {
        _pin += value;
        _errorMessage = '';
      });

      if (_pin.length == 4) {
        // Ejecutar validación con retardo corto para que el último círculo se llene
        Future.delayed(const Duration(milliseconds: 200), _validatePin);
      }
    }
  }

  void _onDelete() {
    if (_pin.isNotEmpty) {
      setState(() {
        _pin = _pin.substring(0, _pin.length - 1);
        _errorMessage = '';
      });
    }
  }

  void _onClear() {
    setState(() {
      _pin = '';
      _errorMessage = '';
    });
  }

  Future<void> _validatePin() async {
    if (widget.isUnlockMode) {
      // Modo Desbloqueo
      if (_pin == _savedPin) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const HomeShell()),
        );
      } else {
        setState(() {
          _pin = '';
          _errorMessage = 'PIN incorrecto. Intenta de nuevo.';
        });
      }
    } else {
      // Modo Configuración
      if (!_isConfirming) {
        // Primera entrada
        setState(() {
          _confirmPin = _pin;
          _pin = '';
          _isConfirming = true;
        });
      } else {
        // Segunda entrada (confirmación)
        if (_pin == _confirmPin) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('app_pin', _pin);
          await prefs.setBool('pin_enabled', true);

          if (!mounted) return;

          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('PIN configurado con éxito'),
              backgroundColor: Color(0xff22c55e),
            ),
          );

          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (context) => const HomeShell()),
          );
        } else {
          setState(() {
            _pin = '';
            _errorMessage = 'Los PIN no coinciden. Comienza de nuevo.';
            _isConfirming = false;
            _confirmPin = '';
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    String instructionText = '';
    if (widget.isUnlockMode) {
      instructionText = 'Ingresa tu PIN de seguridad';
    } else {
      instructionText = _isConfirming
          ? 'Confirma tu PIN de seguridad'
          : 'Crea tu PIN de seguridad de 4 dígitos';
    }

    return Scaffold(
      backgroundColor: const Color(0xff0f1117),
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(flex: 2),
            
            // Header / Icon
            Icon(
              widget.isUnlockMode ? Icons.lock_outline : Icons.lock_open_outlined,
              size: 64,
              color: const Color(0xff6c63ff),
            ),
            const SizedBox(height: 16),
            
            Text(
              widget.isUnlockMode ? 'Acceso Seguro' : 'Configurar PIN',
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            
            Text(
              instructionText,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xff8b8fa8),
              ),
            ),
            const SizedBox(height: 32),
            
            // PIN Dots Indicator
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(4, (index) {
                final bool isFilled = index < _pin.length;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: const EdgeInsets.symmetric(horizontal: 12),
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isFilled ? const Color(0xff6c63ff) : Colors.transparent,
                    border: Border.all(
                      color: isFilled ? const Color(0xff6c63ff) : const Color(0xff22263a),
                      width: 2,
                    ),
                    boxShadow: isFilled
                        ? [
                            BoxShadow(
                              color: const Color(0xff6c63ff).withOpacity(0.5),
                              blurRadius: 10,
                              spreadRadius: 1,
                            )
                          ]
                        : null,
                  ),
                );
              }),
            ),
            
            const SizedBox(height: 16),
            
            // Error Message
            SizedBox(
              height: 24,
              child: Text(
                _errorMessage,
                style: const TextStyle(
                  color: Color(0xffef4444),
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            
            const Spacer(flex: 1),
            
            // Keyboard Grid
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              child: Column(
                children: [
                  _buildKeyboardRow(['1', '2', '3']),
                  const SizedBox(height: 16),
                  _buildKeyboardRow(['4', '5', '6']),
                  const SizedBox(height: 16),
                  _buildKeyboardRow(['7', '8', '9']),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _buildSpecialButton('C', _onClear),
                      _buildKeyButton('0'),
                      _buildSpecialButton('⌫', _onDelete),
                    ],
                  ),
                ],
              ),
            ),
            
            const Spacer(flex: 2),
          ],
        ),
      ),
    );
  }

  Widget _buildKeyboardRow(List<String> keys) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: keys.map((key) => _buildKeyButton(key)).toList(),
    );
  }

  Widget _buildKeyButton(String label) {
    return InkWell(
      onTap: () => _onKeyPress(label),
      borderRadius: BorderRadius.circular(40),
      child: Ink(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: const Color(0xff1a1d27),
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xff22263a), width: 1),
        ),
        child: Center(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSpecialButton(String label, VoidCallback onPressed) {
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(40),
      child: Ink(
        width: 72,
        height: 72,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: label == '⌫' ? 24 : 18,
              fontWeight: FontWeight.w600,
              color: const Color(0xff8b8fa8),
            ),
          ),
        ),
      ),
    );
  }
}
