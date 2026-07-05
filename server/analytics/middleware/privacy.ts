import { createHash } from "node:crypto";
import { logger } from "../../utils/Logger.js";

// Lista negra de campos prohibidos que deben eliminarse completamente para proteger la PII
const FORBIDDEN_FIELDS = [
  "email",
  "password",
  "token",
  "auth_token",
  "secret",
  "credit_card",
  "cc",
  "ssn",
  "phone",
  "phonenumber"
];

// Campos de identificación de red y dispositivo que deben anonimizarse de forma determinista con sal
const ANONYMIZE_FIELDS = [
  "ip",
  "ipaddress",
  "ip_address",
  "clientip",
  "client_ip",
  "deviceid",
  "device_id",
  "macaddress",
  "mac_address"
];

// Obtener la clave de sal rotativa del entorno, o un fallback seguro
const getPrivacySalt = (): string => {
  return process.env.PRIVACY_SALT || "default-viperio-secure-salt-2026";
};

// Generar hash SHA-256 unidireccional con sal
function hashValue(val: string, salt: string): string {
  return createHash("sha256")
    .update(val + salt)
    .digest("hex");
}

/**
 * Recorre recursivamente un objeto (payload o evento completo) para aplicar reglas de privacidad
 */
export function enforcePrivacyRules(obj: any, path = ""): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Si es un arreglo, sanitizar cada elemento recursivamente
  if (Array.isArray(obj)) {
    return obj.map((item, idx) => enforcePrivacyRules(item, `${path}[${idx}]`));
  }

  // Si es un objeto, filtrar y anonimizar sus claves
  if (typeof obj === "object") {
    const cleaned: any = {};
    const salt = getPrivacySalt();

    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();

      // 1. Detección y eliminación de campos prohibidos (lista negra)
      if (FORBIDDEN_FIELDS.includes(lowerKey) || FORBIDDEN_FIELDS.some(field => lowerKey.includes(field))) {
        logger.error(
          "DataPrivacy",
          `PRIVACY VIOLATION DETECTED: Removed forbidden field "${key}" at path "${path ? path + "." : ""}${key}"`
        );
        continue; // Excluir por completo de la estructura final
      }

      const val = obj[key];

      // 2. Anonimización de IPs y Device IDs
      if (ANONYMIZE_FIELDS.includes(lowerKey) || ANONYMIZE_FIELDS.some(field => lowerKey === field)) {
        if (val !== null && val !== undefined) {
          cleaned[key] = hashValue(String(val), salt);
        }
        continue;
      }

      // 3. Recursión para sub-objetos
      cleaned[key] = enforcePrivacyRules(val, path ? `${path}.${key}` : key);
    }

    return cleaned;
  }

  return obj;
}

/**
 * Middleware para sanear cualquier evento de telemetría antes de guardarse.
 */
export function anonymizeTelemetryEvent(event: any): any {
  if (!event || typeof event !== "object") return event;

  // Retornar una copia sanitizada del evento completo (incluyendo envelope y payload)
  return enforcePrivacyRules(event);
}
