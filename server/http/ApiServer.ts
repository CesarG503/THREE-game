import type { IncomingMessage as HttpIncomingMessage, ServerResponse } from "node:http"
import { Readable } from "node:stream"
import Busboy from "busboy"
import { AuthError, getUserBySessionToken, loginUser, registerUser, requireUserBySessionToken, type AuthInput } from "../services/AuthService.js"
import { createAsset, getAsset, getAssetObject, listAssets, type UploadedAssetFile } from "../services/AssetService.js"
import { createMap, deleteMap, getMap, listMaps, updateMap, type MapWriteInput } from "../services/MapService.js"
import { getPopularityRecommendations } from "../services/RecommendationService.js"
import { getContentRecommendations } from "../services/ContentRecommender.js"
import { getCollaborativeRecommendations } from "../services/CollaborativeRecommender.js"
import { applyQualityFilter } from "../services/filters/QualityFilter.js"
import { setUserVisibility, getSocialRecommendations, type PlayerVisibility } from "../services/SocialRecommender.js"
import { getBanditRecommendations } from "../services/ExplorationBandit.js"
import { getHybridRecommendations } from "../services/HybridRecommender.js"
import { parseAcceptLanguage } from "../analytics/features/language_matcher.js"
import { logger } from "../utils/Logger.js"
import { PlayerProfileRepository } from "../analytics/models/PlayerProfile.js"
import { validateTelemetryEvent } from "../analytics/middleware.js"
import { evaluateEventReputation } from "../analytics/security/bot_filter.js"
import { eventBuffer } from "../analytics/eventBuffer.js"
import { getRedis } from "../cache/redis.js"
import { metricsCollector } from "../analytics/monitoring/metricsCollector.js"
import { getCohortRetention } from "../analytics/reports/cohorts.js"
import { getConversionFunnel } from "../analytics/reports/funnels.js"
import { getMatchmakingMetrics } from "../analytics/reports/matchmaking.js"
import { getCatalogPerformance } from "../analytics/reports/catalog_performance.js"
import { getCreatorsActivityReport } from "../analytics/reports/creators_activity.js"
import { matchmaker } from "../services/Matchmaker.js"
import { ewtCalculator } from "../services/matchmaking/ewt_calculator.js"

const MAX_BODY_BYTES = 1024 * 1024 * 2

