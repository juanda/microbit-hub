export type ConnectionState = "disconnected" | "connecting" | "connected";

export interface UIElements {
  // Bluetooth
  btnConnect: HTMLButtonElement;
  btnDisconnect: HTMLButtonElement;
  btDot: HTMLElement;
  btStatus: HTMLElement;
  // USB Serial
  btnSerialConnect: HTMLButtonElement;
  btnSerialDisconnect: HTMLButtonElement;
  serialDot: HTMLElement;
  serialStatus: HTMLElement;
  // Mensaje compartido
  messageInput: HTMLInputElement;
  btnSendBt: HTMLButtonElement;
  btnSendSerial: HTMLButtonElement;
  btnPing: HTMLButtonElement;
  btnRaw: HTMLButtonElement;
  btnClearLog: HTMLButtonElement;
}

export function getUIElements(): UIElements {
  function getEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id) as T | null;
    if (!el) throw new Error(`Elemento #${id} no encontrado en el DOM`);
    return el;
  }
  return {
    btnConnect: getEl("btnConnect"),
    btnDisconnect: getEl("btnDisconnect"),
    btDot: getEl("btDot"),
    btStatus: getEl("btStatus"),
    btnSerialConnect: getEl("btnSerialConnect"),
    btnSerialDisconnect: getEl("btnSerialDisconnect"),
    serialDot: getEl("serialDot"),
    serialStatus: getEl("serialStatus"),
    messageInput: getEl("messageInput"),
    btnSendBt: getEl("btnSendBt"),
    btnSendSerial: getEl("btnSendSerial"),
    btnPing: getEl("btnPing"),
    btnRaw: getEl("btnRaw"),
    btnClearLog: getEl("btnClearLog"),
  };
}

export function applyBtState(ui: UIElements, state: ConnectionState): void {
  const connected = state === "connected";
  const connecting = state === "connecting";

  ui.btnConnect.disabled = connected || connecting;
  ui.btnConnect.textContent = connecting ? "⏳ Conectando…" : "Emparejar";
  ui.btnDisconnect.disabled = !connected;
  ui.btnSendBt.disabled = !connected;
  ui.btnPing.disabled = !connected;
  ui.btnRaw.disabled = !connected;

  const labels: Record<ConnectionState, string> = {
    disconnected: "Desconectado",
    connecting: "Conectando…",
    connected: "Conectado",
  };
  ui.btStatus.textContent = labels[state];
  ui.btDot.className = `transport-dot transport-dot--${state}`;

  syncMessageInput(ui);
}

export function applySerialState(ui: UIElements, state: ConnectionState): void {
  const connected = state === "connected";
  const connecting = state === "connecting";

  ui.btnSerialConnect.disabled = connected || connecting;
  ui.btnSerialConnect.textContent = connecting ? "⏳ Conectando…" : "Conectar";
  ui.btnSerialDisconnect.disabled = !connected;
  ui.btnSendSerial.disabled = !connected;

  const labels: Record<ConnectionState, string> = {
    disconnected: "Desconectado",
    connecting: "Conectando…",
    connected: "Conectado",
  };
  ui.serialStatus.textContent = labels[state];
  ui.serialDot.className = `transport-dot transport-dot--${state}`;

  syncMessageInput(ui);
}

// El input se habilita en cuanto cualquier transporte está conectado
function syncMessageInput(ui: UIElements): void {
  const anyActive = !ui.btnSendBt.disabled || !ui.btnSendSerial.disabled;
  ui.messageInput.disabled = !anyActive;
}
