# micro:bit Hub

Aplicación web para enviar mensajes de texto a una BBC micro:bit desde el navegador, usando **Bluetooth** (Web Bluetooth API) o **cable USB** (Web Serial API).

Construida con TypeScript, Vite y Bun, sin frameworks de UI.

---

## Transportes soportados

| Transporte | API del navegador | Estado |
|---|---|---|
| Bluetooth BLE (UART Nordic) | Web Bluetooth | ✓ Implementado |
| USB Serie (CDC virtual) | Web Serial | ✓ Implementado |
| WebUSB | WebUSB | Planificado |

---

## Requisitos

- **Node runtime**: [Bun](https://bun.sh) v1.0+
- **Navegador**: Chrome 89+ o Edge 89+ (Firefox y Safari no soportan Web Bluetooth ni Web Serial)
- **Origen seguro**: la app debe servirse desde `https://` o `localhost` (ambas APIs lo exigen)

---

## Instalación y uso

```bash
# Instalar dependencias
bun install

# Servidor de desarrollo (abre http://localhost:5173 automáticamente)
bun run dev

# Build de producción
bun run build

# Previsualizar el build
bun run preview
```

---

## Programar la micro:bit

### Para USB Serie (recomendado para empezar)

No requiere ninguna extensión. Crea un proyecto MakeCode con este código:

```typescript
basic.showIcon(IconNames.Yes)

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    basic.showString(serial.readLine())
})
```

### Para Bluetooth

Requiere añadir la extensión **Bluetooth** en MakeCode (incompatible con la extensión Radio).

Edita la configuración del proyecto (`pxt.json`) para desactivar el requisito de emparejamiento:

```json
{
    "dependencies": {
        "core": "*",
        "bluetooth": "*"
    },
    "yotta": {
        "config": {
            "MICROBIT_BLE_OPEN": 1
        }
    }
}
```

Programa de ejemplo:

```typescript
let buf = ""
bluetooth.startUartService()
basic.showIcon(IconNames.Yes)

bluetooth.onBluetoothConnected(function () {
    buf = ""
    basic.showIcon(IconNames.Heart)
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
})

basic.forever(function () {
    let chunk = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    if (chunk.length > 0) {
        basic.showString(chunk)
        buf = ""
    }
    basic.pause(50)
})
```

---

## Estructura del proyecto

```
microbit/
├── public/
│   └── favicon.svg
├── src/
│   ├── bluetooth.ts   # Lógica Web Bluetooth (UUIDs UART, connect/send/disconnect)
│   ├── serial.ts      # Lógica Web Serial (connect/send/read/disconnect)
│   ├── serial.d.ts    # Declaraciones de tipos Web Serial
│   ├── logger.ts      # Log visual en el DOM con niveles info/success/warn/error
│   ├── ui.ts          # Estado de botones e inputs por transporte
│   ├── main.ts        # Punto de entrada y event listeners
│   └── style.css      # UI dark sin dependencias externas
├── serial.d.ts        # Tipos globales Web Serial API
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## UUIDs del servicio UART Bluetooth (Nordic UART Service)

| Rol | UUID |
|---|---|
| Servicio | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` |
| RX — navegador → micro:bit | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` |
| TX — micro:bit → navegador | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` |

---

## Notas de compatibilidad

- **Bluetooth**: solo funciona si la micro:bit anuncia el servicio UART. Requiere `bluetooth.startUartService()` en el programa MakeCode y `MICROBIT_BLE_OPEN: 1` en `pxt.json` para evitar el requisito de PIN.
- **USB Serie**: conecta la micro:bit por cable USB antes de pulsar "Conectar". El selector de puerto muestra el COM virtual de la micro:bit (VID `0x0D28`). En Windows puede requerir los drivers de DAPLink.
- **Longitud de mensaje**: el transporte Bluetooth fragmenta en chunks de 20 bytes (límite BLE sin MTU extendida). USB Serie no tiene límite práctico.