export async function handleHttpRequest(
  req: HttpIncomingMessage,
  res: ServerResponse,
): Promise<void> {
  setCorsHeaders(req, res)
  setSecurityHeaders(res)

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method === "GET" && url.pathname === "/api/metrics") {
    res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" })
    res.end(metricsCollector.toPrometheusFormat())
    return
  }

  if (req.method === "POST" && url.pathname === "/api/analytics/event") {
    // Rate limiting: max 1000 events per IP per minute (fail-open: analytics are not safety-critical)
    const ip = getClientIp(req)
    const rateLimited = await checkRateLimit(ip, 1000, 60)
    if (rateLimited) {
      sendJson(res, 429, { error: "Rate limit exceeded" })
      return
    }
    return withJsonBody(req, res, async (body) => {
      const eventType = (body as any)?.eventType || "unknown"
      metricsCollector.recordReceived(eventType)

      // Inject Accept-Language header for SessionStart events
      if (body && typeof body === "object") {
        const castedBody = body as any;
        if (castedBody.eventType === "SessionStart" && castedBody.payload && typeof castedBody.payload === "object") {
          castedBody.payload.acceptLanguage = req.headers["accept-language"] || null;
        }
      }

      const validation = validateTelemetryEvent(body)
      if (!validation.valid) {
        // Log details internally, don't expose schema to clients
        logger.warn("HTTP", `Invalid telemetry event from ${ip}`, validation.errors)
        metricsCollector.recordFailed(eventType)
        sendJson(res, 400, { 
          error: "Validation failed", 
          details: ["The event payload does not match the registered schema."] 
        })
        return
      }

      // Evaluar reputación de bot / ruido antes de encolar (Fase 25)
      const reputation = await evaluateEventReputation(body, ip)
      if (reputation.isSuspicious) {
        if (body && typeof body === "object") {
          const castedBody = body as any;
          castedBody.payload = {
            ...(castedBody.payload || {}),
            metadata: {
              ...(castedBody.payload?.metadata || {}),
              isSuspicious: true,
              suspicionReason: reputation.reason
            }
          };
        }
      }

      const success = eventBuffer.push(body as any)
      if (!success) {
        metricsCollector.recordFailed(eventType)
        sendJson(res, 429, { error: "Server busy" })
        return
      }
      sendJson(res, 202, { ok: true })
    })
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const ip = getClientIp(req)
    if (await checkRateLimit(`register:${ip}`, 10, 60, true)) {
      sendJson(res, 429, { error: "Demasiados intentos. Intenta de nuevo en un minuto." })
      return
    }
    return withJsonBody(req, res, async (body) => {
      const result = await registerUser(body as AuthInput)
      sendJson(res, 201, result)
    })
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const ip = getClientIp(req)
    if (await checkRateLimit(`login:${ip}`, 5, 60, true)) {
      sendJson(res, 429, { error: "Demasiados intentos. Intenta de nuevo en un minuto." })
      return
    }
    return withJsonBody(req, res, async (body) => {
      const result = await loginUser(body as AuthInput)
      sendJson(res, 200, result)
    })
  }

  if (req.method === "GET" && url.pathname === "/api/analytics/reports/cohorts") {
    return withApiError(res, async () => {
      const userType = url.searchParams.get("userType") as "registered" | "guest" | undefined;
      if (userType && userType !== "registered" && userType !== "guest") {
        sendJson(res, 400, { error: "userType invalido. Debe ser 'registered' o 'guest'." })
        return
      }
      const cohorts = await getCohortRetention({ userType });
      sendJson(res, 200, { cohorts });
    });
  }

  if (req.method === "GET" && url.pathname === "/api/analytics/reports/funnel") {
    return withApiError(res, async () => {
      const rawStart = url.searchParams.get("startDate");
      const rawEnd = url.searchParams.get("endDate");

      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (rawStart) {
        startDate = new Date(rawStart);
        if (isNaN(startDate.getTime())) {
          sendJson(res, 400, { error: "startDate invalido. Debe ser una fecha ISO valida." });
          return;
        }
      }

      if (rawEnd) {
        endDate = new Date(rawEnd);
        if (isNaN(endDate.getTime())) {
          sendJson(res, 400, { error: "endDate invalido. Debe ser una fecha ISO valida." });
          return;
        }
      }

      const funnel = await getConversionFunnel({ startDate, endDate });
      sendJson(res, 200, { funnel });
    });
  }

  if (req.method === "GET" && url.pathname === "/api/analytics/reports/matchmaking") {
    return withApiError(res, async () => {
      const rawStart = url.searchParams.get("startDate");
      const rawEnd = url.searchParams.get("endDate");

      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (rawStart) {
        startDate = new Date(rawStart);
        if (isNaN(startDate.getTime())) {
          sendJson(res, 400, { error: "startDate invalido. Debe ser una fecha ISO valida." });
          return;
        }
      }

      if (rawEnd) {
        endDate = new Date(rawEnd);
        if (isNaN(endDate.getTime())) {
          sendJson(res, 400, { error: "endDate invalido. Debe ser una fecha ISO valida." });
          return;
        }
      }

      const matchmaking = await getMatchmakingMetrics({ startDate, endDate });
      sendJson(res, 200, { matchmaking });
    });
  }

  if (req.method === "GET" && url.pathname === "/api/analytics/reports/catalog") {
    return withApiError(res, async () => {
      const rawStart = url.searchParams.get("startDate");
      const rawEnd = url.searchParams.get("endDate");

      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (rawStart) {
        startDate = new Date(rawStart);
        if (isNaN(startDate.getTime())) {
          sendJson(res, 400, { error: "startDate invalido. Debe ser una fecha ISO valida." });
          return;
        }
      }

      if (rawEnd) {
        endDate = new Date(rawEnd);
        if (isNaN(endDate.getTime())) {
          sendJson(res, 400, { error: "endDate invalido. Debe ser una fecha ISO valida." });
          return;
        }
      }

      const catalogPerformance = await getCatalogPerformance({ startDate, endDate });
      sendJson(res, 200, { catalogPerformance });
    });
  }

  if (req.method === "GET" && url.pathname === "/api/analytics/reports/creators") {
    return withApiError(res, async () => {
      const rawStart = url.searchParams.get("startDate");
      const rawEnd = url.searchParams.get("endDate");

      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (rawStart) {
        startDate = new Date(rawStart);
        if (isNaN(startDate.getTime())) {
          sendJson(res, 400, { error: "startDate invalido. Debe ser una fecha ISO valida." });
          return;
        }
      }

      if (rawEnd) {
        endDate = new Date(rawEnd);
        if (isNaN(endDate.getTime())) {
          sendJson(res, 400, { error: "endDate invalido. Debe ser una fecha ISO valida." });
          return;
        }
      }

      const creatorsActivity = await getCreatorsActivityReport({ startDate, endDate });
      sendJson(res, 200, { creatorsActivity });
    });
  }

  if (req.method === "GET" && url.pathname === "/api/assets") {
    return withApiError(res, async () => {
      const user = await getOptionalRequestUser(req)
      const result = await listAssets(url.searchParams.get("scope"), user?.id ?? null, url.searchParams.get("kind"))
      sendJson(res, 200, { assets: result })
    })
  }

  if (req.method === "POST" && url.pathname === "/api/assets") {
    return withMultipartBody(req, res, async ({ fields, file }) => {
      const user = await getRequiredRequestUser(req)
      const result = await createAsset({
        kind: fields.kind,
        visibility: fields.visibility,
        name: fields.name,
        description: fields.description,
        metadata: fields.metadata,
        file,
      }, user.id)
      sendJson(res, 201, result)
    })
  }

  const assetFileMatch = /^\/api\/assets\/([^/]+)\/file$/.exec(url.pathname)
  if (assetFileMatch && req.method === "GET") {
    return withApiError(res, async () => {
      const user = await getOptionalRequestUser(req)
      const identifier = decodeURIComponent(assetFileMatch[1] ?? "")
      const result = await getAssetObject(identifier, user?.id ?? null)
      await sendAssetFile(res, result.asset, result.object)
    })
  }

  const assetMatch = /^\/api\/assets\/([^/]+)$/.exec(url.pathname)
  if (assetMatch && req.method === "GET") {
    return withApiError(res, async () => {
      const user = await getOptionalRequestUser(req)
      const identifier = decodeURIComponent(assetMatch[1] ?? "")
      const result = await getAsset(identifier, user?.id ?? null)
      sendJson(res, 200, result)
    })
  }

  if (req.method === "GET" && url.pathname === "/api/recommendations/popularity") {
    return withApiError(res, async () => {
      const limitParam = url.searchParams.get("limit")
      const gravityParam = url.searchParams.get("gravity")
      const regionParam = url.searchParams.get("region")
      const langParam = url.searchParams.get("language")

      const limit = limitParam ? parseInt(limitParam, 10) : undefined
      const gravity = gravityParam ? parseFloat(gravityParam) : undefined

      const acceptLangHeader = req.headers["accept-language"]
      const parsedLangs = parseAcceptLanguage(Array.isArray(acceptLangHeader) ? acceptLangHeader[0] : acceptLangHeader)
      const defaultHeaderLang = parsedLangs[0]

      const result = await getPopularityRecommendations({ limit, gravity })
      const filtered = await applyQualityFilter(result, null, {
        clientRegion: regionParam ?? undefined,
        preferredLanguage: langParam ?? defaultHeaderLang ?? undefined,
        minItemsCount: limit ? Math.max(1, Math.floor(limit / 2)) : undefined,
      })
      sendJson(res, 200, { recommendations: filtered })
    })
  }

  if (req.method === "GET" && url.pathname === "/api/recommendations/content-based") {
    return withApiError(res, async () => {
      const limitParam = url.searchParams.get("limit")
      const regionParam = url.searchParams.get("region")
      const langParam = url.searchParams.get("language")

      const limit = limitParam ? parseInt(limitParam, 10) : undefined

      const user = await getOptionalRequestUser(req)
      const acceptLangHeader = req.headers["accept-language"]
      const parsedLangs = parseAcceptLanguage(Array.isArray(acceptLangHeader) ? acceptLangHeader[0] : acceptLangHeader)
      const defaultHeaderLang = parsedLangs[0]

      const result = await getContentRecommendations(user?.id ?? null, { limit })
      const filtered = await applyQualityFilter(result, user?.id ?? null, {
        clientRegion: regionParam ?? undefined,
        preferredLanguage: langParam ?? defaultHeaderLang ?? undefined,
        minItemsCount: limit ? Math.max(1, Math.floor(limit / 2)) : undefined,
      })
      sendJson(res, 200, { recommendations: filtered })
    })
  }

  if (req.method === "GET" && url.pathname === "/api/recommendations/collaborative") {
    return withApiError(res, async () => {
      const limitParam = url.searchParams.get("limit")
      const gravityParam = url.searchParams.get("gravity")
      const regionParam = url.searchParams.get("region")
      const langParam = url.searchParams.get("language")

      const limit = limitParam ? parseInt(limitParam, 10) : undefined
      const gravity = gravityParam ? parseFloat(gravityParam) : undefined

      const user = await getOptionalRequestUser(req)
      const acceptLangHeader = req.headers["accept-language"]
      const parsedLangs = parseAcceptLanguage(Array.isArray(acceptLangHeader) ? acceptLangHeader[0] : acceptLangHeader)
      const defaultHeaderLang = parsedLangs[0]

      const result = await getCollaborativeRecommendations(user?.id ?? null, { limit, gravity })
      const filtered = await applyQualityFilter(result, user?.id ?? null, {
        clientRegion: regionParam ?? undefined,
        preferredLanguage: langParam ?? defaultHeaderLang ?? undefined,
        minItemsCount: limit ? Math.max(1, Math.floor(limit / 2)) : undefined,
      })
      sendJson(res, 200, { recommendations: filtered })
    })
  }

  if (req.method === "POST" && url.pathname === "/api/presence/status") {
    return withJsonBody(req, res, async (body) => {
      const user = await getRequiredRequestUser(req)
      const data = body as { status?: string }
      if (!data.status || !["ONLINE", "INVISIBLE", "DND"].includes(data.status)) {
        sendJson(res, 400, { error: "status invalido. Debe ser 'ONLINE', 'INVISIBLE' o 'DND'." })
        return
      }
      await setUserVisibility(user.id, data.status as PlayerVisibility)
      sendJson(res, 200, { ok: true, status: data.status })
    })
  }

  if (req.method === "GET" && url.pathname === "/api/recommendations/social") {
    return withApiError(res, async () => {
      const limitParam = url.searchParams.get("limit")
      const regionParam = url.searchParams.get("region")
      const langParam = url.searchParams.get("language")

      const limit = limitParam ? parseInt(limitParam, 10) : undefined

      const user = await getOptionalRequestUser(req)
      const acceptLangHeader = req.headers["accept-language"]
      const parsedLangs = parseAcceptLanguage(Array.isArray(acceptLangHeader) ? acceptLangHeader[0] : acceptLangHeader)
      const defaultHeaderLang = parsedLangs[0]

      const result = await getSocialRecommendations(user?.id ?? null, { limit })
      const filtered = await applyQualityFilter(result as any, user?.id ?? null, {
        clientRegion: regionParam ?? undefined,
        preferredLanguage: langParam ?? defaultHeaderLang ?? undefined,
        minItemsCount: limit ? Math.max(1, Math.floor(limit / 2)) : undefined,
      })
      sendJson(res, 200, { recommendations: filtered })
    })
  }

  if (req.method === "GET" && url.pathname === "/api/recommendations/bandit") {
    return withApiError(res, async () => {
      const limitParam = url.searchParams.get("limit")
      const modeParam = url.searchParams.get("mode")
      const regionParam = url.searchParams.get("region")
      const langParam = url.searchParams.get("language")

      const limit = limitParam ? parseInt(limitParam, 10) : undefined
      const mode = (modeParam === "thompson" || modeParam === "epsilon-greedy") ? modeParam : "epsilon-greedy"

      const user = await getOptionalRequestUser(req)
      const acceptLangHeader = req.headers["accept-language"]
      const parsedLangs = parseAcceptLanguage(Array.isArray(acceptLangHeader) ? acceptLangHeader[0] : acceptLangHeader)
      const defaultHeaderLang = parsedLangs[0]

      const result = await getBanditRecommendations(user?.id ?? null, { limit, mode })
      const filtered = await applyQualityFilter(result as any, user?.id ?? null, {
        clientRegion: regionParam ?? undefined,
        preferredLanguage: langParam ?? defaultHeaderLang ?? undefined,
        minItemsCount: limit ? Math.max(1, Math.floor(limit / 2)) : undefined,
      })
      sendJson(res, 200, { recommendations: filtered })
    })
  }

  if (req.method === "GET" && url.pathname === "/api/recommendations/hybrid") {
    return withApiError(res, async () => {
      const limitParam = url.searchParams.get("limit")
      const regionParam = url.searchParams.get("region")
      const langParam = url.searchParams.get("language")

      const limit = limitParam ? parseInt(limitParam, 10) : undefined

      const user = await getOptionalRequestUser(req)
      const acceptLangHeader = req.headers["accept-language"]
      const parsedLangs = parseAcceptLanguage(Array.isArray(acceptLangHeader) ? acceptLangHeader[0] : acceptLangHeader)
      const defaultHeaderLang = parsedLangs[0]

      const result = await getHybridRecommendations(user?.id ?? null, { limit })
      const filtered = await applyQualityFilter(result as any, user?.id ?? null, {
        clientRegion: regionParam ?? undefined,
        preferredLanguage: langParam ?? defaultHeaderLang ?? undefined,
        minItemsCount: limit ? Math.max(1, Math.floor(limit / 2)) : undefined,
      })

      let retentionIncentiveActive = false;
      let incentiveMessage: string | undefined = undefined;

      if (user) {
        const profile = await PlayerProfileRepository.getProfile(user.id);
        const atRisk = profile?.atRisk === true || (profile?.churnScore !== null && profile?.churnScore !== undefined && profile.churnScore >= 0.85);
        if (atRisk) {
          retentionIncentiveActive = true;
          incentiveMessage = "¡Tus amigos están en línea jugando! Únete a ellos ahora mismo.";
        }
      }

      sendJson(res, 200, {
        recommendations: filtered,
        retentionIncentiveActive,
        incentiveMessage
      })
    })
  }

  // ── Matchmaker Endpoints ───────────────────────────────────────────────

  if (req.method === "POST" && url.pathname === "/api/matchmaker/join") {
    return withJsonBody(req, res, async (body) => {
      const data = body as { region?: string; mapId?: string; userId?: string; skillScore?: number; preferredLanguage?: string }
      const user = await getOptionalRequestUser(req)
      const resolvedUserId = user?.id ?? data.userId ?? null

      // Auto-enrich with skill score and language from PlayerFeatures if user is authenticated
      let skillScore = data.skillScore
      let preferredLanguage = data.preferredLanguage

      if (resolvedUserId && (skillScore === undefined || preferredLanguage === undefined)) {
        try {
          const { computeSkillScore, fetchPreferredLanguage } = await import("../services/matchmaking/skill_matcher.js")

          if (skillScore === undefined) {
            skillScore = await computeSkillScore(resolvedUserId)
          }
          if (preferredLanguage === undefined) {
            preferredLanguage = await fetchPreferredLanguage(resolvedUserId) ?? undefined
          }
        } catch (err) {
          // Non-critical: matchmaker works without enrichment
          logger.warn("HTTP", `Failed to enrich matchmaker ticket for user ${resolvedUserId}`, err)
        }
      }

      const { ticketId, region, queuePosition } = matchmaker.joinQueue({
        userId: resolvedUserId,
        region: data.region,
        mapId: data.mapId ?? null,
        skillScore,
        preferredLanguage,
      })

      const queue = (matchmaker as any).queues.get(region) ?? []
      const ewt = ewtCalculator.calculateEWT(region, "FFA", skillScore, queue.length)
      const estimatedWaitMs = ewt.estimatedWaitMs
      const estimatedWaitRange = ewt.estimatedWaitRange

      sendJson(res, 200, {
        ticketId,
        region,
        queuePosition,
        estimatedWaitMs,
        estimatedWaitRange,
      })
    })
  }

  if (req.method === "DELETE" && url.pathname === "/api/matchmaker/leave") {
    return withJsonBody(req, res, async (body) => {
      const data = body as { ticketId?: string }
      if (!data.ticketId) {
        sendJson(res, 400, { error: "ticketId is required" })
        return
      }
      const removed = matchmaker.leaveQueue(data.ticketId)
      sendJson(res, 200, { ok: removed })
    })
  }

  if (req.method === "GET" && url.pathname === "/api/matchmaker/status") {
    return withApiError(res, async () => {
      const status = matchmaker.getQueueStatus()
      sendJson(res, 200, status)
    })
  }

  if (req.method === "GET" && url.pathname === "/api/matchmaker/ewt") {
    return withApiError(res, async () => {
      const region = url.searchParams.get("region") || "us-east"
      const skillScoreStr = url.searchParams.get("skillScore")
      const skillScore = skillScoreStr !== null && skillScoreStr !== "" ? Number(skillScoreStr) : undefined
      const queue = (matchmaker as any).queues.get(region) ?? []
      const ewt = ewtCalculator.calculateEWT(region, "FFA", skillScore, queue.length)
      sendJson(res, 200, ewt)
    })
  }

  if (req.method === "GET" && url.pathname === "/api/matchmaker/ticket") {
    return withApiError(res, async () => {
      const ticketId = url.searchParams.get("ticketId")
      if (!ticketId) {
        sendJson(res, 400, { error: "ticketId is required" })
        return
      }
      // Check if the ticket was already matched
      const matchedResult = matchmaker.getMatchedTicketResult(ticketId)
      if (matchedResult) {
        sendJson(res, 200, { status: "matched", match: matchedResult })
        return
      }
      // Check if the ticket is still in queue
      const ticket = matchmaker.getTicket(ticketId)
      if (ticket) {
        const queue = (matchmaker as any).queues.get(ticket.region) ?? []
        const pos = queue.findIndex((t: any) => t.ticketId === ticketId) + 1
        sendJson(res, 200, { status: "waiting", queuePosition: pos })
        return
      }
      // Otherwise, not found (either expired or canceled)
      sendJson(res, 200, { status: "not_found" })
    })
  }

  if (req.method === "GET" && url.pathname === "/api/maps") {
    return withApiError(res, async () => {
      const user = await getOptionalRequestUser(req)
      const result = await listMaps(url.searchParams.get("scope"), user?.id ?? null)
      sendJson(res, 200, { maps: result })
    })
  }

  if (req.method === "POST" && url.pathname === "/api/maps") {
    return withJsonBody(req, res, async (body) => {
      const user = await getRequiredRequestUser(req)
      const result = await createMap(body as MapWriteInput, user.id)
      sendJson(res, 201, result)
    })
  }

  const mapMatch = /^\/api\/maps\/([^/]+)$/.exec(url.pathname)
  if (mapMatch) {
    const identifier = decodeURIComponent(mapMatch[1] ?? "")

    if (req.method === "GET") {
      return withApiError(res, async () => {
        const user = await getOptionalRequestUser(req)
        const result = await getMap(identifier, user?.id ?? null)
        sendJson(res, 200, result)
      })
    }

    if (req.method === "PUT") {
      return withJsonBody(req, res, async (body) => {
        const user = await getRequiredRequestUser(req)
        const result = await updateMap(identifier, body as MapWriteInput, user.id)
        sendJson(res, 200, result)
      })
    }

    if (req.method === "DELETE") {
      return withApiError(res, async () => {
        const user = await getRequiredRequestUser(req)
        const result = await deleteMap(identifier, user.id)
        sendJson(res, 200, result)
      })
    }
  }

  sendJson(res, 404, { error: "Not found" })
}

