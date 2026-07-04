const SENSITIVE_QUERY_KEY = /(?:api[-_]?key|token|password|secret|signature|auth|access[-_]?key)/i;
const SENSITIVE_FIELD_KEY = /(?:api[-_]?key|token|password|secret|signature|auth|access[-_]?key)/i;

export function redactSensitiveText(value: string): string {
  return value
    .replace(/(api-key=)[^&\s"]+/gi, "$1[REDACTED]")
    .replace(/((?:token|password|secret|signature|auth|access[-_]?key)=)[^&\s"]+/gi, "$1[REDACTED]");
}

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEY.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    return url.toString().replaceAll("%5BREDACTED%5D", "[REDACTED]");
  } catch {
    return redactSensitiveText(value);
  }
}

export function redactSensitiveValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (SENSITIVE_FIELD_KEY.test(key)) {
        return [key, typeof item === "string" ? redactUrl(item) : "[REDACTED]"];
      }
      return [key, redactSensitiveValue(item)];
    }),
  );
}
