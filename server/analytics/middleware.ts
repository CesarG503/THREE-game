import Ajv from "ajv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Ajv with strict mode disabled to allow custom configuration
const AjvClass = Ajv as any;
const ajv = new AjvClass({
  allErrors: true,
  strict: false,
});

// Register manual format validators to avoid external dependency (ajv-formats)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
ajv.addFormat("uuid", {
  type: "string",
  validate: (str: string) => UUID_REGEX.test(str),
});

ajv.addFormat("date-time", {
  type: "string",
  validate: (str: string) => {
    const timestamp = Date.parse(str);
    return !isNaN(timestamp);
  },
});

// Schema loading helper
const loadSchema = (filename: string) => {
  const schemaPath = path.join(__dirname, "schemas", filename);
  return JSON.parse(fs.readFileSync(schemaPath, "utf8"));
};

// Load JSON schemas
const envelopeSchema = loadSchema("envelope.json");
const pageViewSchema = loadSchema("pageView.json");
const sessionStartSchema = loadSchema("sessionStart.json");
const sessionHeartbeatSchema = loadSchema("sessionHeartbeat.json");
const sessionEndSchema = loadSchema("sessionEnd.json");
const matchJoinSchema = loadSchema("matchJoin.json");
const matchLeaveSchema = loadSchema("matchLeave.json");
const matchStartSchema = loadSchema("matchStart.json");
const matchEndSchema = loadSchema("matchEnd.json");
const uiImpressionSchema = loadSchema("uiImpression.json");
const uiClickSchema = loadSchema("uiClick.json");
const uiScrollDepthSchema = loadSchema("uiScrollDepth.json");

// Register payload schemas under specific keys for reference
ajv.addSchema(pageViewSchema, "pageView");
ajv.addSchema(sessionStartSchema, "sessionStart");
ajv.addSchema(sessionHeartbeatSchema, "sessionHeartbeat");
ajv.addSchema(sessionEndSchema, "sessionEnd");
ajv.addSchema(matchJoinSchema, "matchJoin");
ajv.addSchema(matchLeaveSchema, "matchLeave");
ajv.addSchema(matchStartSchema, "matchStart");
ajv.addSchema(matchEndSchema, "matchEnd");
ajv.addSchema(uiImpressionSchema, "uiImpression");
ajv.addSchema(uiClickSchema, "uiClick");
ajv.addSchema(uiScrollDepthSchema, "uiScrollDepth");

// Compile validators
const validateEnvelope = ajv.compile(envelopeSchema);
const validatePageView = ajv.compile(pageViewSchema);
const validateSessionStart = ajv.compile(sessionStartSchema);
const validateSessionHeartbeat = ajv.compile(sessionHeartbeatSchema);
const validateSessionEnd = ajv.compile(sessionEndSchema);
const validateMatchJoin = ajv.compile(matchJoinSchema);
const validateMatchLeave = ajv.compile(matchLeaveSchema);
const validateMatchStart = ajv.compile(matchStartSchema);
const validateMatchEnd = ajv.compile(matchEndSchema);
const validateUiImpression = ajv.compile(uiImpressionSchema);
const validateUiClick = ajv.compile(uiClickSchema);
const validateUiScrollDepth = ajv.compile(uiScrollDepthSchema);

export interface ValidationErrorResponse {
  valid: boolean;
  errors?: string[];
}

/**
 * Validates a telemetry event's structure and payload contracts.
 * Executes in <1ms.
 */
