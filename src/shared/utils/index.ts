// Shared utility functions

/**
 * Combines class names, filtering out falsy values
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ══════════════════════════════════════════════════════════
// Utilidades de Fecha - Timezone Colombia (America/Bogota)
// ══════════════════════════════════════════════════════════
const COLOMBIA_TIMEZONE = "America/Bogota";

/**
 * Obtiene la fecha actual en Colombia
 */
export function getNowColombia(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: COLOMBIA_TIMEZONE }));
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) o Date a string legible
 * Siempre usa timezone Colombia para evitar desfases
 */
export function formatFechaColombia(
  fecha: string | Date | null | undefined,
  options: {
    includeTime?: boolean;
    format?: "short" | "long" | "numeric";
  } = {}
): string {
  if (!fecha) return "—";
  
  try {
    // Si es string YYYY-MM-DD, añadir mediodía para evitar desfase UTC
    let date: Date;
    if (typeof fecha === "string") {
      // Si ya tiene T (es datetime), usarlo directo
      if (fecha.includes("T")) {
        date = new Date(fecha);
      } else {
        // Es solo fecha YYYY-MM-DD, añadir mediodía Colombia
        date = new Date(fecha + "T12:00:00");
      }
    } else {
      date = fecha;
    }

    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: COLOMBIA_TIMEZONE,
    };

    if (options.format === "numeric") {
      formatOptions.day = "2-digit";
      formatOptions.month = "2-digit";
      formatOptions.year = "numeric";
    } else if (options.format === "long") {
      formatOptions.day = "numeric";
      formatOptions.month = "long";
      formatOptions.year = "numeric";
    } else {
      // short (default)
      formatOptions.day = "2-digit";
      formatOptions.month = "short";
      formatOptions.year = "numeric";
    }

    if (options.includeTime) {
      formatOptions.hour = "2-digit";
      formatOptions.minute = "2-digit";
    }

    return date.toLocaleDateString("es-CO", formatOptions);
  } catch {
    return typeof fecha === "string" ? fecha : "—";
  }
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD (timezone Colombia)
 */
export function getTodayColombia(): string {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: COLOMBIA_TIMEZONE });
}

/**
 * Formatea datetime ISO a string con hora
 */
export function formatFechaHoraColombia(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CO", {
      timeZone: COLOMBIA_TIMEZONE,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Formats a date to a locale string
 * @deprecated Use formatFechaColombia instead
 */
export function formatDate(date: Date, locale = "es-CO"): string {
  return date.toLocaleDateString(locale, {
    timeZone: COLOMBIA_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ══════════════════════════════════════════════════════════
// Galería del dispositivo
// ══════════════════════════════════════════════════════════

/**
 * Guarda una imagen en la galería del dispositivo descargándola
 * al almacenamiento local del navegador.
 * En iOS Safari las descargas de imágenes van automáticamente
 * a la app Fotos. En Android van a Descargas / Galería.
 */
export function guardarEnGaleria(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  a.download = `evidencia_${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