async function withApiError(
  res: ServerResponse,
  handler: () => Promise<void>,
): Promise<void> {
  try {
    await handler()
  } catch (err) {
    handleApiError(res, err)
  }
}

async function withJsonBody(
  req: HttpIncomingMessage,
  res: ServerResponse,
  handler: (body: unknown) => Promise<void>,
): Promise<void> {
  try {
    const body = await readJson(req)
    await handler(body)
  } catch (err) {
    handleApiError(res, err)
  }
}

function readJson(req: HttpIncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ""

    req.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8")
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        reject(new AuthError(413, "Payload demasiado grande"))
        req.destroy()
      }
    })

    req.on("end", () => {
      if (!body.trim()) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new AuthError(400, "JSON invalido"))
      }
    })

    req.on("error", reject)
  })
}

function handleApiError(res: ServerResponse, err: unknown): void {
  if (res.headersSent) return

  if (err instanceof AuthError) {
    sendJson(res, err.status, { error: err.message })
    return
  }

  if (isDatabaseConnectionError(err)) {
    logger.error("HTTP", "Database connection unavailable", err)
    sendJson(res, 503, { error: "Base de datos no disponible" })
    return
  }

  logger.error("HTTP", "Unhandled API error", err)
  sendJson(res, 500, { error: "Error interno del servidor" })
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(payload))
}

