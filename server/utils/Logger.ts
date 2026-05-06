type LogLevel = "info" | "warn" | "error" | "debug"

const COLORS = {
  info:  "\x1b[36m",  // cyan
  warn:  "\x1b[33m",  // yellow
  error: "\x1b[31m",  // red
  debug: "\x1b[90m",  // gray
  reset: "\x1b[0m",
}

function log(level: LogLevel, context: string, message: string, extra?: unknown): void {
  const ts = new Date().toISOString()
  const color = COLORS[level]
  const tag = `[${context}]`.padEnd(20)
  const prefix = `${color}${ts} ${level.toUpperCase().padEnd(5)} ${tag}${COLORS.reset}`

  if (extra !== undefined) {
    console[level === "error" ? "error" : "log"](`${prefix} ${message}`, extra)
  } else {
    console[level === "error" ? "error" : "log"](`${prefix} ${message}`)
  }
}

export const logger = {
  info:  (ctx: string, msg: string, extra?: unknown) => log("info",  ctx, msg, extra),
  warn:  (ctx: string, msg: string, extra?: unknown) => log("warn",  ctx, msg, extra),
  error: (ctx: string, msg: string, extra?: unknown) => log("error", ctx, msg, extra),
  debug: (ctx: string, msg: string, extra?: unknown) => log("debug", ctx, msg, extra),
}