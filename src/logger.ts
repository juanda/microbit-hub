import type { LogLevel } from "./bluetooth";

const ICONS: Record<LogLevel, string> = {
  info: "ℹ",
  success: "✓",
  error: "✗",
  warn: "⚠",
};

export class Logger {
  private container: HTMLElement;
  private emptyPlaceholder: HTMLElement | null;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Logger: elemento #${containerId} no encontrado`);
    this.container = el;
    this.emptyPlaceholder = el.querySelector(".log-empty");
  }

  log(message: string, level: LogLevel = "info"): void {
    if (this.emptyPlaceholder) {
      this.emptyPlaceholder.remove();
      this.emptyPlaceholder = null;
    }

    const now = new Date();
    const time = now.toLocaleTimeString("es-ES", { hour12: false });

    const entry = document.createElement("div");
    entry.className = `log-entry log-${level}`;
    entry.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-icon">${ICONS[level]}</span>
      <span class="log-msg">${escapeHtml(message)}</span>
    `;

    this.container.appendChild(entry);
    this.container.scrollTop = this.container.scrollHeight;
  }

  clear(): void {
    this.container.innerHTML = '<p class="log-empty">Los eventos aparecerán aquí...</p>';
    this.emptyPlaceholder = this.container.querySelector(".log-empty");
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