const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
)

function setCorsHeaders(req: HttpIncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin
  if (typeof origin === "string" && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin)
    // Only send credentials header when the origin is explicitly whitelisted,
    // preventing CSRF via wildcard-credential combinations.
    res.setHeader("Access-Control-Allow-Credentials", "true")
  }
  res.setHeader("Vary", "Origin")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

async function withMultipartBody(
  req: HttpIncomingMessage,
  res: ServerResponse,
  handler: (body: { fields: Record<string, unknown>; file: UploadedAssetFile }) => Promise<void>,
): Promise<void> {
  try {
    const body = await readMultipartAsset(req)
    await handler(body)
  } catch (err) {
    handleApiError(res, err)
  }
}

function readMultipartAsset(req: HttpIncomingMessage): Promise<{ fields: Record<string, unknown>; file: UploadedAssetFile }> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"]
    if (!contentType || !contentType.includes("multipart/form-data")) {
      reject(new AuthError(415, "Se requiere multipart/form-data"))
      return
    }

    const maxFileSize = Number(process.env.ASSET_MAX_UPLOAD_BYTES || 50 * 1024 * 1024)
    const fields: Record<string, unknown> = {}
    let uploadedFile: UploadedAssetFile | null = null
    let rejected = false

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: Number.isFinite(maxFileSize) && maxFileSize > 0 ? maxFileSize : 50 * 1024 * 1024,
        fields: 12,
      },
    })

    const fail = (err: Error) => {
      if (rejected) return
      rejected = true
      reject(err)
    }

    busboy.on("field", (name, value) => {
      if (name === "metadata") {
        try {
          fields[name] = value.trim() ? JSON.parse(value) : undefined
        } catch {
          fail(new AuthError(400, "Metadata invalida"))
        }
        return
      }
      fields[name] = value
    })

    busboy.on("file", (_fieldName, file, info) => {
      const chunks: Buffer[] = []
      let fileTooLarge = false

      file.on("data", (chunk: Buffer) => chunks.push(chunk))
      file.on("limit", () => {
        fileTooLarge = true
        fail(new AuthError(413, "Archivo demasiado grande"))
      })
      file.on("error", fail)
      file.on("end", () => {
        if (fileTooLarge || rejected) return
        uploadedFile = {
          filename: info.filename || "asset.bin",
          mimeType: info.mimeType || "application/octet-stream",
          buffer: Buffer.concat(chunks),
        }
      })
    })

    busboy.on("error", fail)
    busboy.on("finish", () => {
      if (rejected) return
      if (!uploadedFile) {
        reject(new AuthError(400, "Archivo requerido"))
        return
      }
      resolve({ fields, file: uploadedFile })
    })

    req.pipe(busboy)
  })
}

