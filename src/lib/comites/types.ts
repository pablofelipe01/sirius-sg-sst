// ══════════════════════════════════════════════════════════
// Tipos compartidos — Actas Comités SST (COPASST + COCOLAB)
// Modelo refactorizado: integrantes provienen de
// "Miembros Comite SST" (FK), capacitaciones COPASST de
// "Programación Capacitaciones" (FK).
// ══════════════════════════════════════════════════════════

export type ComiteTipo = "COPASST" | "COCOLAB";
export type EstadoActa = "borrador" | "firmada";

export type RolMiembro =
  | "presidente"
  | "secretaria"
  | "secretario"
  | "suplente_empleador"
  | "suplente_empresa"
  | "suplente_trabajadores"
  | "invitado";

export type ResultadoCondicion = "ok" | "oportunidad_mejora" | "critico";

export type CategoriaAccionPreventiva =
  | "riesgo_psicosocial"
  | "convivencia_laboral"
  | "articulacion_sgsst"
  | "cultura_preventiva"
  | "otro";

// ── Miembro del Comité (vista del agregado para el acta) ──
export interface MiembroComite {
  recordId: string;             // Airtable record id (uso para multipleRecordLinks)
  idMiembro: string;            // ID Miembro humano
  nombre: string;
  cedula: string;
  cargo: string;
  comite: ComiteTipo;
  rol: string;                  // RolMiembro o texto libre desde Airtable
  estado?: string;
}

// ── Asistente al acta = miembro + flag de asistencia + firma ──
export interface AsistenteActa {
  id?: string;                  // record ID en asistencia_comites (si ya existe)
  recordId: string;             // FK a Miembros Comite SST (para lookup)
  asistio: boolean;
  firma?: string | null;        // Data URL del canvas (base64)
  fechaFirma?: string | null;   // ISO timestamp
  observaciones?: string | null;
  // Datos derivados (snapshot, llenados al leer)
  nombre?: string;
  cedula?: string;
  cargo?: string;
  rol?: string;
}

// ── Capacitación referenciada (COPASST) ──────────────────
export interface CapacitacionRef {
  recordId: string;             // FK a Programación Capacitaciones
  tema?: string;
  fechaEjecucion?: string | null;
}

// ── Compromiso (tabla compartida con discriminador comité) ─
export interface CompromisoActa {
  id?: string;
  compromiso: string;
  responsable: string;
  fechaLimite: string;          // YYYY-MM-DD
  cumplido?: boolean | null;
}

export interface CondicionInsegura {
  id?: string;
  descripcion: string;
  resultado: ResultadoCondicion;
  observacion?: string | null;
}

export interface AccionPreventivaCocolab {
  id?: string;
  categoria: CategoriaAccionPreventiva;
  descripcion: string;
}

export interface FirmaActaInput {
  rol: "presidente" | "secretaria" | "secretario";
  nombre: string;
  cedula: string;
  cargo: string;
  signatureDataUrl: string;     // Data URL canvas
}

// ── Cabecera común ────────────────────────────────────────
export interface ActaBase {
  id?: string;                  // Airtable record id
  idActa?: string;
  numeroActa: string;
  mesEvaluado: string;
  fechaReunion: string;         // YYYY-MM-DD
  horaInicio: string;           // HH:mm
  horaCierre: string;
  lugar: string;
  estado: EstadoActa;
  firmaPresidente?: string | null;
  firmaSecretario?: string | null;
  urlDocumento?: string | null;
  fechaExportacion?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActaCopasst extends ActaBase {
  comite: "COPASST";
  accidentesPresentados: boolean;
  accidentesDetalle?: string | null;
  incidentesPresentados: boolean;
  incidentesDetalle?: string | null;
  novedadesAdministrativas?: string | null;
  asistentes: AsistenteActa[];
  condicionesInseguras: CondicionInsegura[];
  capacitaciones: CapacitacionRef[];
  compromisos: CompromisoActa[];
}

export interface ActaCocolab extends ActaBase {
  comite: "COCOLAB";
  quejasAcoso: boolean;
  quejasAcosoDetalle?: string | null;
  conflictosLaborales: boolean;
  conflictosLaboralesDetalle?: string | null;
  asistentes: AsistenteActa[];
  accionesPreventivas: AccionPreventivaCocolab[];
  compromisos: CompromisoActa[];
}

export type ActaCompleta = ActaCopasst | ActaCocolab;

export const FORMATO_COMITE = {
  COPASST: {
    codigo: "FT-SST-008",
    version: "002",
    fechaEdicion: "01-04-2026",
    nombre: "ACTA DE REUNIÓN COMITÉ PARITARIO DE SEGURIDAD Y SALUD EN EL TRABAJO",
  },
  COCOLAB: {
    codigo: "F-TSST-017",
    version: "002",
    fechaEdicion: "01-04-2026",
    nombre: "ACTA DE REUNIÓN COMITÉ DE CONVIVENCIA LABORAL",
  },
} as const;

// Quórum mínimo (Res. 0312/2019 art. 24 + Res. 652/2012)
export function validarQuorum(
  comite: ComiteTipo,
  asistentes: AsistenteActa[]
): { ok: boolean; mensaje?: string } {
  const presentes = asistentes.filter((a) => a.asistio !== false);
  const presidente = presentes.find((a) => (a.rol || "").toLowerCase() === "presidente");
  const secretaria = presentes.find((a) => {
    const r = (a.rol || "").toLowerCase();
    return r === "secretaria" || r === "secretario";
  });
  if (!presidente)
    return { ok: false, mensaje: "Falta presidente con asistencia confirmada" };
  if (!secretaria)
    return {
      ok: false,
      mensaje: `Falta ${comite === "COCOLAB" ? "secretaria" : "secretario(a)"} con asistencia confirmada`,
    };
  if (presentes.length < 2)
    return { ok: false, mensaje: "Quórum insuficiente: mínimo 2 integrantes" };
  return { ok: true };
}
