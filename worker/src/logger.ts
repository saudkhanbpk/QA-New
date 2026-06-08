import * as fs from "fs";
import * as path from "path";

// Single log file — rotated by date so it doesn't grow forever in long-running workers
const LOG_DIR = path.resolve(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "worker.log");

// Ensure the logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Truncate the log file at worker boot so each run starts clean
// (comment this out if you want persistent history across runs)
fs.writeFileSync(LOG_FILE, `=== Worker started at ${new Date().toISOString()} ===\n`);

type Level = "INFO" | "WARN" | "ERROR" | "DEBUG";

function formatMessage(level: Level, message: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const metaPart = meta !== undefined
    ? " | " + (meta instanceof Error
        ? `${meta.message}\n${meta.stack ?? ""}`
        : JSON.stringify(meta, null, 2))
    : "";
  return `[${ts}] [${level}] ${message}${metaPart}\n`;
}

function write(level: Level, message: string, meta?: unknown): void {
  const line = formatMessage(level, message, meta);

  // Always mirror to stdout/stderr so Docker/container logs also capture it
  if (level === "ERROR") {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }

  // Append to the single log file (sync write keeps ordering correct)
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // If file write fails, at least stdout got it — don't crash the worker
  }
}

export const logger = {
  info:  (msg: string, meta?: unknown) => write("INFO",  msg, meta),
  warn:  (msg: string, meta?: unknown) => write("WARN",  msg, meta),
  error: (msg: string, meta?: unknown) => write("ERROR", msg, meta),
  debug: (msg: string, meta?: unknown) => write("DEBUG", msg, meta),

  /** Logs the log file path on boot so you always know where to look */
  logFilePath: () => LOG_FILE,
};
