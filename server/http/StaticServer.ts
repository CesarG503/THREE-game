import { createReadStream, promises as fsPromises, existsSync, type Stats } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { IncomingMessage, ServerResponse } from "node:http"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const candidate1 = path.resolve(currentDir, "../client")
const candidate2 = path.resolve(process.cwd(), "dist/client")
const candidate3 = path.resolve(process.cwd(), "dist")

function resolveClientDir(): string {
  if (existsSync(candidate1)) return candidate1
  if (existsSync(candidate2)) return candidate2
  return candidate3
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".fbx": "application/octet-stream",
  ".obj": "text/plain; charset=utf-8",
  ".bin": "application/octet-stream",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
}

export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  rawPath: string,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Method Not Allowed")
    return
  }

  const clientDir = resolveClientDir()

  // Prevent path traversal
  let safeRelative = path
    .normalize(decodeURIComponent(rawPath.split("?")[0] ?? "/"))
    .replace(/^(\.\.[\/\\])+/, "")
    .replace(/^[\/\\]+/, "")

  if (!safeRelative || safeRelative === ".") {
    safeRelative = "index.html"
  }

  let fullPath = path.join(clientDir, safeRelative)

  let stat: Stats | null = null
  try {
    stat = await fsPromises.stat(fullPath)
    if (stat.isDirectory()) {
      fullPath = path.join(fullPath, "index.html")
      stat = await fsPromises.stat(fullPath)
    }
  } catch {
    stat = null
  }

  // SPA fallback: If file is not found and has no extension, serve index.html
  if (!stat) {
    const hasExtension = path.extname(safeRelative) !== ""
    if (!hasExtension) {
      const fallbackPath = path.join(clientDir, "index.html")
      try {
        stat = await fsPromises.stat(fallbackPath)
        fullPath = fallbackPath
      } catch {
        stat = null
      }
    }
  }

  if (!stat) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Not Found")
    return
  }

  const ext = path.extname(fullPath).toLowerCase()
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream"

  let cacheControl = "public, max-age=3600"
  if (safeRelative.startsWith("assets/")) {
    cacheControl = "public, max-age=31536000, immutable"
  } else if (ext === ".html") {
    cacheControl = "no-cache"
  }

  streamFile(req, res, fullPath, stat, contentType, cacheControl)
}

function streamFile(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  stat: Stats,
  contentType: string,
  cacheControl: string,
): void {
  const range = req.headers.range
  const fileSize = stat.size

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-")
    const start = parseInt(parts[0] ?? "0", 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

    if (isNaN(start) || isNaN(end) || start > end || start >= fileSize) {
      res.writeHead(416, {
        "Content-Range": `bytes */${fileSize}`,
      })
      res.end()
      return
    }

    const chunkSize = end - start + 1
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    })

    if (req.method === "HEAD") {
      res.end()
      return
    }

    createReadStream(filePath, { start, end }).pipe(res)
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": cacheControl,
    })

    if (req.method === "HEAD") {
      res.end()
      return
    }

    createReadStream(filePath).pipe(res)
  }
}