export function validateTelemetryEvent(event: any): ValidationErrorResponse {
  if (!event || typeof event !== "object") {
    return { valid: false, errors: ["Event must be a non-null object"] };
  }

  // 1. Validate envelope first
  const isEnvelopeValid = validateEnvelope(event);
  if (!isEnvelopeValid) {
    const errors = validateEnvelope.errors?.map((err: any) => {
      const field = err.instancePath || "/";
      return `envelope: Field "${field}" ${err.message}`;
    }) || ["Invalid envelope structure"];
    return { valid: false, errors };
  }

  // 2. Validate payload based on eventType
  let isValidPayload = false;
  let errors: string[] = [];

  switch (event.eventType) {
    case "PageView":
      isValidPayload = validatePageView(event.payload);
      if (!isValidPayload) {
        errors = validatePageView.errors?.map((err: any) => {
          const field = err.instancePath || "/";
          return `payload: Field "${field}" ${err.message}`;
        }) || ["Invalid PageView payload"];
      }
      break;
    case "SessionStart":
      isValidPayload = validateSessionStart(event.payload);
      if (!isValidPayload) {
        errors = validateSessionStart.errors?.map((err: any) => {
          const field = err.instancePath || "/";
          return `payload: Field "${field}" ${err.message}`;
        }) || ["Invalid SessionStart payload"];
      }
      break;
    case "SessionHeartbeat":
      isValidPayload = validateSessionHeartbeat(event.payload);
      if (!isValidPayload) {
        errors = validateSessionHeartbeat.errors?.map((err: any) => {
          const field = err.instancePath || "/";
          return `payload: Field "${field}" ${err.message}`;
        }) || ["Invalid SessionHeartbeat payload"];
      }
      break;
    case "SessionEnd":
      isValidPayload = validateSessionEnd(event.payload);
      if (!isValidPayload) {
        errors = validateSessionEnd.errors?.map((err: any) => {
          const field = err.instancePath || "/";
          return `payload: Field "${field}" ${err.message}`;
        }) || ["Invalid SessionEnd payload"];
      }
      break;
    case "MatchJoin":
      isValidPayload = validateMatchJoin(event.payload);
      if (!isValidPayload) {
        errors = validateMatchJoin.errors?.map((err: any) => {
          const field = err.instancePath || "/";
          return `payload: Field "${field}" ${err.message}`;
        }) || ["Invalid MatchJoin payload"];
      }
      break;
    case "MatchLeave":
      isValidPayload = validateMatchLeave(event.payload);
      if (!isValidPayload) {
        errors = validateMatchLeave.errors?.map((err: any) => {
          const field = err.instancePath || "/";
          return `payload: Field "${field}" ${err.message}`;
        }) || ["Invalid MatchLeave payload"];
      }
      break;
    case "MatchStart":
      isValidPayload = validateMatchStart(event.payload);
      if (!isValidPayload) {
        errors = validateMatchStart.errors?.map((err: any) => {
          const field = err.instancePath || "/";
          return `payload: Field "${field}" ${err.message}`;
        }) || ["Invalid MatchStart payload"];
      }
      break;
    case "MatchEnd":
      isValidPayload = validateMatchEnd(event.payload);
      if (!isValidPayload) {
        errors = validateMatchEnd.errors?.map((err: any) => {
          const field = err.instancePath || "/";
          return `payload: Field "${field}" ${err.message}`;
        }) || ["Invalid MatchEnd payload"];
      }
      break;
    case "UiImpression":
      isValidPayload = validateUiImpression(event.payload);
      if (!isValidPayload) {
        errors = validateUiImpression.errors?.map((err: any) => {
          const field = err.instancePath || "/";
          return `payload: Field "${field}" ${err.message}`;
        }) || ["Invalid UiImpression payload"];
      }
      break;
    case "UiClick":
      isValidPayload = validateUiClick(event.payload);
      if (!isValidPayload) {
        errors = validateUiClick.errors?.map((err: any) => {
          const field = err.instancePath || "/";
          return `payload: Field "${field}" ${err.message}`;
        }) || ["Invalid UiClick payload"];
      }
      break;
    case "UiScrollDepth":
      isValidPayload = validateUiScrollDepth(event.payload);
      if (!isValidPayload) {
        errors = validateUiScrollDepth.errors?.map((err: any) => {
          const field = err.instancePath || "/";
          return `payload: Field "${field}" ${err.message}`;
        }) || ["Invalid UiScrollDepth payload"];
      }
      break;
    default:
      return {
        valid: false,
        errors: [`envelope: Unsupported eventType "${event.eventType}"`],
      };
  }

  if (!isValidPayload) {
    return { valid: false, errors };
  }

  return { valid: true };
}
