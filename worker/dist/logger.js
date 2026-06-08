"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
function formatMessage(level, message, meta) {
    const ts = new Date().toISOString();
    const metaPart = meta !== undefined
        ? " | " + (meta instanceof Error
            ? `${meta.message}\n${meta.stack ?? ""}`
            : JSON.stringify(meta, null, 2))
        : "";
    return `[${ts}] [${level}] ${message}${metaPart}\n`;
}
function write(level, message, meta) {
    const line = formatMessage(level, message, meta);
    // Always mirror to stdout/stderr so Docker/container logs also capture it
    if (level === "ERROR") {
        process.stderr.write(line);
    }
    else {
        process.stdout.write(line);
    }
    // Append to the single log file (sync write keeps ordering correct)
    try {
        fs.appendFileSync(LOG_FILE, line);
    }
    catch {
        // If file write fails, at least stdout got it — don't crash the worker
    }
}
exports.logger = {
    info: (msg, meta) => write("INFO", msg, meta),
    warn: (msg, meta) => write("WARN", msg, meta),
    error: (msg, meta) => write("ERROR", msg, meta),
    debug: (msg, meta) => write("DEBUG", msg, meta),
    /** Logs the log file path on boot so you always know where to look */
    logFilePath: () => LOG_FILE,
};