async function sendAssetFile(
  res: ServerResponse,
  asset: { name: string; mimeType: string; sizeBytes: number },
  object: { Body?: unknown; ContentLength?: number },
): Promise<void> {
  if (!object.Body) throw new AuthError(404, "Archivo no encontrado")

  res.writeHead(200, {
    "Content-Type": asset.mimeType,
    "Content-Length": String(object.ContentLength ?? asset.sizeBytes),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Disposition": `inline; filename="${sanitizeDownloadName(asset.name)}"`,
  })

  const body = object.Body
  if (body instanceof Readable) {
    body.on("error", (err) => {
      logger.error("HTTP", "Asset stream failed", err)
      if (!res.destroyed) res.destroy(err)
    })
    body.pipe(res)
    return
  }

  if (typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
    res.end(Buffer.from(bytes))
    return
  }

  res.end(Buffer.from(String(body)))
}

function sanitizeDownloadName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset"
}

async function getOptionalRequestUser(req: HttpIncomingMessage) {
  const token = getBearerToken(req)
  if (!token) return null
  return getUserBySessionToken(token)
}

async function getRequiredRequestUser(req: HttpIncomingMessage) {
  const token = getBearerToken(req)
  if (!token) throw new AuthError(401, "Sesion requerida")
  return requireUserBySessionToken(token)
}

