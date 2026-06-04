// UUIDs del servicio UART Nordic (usado por MakeCode Bluetooth)
export const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
export const UART_TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // micro:bit → navegador
export const UART_RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // navegador → micro:bit

export type LogLevel = "info" | "success" | "error" | "warn";

export interface CharacteristicDiagnostics {
  rx: string;
  tx: string;
}

export interface MicrobitConnection {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  rxCharacteristic: BluetoothRemoteGATTCharacteristic;
  txCharacteristic: BluetoothRemoteGATTCharacteristic | null;
  diagnostics: CharacteristicDiagnostics;
}

function probeCharacteristics(
  rx: BluetoothRemoteGATTCharacteristic,
  tx: BluetoothRemoteGATTCharacteristic | null
): CharacteristicDiagnostics {
  const props = (c: BluetoothRemoteGATTCharacteristic) => {
    const p = c.properties;
    const flags: string[] = [];
    if (p.read) flags.push("read");
    if (p.write) flags.push("write");
    if (p.writeWithoutResponse) flags.push("writeWithoutResponse");
    if (p.notify) flags.push("notify");
    if (p.indicate) flags.push("indicate");
    return flags.join("|") || "ninguna";
  };
  return {
    rx: props(rx),
    tx: tx ? props(tx) : "no encontrado",
  };
}

// Comprueba que el navegador soporta Web Bluetooth
export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

// Solicita al usuario que elija un dispositivo micro:bit.
// El listener de desconexión NO se registra aquí: el llamador lo añade
// DESPUÉS de que la conexión esté completamente establecida, evitando
// que un fallo durante el setup dispare handleDisconnect prematuramente.
export async function connectMicrobit(): Promise<MicrobitConnection> {
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { namePrefix: "BBC micro:bit" },
      { namePrefix: "microbit" },
    ],
    optionalServices: [UART_SERVICE_UUID],
  });

  // Reintenta la conexión GATT hasta 2 veces; BLE puede fallar
  // el primer intento si la micro:bit acaba de empezar a anunciar.
  const server = await connectGattWithRetry(device, 2);

  const service = await server.getPrimaryService(UART_SERVICE_UUID);
  const rxCharacteristic = await service.getCharacteristic(UART_RX_UUID);

  let txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  try {
    txCharacteristic = await service.getCharacteristic(UART_TX_UUID);
    if (txCharacteristic.properties.notify) {
      await txCharacteristic.startNotifications();
    }
  } catch {
    txCharacteristic = null;
  }

  return { device, server, rxCharacteristic, txCharacteristic, diagnostics: probeCharacteristics(rxCharacteristic, txCharacteristic) };
}

// Intenta conectar al GATT con reintentos y espera entre ellos
async function connectGattWithRetry(
  device: BluetoothDevice,
  maxAttempts: number
): Promise<BluetoothRemoteGATTServer> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await device.gatt!.connect();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  }

  throw lastError;
}

// Envía bytes crudos a la característica RX sin ningún sufijo
export async function sendRaw(
  rxCharacteristic: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array
): Promise<void> {
  const CHUNK_SIZE = 20;
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    await rxCharacteristic.writeValueWithoutResponse(data.slice(offset, offset + CHUNK_SIZE));
  }
}

// Envía un string con \n al final para que MakeCode lo reciba por UART
export async function sendMessage(
  rxCharacteristic: BluetoothRemoteGATTCharacteristic,
  text: string
): Promise<void> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text + "\n");

  // BLE estándar admite hasta 20 bytes por escritura sin negociar MTU extendida
  const CHUNK_SIZE = 20;

  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    // La característica RX del UART Nordic solo expone WRITE_WITHOUT_RESPONSE.
    // writeValueWithResponse devuelve "GATT operation not permitted" en ese UUID.
    await rxCharacteristic.writeValueWithoutResponse(chunk);
  }
}

// Suscribe un callback a los datos que envía la micro:bit (TX → navegador)
export function subscribeToIncoming(
  txCharacteristic: BluetoothRemoteGATTCharacteristic,
  onData: (text: string) => void
): void {
  const decoder = new TextDecoder();
  txCharacteristic.addEventListener("characteristicvaluechanged", (event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) onData(decoder.decode(value));
  });
}

// Desconecta limpiamente del servidor GATT
export function disconnectMicrobit(connection: MicrobitConnection): void {
  if (connection.server.connected) {
    connection.server.disconnect();
  }
}

// Traduce los mensajes de error BLE más comunes a texto legible
export function friendlyBleError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const msg = error.message;

  if (msg.includes("Connection attempt failed"))
    return "No se pudo establecer la conexión. Asegúrate de que la micro:bit está encendida y anunciando.";
  if (msg.includes("GATT Server is disconnected"))
    return "La micro:bit se desconectó antes de completar el setup. Inténtalo de nuevo.";
  if (msg.includes("User cancelled"))
    return "Búsqueda cancelada por el usuario.";

  return msg;
}
