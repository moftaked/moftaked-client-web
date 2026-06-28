const MAX_LOGS = 500;

type LogEntry = {
  method: "log" | "warn" | "error" | "info" | "debug";
  args: unknown[];
  timestamp: number;
};

const buffer: LogEntry[] = [];
let capturing = false;

export function captureConsole() {
  if (capturing) return;
  capturing = true;

  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  function capture(method: LogEntry["method"]) {
    console[method] = (...args: unknown[]) => {
      buffer.push({ method, args, timestamp: Date.now() });
      if (buffer.length > MAX_LOGS) buffer.shift();
      original[method].apply(console, args);
    };
  }

  capture("log");
  capture("warn");
  capture("error");
  capture("info");
  capture("debug");
}

function formatArg(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.message}\n${arg.stack ?? ""}`;
  }
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}

export function getConsoleBuffer(): string {
  const header = `User Agent: ${navigator.userAgent}\nTimestamp: ${new Date().toISOString()}\n${"─".repeat(60)}\n`;
  const body = buffer
    .map((entry) => {
      const time = new Date(entry.timestamp).toISOString().slice(11, 23);
      const prefix = `[${time}] [${entry.method.toUpperCase()}]`;
      const formatted = entry.args.map(formatArg).join(" ");
      return `${prefix} ${formatted}`;
    })
    .join("\n");
  return header + body;
}

export function clearConsoleBuffer() {
  buffer.length = 0;
}