function getBearerToken(req: HttpIncomingMessage) {
  const header = req.headers.authorization
  if (typeof header !== "string") return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() || null
}

function isDatabaseConnectionError(err: unknown) {
  if (!err || typeof err !== "object") return false
  const code = "code" in err ? String(err.code) : ""
  const message = err instanceof Error ? err.message : ""
  return code === "ECONNREFUSED" || message.includes("ECONNREFUSED")
}

/**
 * Resolves the real client IP address.
 * When TRUSTED_PROXY=true, reads X-Forwarded-For / X-Real-IP set by the reverse proxy.
 * Otherwise falls back to the TCP socket address to prevent IP spoofing.
 */
function getClientIp(req: HttpIncomingMessage): string {
  if (process.env.TRUSTED_PROXY === "true") {
    const forwarded = req.headers["x-forwarded-for"]
    if (typeof forwarded === "string") {
      const first = forwarded.split(",")[0]?.trim()
      if (first) return first
    }
    const realIp = req.headers["x-real-ip"]
    if (typeof realIp === "string" && realIp.trim()) return realIp.trim()
  }
  return req.socket.remoteAddress ?? "unknown"
}

/**
 * Adds defensive HTTP headers to every response.
 * These prevent MIME sniffing, framing attacks, and info leakage via Referer.
 */
function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
}

/**
 * Sliding-window rate limiter backed by Redis.
 * @param failClosed - when true, BLOCKS requests if Redis is unavailable (use for auth).
 *                     when false, ALLOWS requests on Redis failure (use for analytics).
 * Returns true if the caller should be rejected (limit exceeded).
 */
async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
  failClosed = false,
): Promise<boolean> {
  const redis = getRedis()
  if (!redis || !redis.isOpen) return failClosed

  const rlKey = `rl:${key}`
  try {
    const count = await redis.incr(rlKey)
    if (count === 1) {
      await redis.expire(rlKey, windowSeconds)
    }
    return count > maxRequests
  } catch {
    return failClosed
  }
}
