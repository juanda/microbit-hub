import "./style.css";
import {
  connectMicrobit,
  disconnectMicrobit,
  friendlyBleError,
  isBluetoothSupported,
  sendMessage,
  sendRaw,
  subscribeToIncoming,
  type MicrobitConnection,
} from "./bluetooth";
import {
  connectSerial,
  disconnectSerial,
  isSerialSupported,
  sendSerialMessage,
  startSerialReader,
  type SerialConnection,
} from "./serial";
import { Logger } from "./logger";
import { applyBtState, applySerialState, getUIElements } from "./ui";

// ─── Inicialización ───────────────────────────────────────────────────────────

const logger = new Logger("logContainer");
const ui = getUIElements();

let btConn: MicrobitConnection | null = null;
let serialConn: SerialConnection | null = null;

// ─── Comprobación de soporte ──────────────────────────────────────────────────

if (!isBluetoothSupported()) {
  logger.log("Web Bluetooth no disponible en este navegador.", "warn");
  ui.btnConnect.disabled = true;
  ui.btnConnect.textContent = "BT no disponible";
}

if (!isSerialSupported()) {
  logger.log("Web Serial no disponible en este navegador.", "warn");
  ui.btnSerialConnect.disabled = true;
  ui.btnSerialConnect.textContent = "Serial no disponible";
}

// ─── Bluetooth: conectar ──────────────────────────────────────────────────────

ui.btnConnect.addEventListener("click", async () => {
  applyBtState(ui, "connecting");
  logger.log("[BT] Iniciando búsqueda…", "info");

  try {
    const conn = await connectMicrobit();

    conn.device.addEventListener("gattserverdisconnected", handleBtDisconnect);

    if (conn.txCharacteristic) {
      subscribeToIncoming(conn.txCharacteristic, (text) => {
        logger.log(`[BT ←] "${text.trimEnd()}"`, "info");
      });
      logger.log("[BT] Notificaciones TX activas", "success");
    } else {
      logger.log("[BT] TX sin NOTIFY — solo envío activo", "info");
    }

    logger.log(`[BT] RX props: ${conn.diagnostics.rx}`, "info");
    logger.log(`[BT] TX props: ${conn.diagnostics.tx}`, "info");

    btConn = conn;
    applyBtState(ui, "connected");
    logger.log(`[BT] Conectado a "${conn.device.name ?? "micro:bit"}"`, "success");
  } catch (err) {
    applyBtState(ui, "disconnected");
    if (err instanceof DOMException && err.name === "NotFoundError") {
      logger.log("[BT] Búsqueda cancelada.", "warn");
    } else {
      logger.log(`[BT] Error: ${friendlyBleError(err)}`, "error");
    }
    btConn = null;
  }
});

// ─── Bluetooth: desconectar ───────────────────────────────────────────────────

ui.btnDisconnect.addEventListener("click", () => {
  if (btConn) disconnectMicrobit(btConn);
});

function handleBtDisconnect(): void {
  const name = btConn?.device.name ?? "micro:bit";
  btConn = null;
  applyBtState(ui, "disconnected");
  logger.log(`[BT] "${name}" desconectado.`, "warn");
}

// ─── USB Serie: conectar ──────────────────────────────────────────────────────

ui.btnSerialConnect.addEventListener("click", async () => {
  applySerialState(ui, "connecting");
  logger.log("[USB] Seleccionando puerto…", "info");

  try {
    const conn = await connectSerial();

    startSerialReader(
      conn,
      (line) => logger.log(`[USB ←] "${line}"`, "info"),
      handleSerialDisconnect,
    );

    serialConn = conn;
    applySerialState(ui, "connected");

    const info = conn.port.getInfo();
    logger.log(
      `[USB] Conectado — VID: 0x${info.usbVendorId?.toString(16).padStart(4, "0")} PID: 0x${info.usbProductId?.toString(16).padStart(4, "0")}`,
      "success",
    );
  } catch (err) {
    applySerialState(ui, "disconnected");
    if (err instanceof DOMException && err.name === "NotFoundError") {
      logger.log("[USB] Selección cancelada.", "warn");
    } else {
      logger.log(`[USB] Error al conectar: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
    serialConn = null;
  }
});

// ─── USB Serie: desconectar ───────────────────────────────────────────────────

ui.btnSerialDisconnect.addEventListener("click", async () => {
  if (serialConn) await disconnectSerial(serialConn);
});

function handleSerialDisconnect(): void {
  serialConn = null;
  applySerialState(ui, "disconnected");
  logger.log("[USB] Puerto serie desconectado.", "warn");
}

// ─── Enviar: Bluetooth ────────────────────────────────────────────────────────

ui.btnSendBt.addEventListener("click", () => sendViaBt());
ui.messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (serialConn) sendViaSerial();
    else if (btConn) sendViaBt();
  }
});

async function sendViaBt(): Promise<void> {
  if (!btConn) return;
  const text = ui.messageInput.value.trim();
  if (!text) { logger.log("Mensaje vacío.", "warn"); return; }

  ui.btnSendBt.disabled = true;
  try {
    await sendMessage(btConn.rxCharacteristic, text);
    logger.log(`[BT →] "${text}"`, "success");
    ui.messageInput.value = "";
  } catch (err) {
    logger.log(`[BT] Error al enviar: ${friendlyBleError(err)}`, "error");
    if (btConn && !btConn.server.connected) handleBtDisconnect();
  } finally {
    if (btConn) ui.btnSendBt.disabled = false;
  }
}

// ─── Enviar: USB Serie ────────────────────────────────────────────────────────

ui.btnSendSerial.addEventListener("click", () => sendViaSerial());

async function sendViaSerial(): Promise<void> {
  if (!serialConn) return;
  const text = ui.messageInput.value.trim();
  if (!text) { logger.log("Mensaje vacío.", "warn"); return; }

  ui.btnSendSerial.disabled = true;
  try {
    await sendSerialMessage(serialConn, text);
    logger.log(`[USB →] "${text}"`, "success");
    ui.messageInput.value = "";
  } catch (err) {
    logger.log(`[USB] Error al enviar: ${err instanceof Error ? err.message : String(err)}`, "error");
  } finally {
    if (serialConn) ui.btnSendSerial.disabled = false;
  }
}

// ─── Diagnóstico BT ───────────────────────────────────────────────────────────

ui.btnPing.addEventListener("click", async () => {
  if (!btConn) return;
  try {
    await sendMessage(btConn.rxCharacteristic, "ping");
    logger.log('[BT] Diagnóstico: enviado "ping\\n"', "info");
  } catch (e) {
    logger.log(`[BT] Error ping: ${friendlyBleError(e)}`, "error");
  }
});

ui.btnRaw.addEventListener("click", async () => {
  if (!btConn) return;
  try {
    await sendRaw(btConn.rxCharacteristic, new Uint8Array([0x41]));
    logger.log("[BT] Diagnóstico: enviado byte 0x41 ('A') sin \\n", "info");
  } catch (e) {
    logger.log(`[BT] Error raw: ${friendlyBleError(e)}`, "error");
  }
});

// ─── Limpiar log ──────────────────────────────────────────────────────────────

ui.btnClearLog.addEventListener("click", () => logger.clear());
