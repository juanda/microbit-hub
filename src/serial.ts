// Vendor ID del chip DAPLink que usa la micro:bit (ARM Ltd)
const MICROBIT_VENDOR_ID = 0x0d28;

export interface SerialConnection {
  port: SerialPort;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  reader: ReadableStreamDefaultReader<Uint8Array>;
}

export function isSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export async function connectSerial(): Promise<SerialConnection> {
  const port = await navigator.serial.requestPort({
    filters: [{ usbVendorId: MICROBIT_VENDOR_ID }],
  });

  await port.open({
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    flowControl: "none",
  });

  const writer = port.writable!.getWriter();
  const reader = port.readable!.getReader();

  return { port, writer, reader };
}

// Envía texto terminado en \n (MakeCode usa serial.readLine() que espera \n)
export async function sendSerialMessage(
  conn: SerialConnection,
  text: string
): Promise<void> {
  const encoder = new TextEncoder();
  await conn.writer.write(encoder.encode(text + "\n"));
}

// Inicia el bucle de lectura en background. Llama a onData por cada línea
// completa recibida y a onDisconnect cuando el puerto se cierra o falla.
export function startSerialReader(
  conn: SerialConnection,
  onData: (line: string) => void,
  onDisconnect: () => void
): void {
  const decoder = new TextDecoder();
  let buffer = "";

  (async () => {
    try {
      while (true) {
        const { value, done } = await conn.reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trimEnd();
          if (trimmed.length > 0) onData(trimmed);
        }
      }
    } catch {
      // Puerto cerrado o cancelado — la llamada a cancel() en disconnectSerial
      // provoca que read() lance, lo que es el camino normal de cierre.
    } finally {
      conn.reader.releaseLock();
      onDisconnect();
    }
  })();
}

export async function disconnectSerial(conn: SerialConnection): Promise<void> {
  // Cancela la lectura → el bucle sale del try/catch y libera el lock
  try { await conn.reader.cancel(); } catch { /* ignorar */ }
  // Pequeña espera para que el bucle libere el reader lock antes de cerrar el puerto
  await new Promise<void>((resolve) => setTimeout(resolve, 60));
  try { conn.writer.releaseLock(); } catch { /* ignorar */ }
  try { await conn.port.close(); } catch { /* ignorar */ }
}
