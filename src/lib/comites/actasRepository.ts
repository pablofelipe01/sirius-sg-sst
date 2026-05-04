// ══════════════════════════════════════════════════════════
// Repositorio Airtable para actas de comités (COPASST/COCOLAB)
// REUTILIZA tablas existentes:
//   • "Miembros Comite SST" → integrantes (filtrado por COMITE)
//   • "Programación Capacitaciones" → capacitaciones COPASST (FK)
// Tablas propias del módulo:
//   • copasst_actas, copasst_condiciones_inseguras
//   • cocolab_actas, cocolab_acciones_preventivas
//   • compromisos (compartida COPASST + COCOLAB)
// ══════════════════════════════════════════════════════════
import crypto from "crypto";
import {
  airtableSGSSTConfig,
  getSGSSTHeaders,
  getSGSSTUrl,
} from "@/infrastructure/config/airtableSGSST";
import { encryptAES, decryptAES } from "@/lib/firmaCrypto";
import type {
  ActaCocolab,
  ActaCompleta,
  ActaCopasst,
  AsistenteActa,
  CapacitacionRef,
  ComiteTipo,
  CompromisoActa,
  MiembroComite,
} from "./types";

// ── Tipos Airtable ────────────────────────────────────────
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}
interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

// ══════════════════════════════════════════════════════════
// Configuración por comité
// ══════════════════════════════════════════════════════════
interface ComiteCabeceraCfg {
  cabeceraTableId: string;
  cabeceraFields: Record<string, string>;
  // Campo del compromiso compartido que enlaza al acta de este comité
  compromisoActaLinkField: string;
}

function getCabeceraCfg(comite: ComiteTipo): ComiteCabeceraCfg {
  if (comite === "COPASST") {
    return {
      cabeceraTableId: airtableSGSSTConfig.copasstActasTableId,
      cabeceraFields: airtableSGSSTConfig.copasstActasFields,
      compromisoActaLinkField:
        airtableSGSSTConfig.compromisosFields.ACTA_COPASST_LINK,
    };
  }
  return {
    cabeceraTableId: airtableSGSSTConfig.cocolabActasTableId,
    cabeceraFields: airtableSGSSTConfig.cocolabActasFields,
    compromisoActaLinkField:
      airtableSGSSTConfig.compromisosFields.ACTA_COCOLAB_LINK,
  };
}

// ══════════════════════════════════════════════════════════
// Helpers HTTP
// ══════════════════════════════════════════════════════════
async function airtableFetch<T = AirtableResponse>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...getSGSSTHeaders(), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function escapeFormulaValue(v: string): string {
  return v.replace(/'/g, "\\'");
}

/**
 * Elimina entradas cuya clave sea vacía/undefined (campos opcionales del .env
 * que no fueron configurados, p.ej. CREATED_AT/UPDATED_AT cuando la tabla no
 * los tiene). Airtable rechaza cabeceras con keys vacías.
 */
function cleanFields(
  fields: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k && k.trim() !== "") out[k] = v;
  }
  return out;
}

async function postBatched(
  tableId: string,
  records: { fields: Record<string, unknown> }[]
): Promise<AirtableRecord[]> {
  if (records.length === 0) return [];
  const out: AirtableRecord[] = [];
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10).map((r) => ({
      fields: cleanFields(r.fields),
    }));
    const data = await airtableFetch<AirtableResponse>(getSGSSTUrl(tableId), {
      method: "POST",
      body: JSON.stringify({ records: batch, typecast: true }),
    });
    out.push(...data.records);
  }
  return out;
}

async function deleteRecords(tableId: string, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const params = batch.map((id) => `records[]=${id}`).join("&");
    await airtableFetch(`${getSGSSTUrl(tableId)}?${params}`, {
      method: "DELETE",
    });
  }
}

async function fetchRecordsByIds(
  tableId: string,
  ids: string[]
): Promise<AirtableRecord[]> {
  if (!ids.length) return [];
  const formula = encodeURIComponent(
    `OR(${ids.map((id) => `RECORD_ID()='${id}'`).join(",")})`
  );
  const url = `${getSGSSTUrl(tableId)}?filterByFormula=${formula}&returnFieldsByFieldId=true&pageSize=100`;
  const data = await airtableFetch<AirtableResponse>(url);
  return data.records;
}

// ══════════════════════════════════════════════════════════
// IDs y números de acta
// ══════════════════════════════════════════════════════════
export function generarIdActa(comite: ComiteTipo): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const rand = crypto.randomBytes(3).toString("hex");
  return `${comite}-${yyyy}${mm}${dd}-${rand}`;
}

export async function siguienteNumeroActa(comite: ComiteTipo): Promise<string> {
  const cfg = getCabeceraCfg(comite);
  const F = cfg.cabeceraFields;
  const year = new Date().getFullYear();
  const formula = encodeURIComponent(
    `FIND('-${year}', {${F.NUMERO_ACTA}}) > 0`
  );
  const url = `${getSGSSTUrl(cfg.cabeceraTableId)}?filterByFormula=${formula}&pageSize=100&returnFieldsByFieldId=true`;
  try {
    const data = await airtableFetch<AirtableResponse>(url);
    const max = data.records.reduce((acc, r) => {
      const num = String(r.fields[F.NUMERO_ACTA] || "");
      const n = parseInt(num.split("-")[0] || "0", 10);
      return n > acc ? n : acc;
    }, 0);
    return `${String(max + 1).padStart(3, "0")}-${year}`;
  } catch {
    return `001-${year}`;
  }
}

// ══════════════════════════════════════════════════════════
// MIEMBROS DEL COMITÉ — tabla EXISTENTE (solo lectura)
// ══════════════════════════════════════════════════════════
function mapMiembroFromRecord(rec: AirtableRecord): MiembroComite {
  const F = airtableSGSSTConfig.miembrosComiteFields;
  return {
    recordId: rec.id,
    idMiembro: (rec.fields[F.ID] as string) || "",
    nombre: (rec.fields[F.NOMBRE] as string) || "",
    cedula: (rec.fields[F.CEDULA] as string) || "",
    cargo: (rec.fields[F.CARGO] as string) || "",
    comite: ((rec.fields[F.COMITE] as string) || "COPASST") as ComiteTipo,
    rol: (rec.fields[F.ROL] as string) || "",
    estado: (rec.fields[F.ESTADO] as string) || undefined,
  };
}

export async function listarMiembrosComite(
  comite: ComiteTipo,
  soloActivos = true
): Promise<MiembroComite[]> {
  const F = airtableSGSSTConfig.miembrosComiteFields;
  const filters = [`{${F.COMITE}} = '${comite}'`];
  if (soloActivos) filters.push(`LOWER({${F.ESTADO}}) = 'activo'`);
  const params = new URLSearchParams({
    filterByFormula:
      filters.length === 1 ? filters[0] : `AND(${filters.join(",")})`,
    pageSize: "100",
    returnFieldsByFieldId: "true",
  });
  const data = await airtableFetch<AirtableResponse>(
    `${getSGSSTUrl(airtableSGSSTConfig.miembrosComiteTableId)}?${params}`
  );
  return data.records.map(mapMiembroFromRecord);
}

async function fetchMiembrosByRecordIds(
  ids: string[]
): Promise<Map<string, MiembroComite>> {
  const recs = await fetchRecordsByIds(
    airtableSGSSTConfig.miembrosComiteTableId,
    ids
  );
  const map = new Map<string, MiembroComite>();
  for (const r of recs) map.set(r.id, mapMiembroFromRecord(r));
  return map;
}

// ══════════════════════════════════════════════════════════
// ASISTENCIA COMITES — tabla intermedia con firma
// ══════════════════════════════════════════════════════════
async function fetchAsistenciasByActa(
  comite: ComiteTipo,
  actaIdText: string   // Valor del campo ID del acta (ej. "001-2026"), no el recordId interno de Airtable
): Promise<AsistenteActa[]> {
  const FA = airtableSGSSTConfig.asistenciaComitesFields;
  const linkField =
    comite === "COPASST" ? FA.ACTA_COPASST_LINK : FA.ACTA_COCOLAB_LINK;

  // ARRAYJOIN sobre un campo de vínculo devuelve los valores del campo primario
  // del registro vinculado (ej. "001-2026"), NO el recordId interno de Airtable.
  const formula = encodeURIComponent(
    `FIND('${escapeFormulaValue(actaIdText)}', ARRAYJOIN({${linkField}})) > 0`
  );
  const url = `${getSGSSTUrl(airtableSGSSTConfig.asistenciaComitesTableId)}?filterByFormula=${formula}&returnFieldsByFieldId=true&pageSize=100`;

  try {
    const data = await airtableFetch<AirtableResponse>(url);
    if (data.records.length === 0) return [];

    // Obtener IDs de miembros referenciados
    const miembrosIds = data.records
      .map((r) => (r.fields[FA.MIEMBRO_LINK] as string[])?.[0])
      .filter(Boolean) as string[];

    const miembrosMap = miembrosIds.length
      ? await fetchMiembrosByRecordIds(miembrosIds)
      : new Map();

    // Mapear a AsistenteActa
    return data.records.map((r): AsistenteActa => {
      const miembroRecordId = (r.fields[FA.MIEMBRO_LINK] as string[])?.[0] || "";
      const miembro = miembrosMap.get(miembroRecordId);

      // Descifrar firma — con fallback a texto plano para registros anteriores
      const rawFirma = (r.fields[FA.FIRMA] as string) || null;
      let firma: string | null = null;
      if (rawFirma) {
        if (rawFirma.startsWith("data:")) {
          // Registro antiguo: guardado sin cifrar
          firma = rawFirma;
        } else {
          try {
            firma = decryptAES(rawFirma);
          } catch {
            // Si falla el descifrado, devolver null para no mostrar datos corruptos
            console.warn("[comites] No se pudo descifrar firma de asistente:", miembroRecordId);
            firma = null;
          }
        }
      }

      return {
        id: r.id,
        recordId: miembroRecordId,
        asistio: !!r.fields[FA.ASISTIO],
        firma,
        fechaFirma: (r.fields[FA.FECHA_FIRMA] as string) || null,
        observaciones: (r.fields[FA.OBSERVACIONES] as string) || null,
        nombre: miembro?.nombre,
        cedula: miembro?.cedula,
        cargo: miembro?.cargo,
        rol: miembro?.rol,
      };
    });
  } catch (e) {
    console.error("[comites] error resolviendo asistencias:", e);
    return [];
  }
}


// ══════════════════════════════════════════════════════════
// CAPACITACIONES (Programación) — tabla EXISTENTE (solo lectura)
// ══════════════════════════════════════════════════════════
async function fetchCapacitacionesByRecordIds(
  ids: string[]
): Promise<Map<string, { tema: string; fechaEjecucion: string | null }>> {
  if (!ids.length) return new Map();
  // No conocemos los field IDs de Programación Capacitaciones a este nivel,
  // así que pedimos sin returnFieldsByFieldId y heurísticamente extraemos
  // el primer campo string como tema. Si más adelante se quieren field IDs
  // específicos, agregar PROG_CAPACITACIONES_*_FIELD al .env.
  const formula = encodeURIComponent(
    `OR(${ids.map((id) => `RECORD_ID()='${id}'`).join(",")})`
  );
  const url = `${getSGSSTUrl(airtableSGSSTConfig.programacionCapacitacionesTableId)}?filterByFormula=${formula}&pageSize=100`;
  try {
    const data = await airtableFetch<AirtableResponse>(url);
    const map = new Map<string, { tema: string; fechaEjecucion: string | null }>();
    for (const r of data.records) {
      // Buscar el primer campo string como tema (heurístico)
      let tema = "";
      let fecha: string | null = null;
      for (const v of Object.values(r.fields)) {
        if (typeof v === "string" && !tema && v.length > 0 && v.length < 200) {
          tema = v;
          break;
        }
      }
      for (const [k, v] of Object.entries(r.fields)) {
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
          fecha = v;
          if (k.toLowerCase().includes("ejec")) break;
        }
      }
      map.set(r.id, { tema, fechaEjecucion: fecha });
    }
    return map;
  } catch {
    return new Map();
  }
}

// ══════════════════════════════════════════════════════════
// MAPPER cabecera Airtable → dominio
// ══════════════════════════════════════════════════════════
function mapCabeceraToDomain(
  comite: ComiteTipo,
  rec: AirtableRecord
): ActaCompleta {
  const cfg = getCabeceraCfg(comite);
  const F = cfg.cabeceraFields;
  const f = rec.fields;
  const base = {
    id: rec.id,
    idActa: (f[F.ID] as string) || "",
    numeroActa: (f[F.NUMERO_ACTA] as string) || "",
    mesEvaluado: (f[F.MES_EVALUADO] as string) || "",
    fechaReunion: (f[F.FECHA_REUNION] as string) || "",
    horaInicio: (f[F.HORA_INICIO] as string) || "",
    horaCierre: (f[F.HORA_CIERRE] as string) || "",
    lugar: (f[F.LUGAR] as string) || "",
    estado: ((f[F.ESTADO] as string) || "borrador") as "borrador" | "firmada",
    firmaPresidente: (f[F.FIRMA_PRESIDENTE] as string) || null,
    firmaSecretario:
      (f[(comite === "COCOLAB" ? F.FIRMA_SECRETARIA : F.FIRMA_SECRETARIO) as string] as string) ||
      null,
    urlDocumento: (f[F.URL_DOCUMENTO] as string) || null,
    fechaExportacion: (f[F.FECHA_EXPORTACION] as string) || null,
    createdAt: (f[F.CREATED_AT] as string) || rec.createdTime,
    updatedAt: (f[F.UPDATED_AT] as string) || undefined,
  };
  if (comite === "COPASST") {
    return {
      ...base,
      comite: "COPASST",
      accidentesPresentados: !!f[F.ACCIDENTES_PRESENTADOS],
      accidentesDetalle: (f[F.ACCIDENTES_DETALLE] as string) || null,
      incidentesPresentados: !!f[F.INCIDENTES_PRESENTADOS],
      incidentesDetalle: (f[F.INCIDENTES_DETALLE] as string) || null,
      novedadesAdministrativas:
        (f[F.NOVEDADES_ADMINISTRATIVAS] as string) || null,
      asistentes: [],
      condicionesInseguras: [],
      capacitaciones: [],
      compromisos: [],
    };
  }
  return {
    ...base,
    comite: "COCOLAB",
    quejasAcoso: !!f[F.QUEJAS_ACOSO],
    quejasAcosoDetalle: (f[F.QUEJAS_ACOSO_DETALLE] as string) || null,
    conflictosLaborales: !!f[F.CONFLICTOS_LABORALES],
    conflictosLaboralesDetalle: (f[F.CONFLICTOS_DETALLE] as string) || null,
    asistentes: [],
    accionesPreventivas: [],
    compromisos: [],
  };
}

type ActaPayloadCabecera = Partial<ActaCopasst> & Partial<ActaCocolab>;

function cabeceraFieldsFromDomain(
  comite: ComiteTipo,
  acta: ActaPayloadCabecera
): Record<string, unknown> {
  const cfg = getCabeceraCfg(comite);
  const F = cfg.cabeceraFields;
  const out: Record<string, unknown> = {};
  if (acta.idActa !== undefined) out[F.ID] = acta.idActa;
  if (acta.numeroActa !== undefined) out[F.NUMERO_ACTA] = acta.numeroActa;
  if (acta.mesEvaluado !== undefined) out[F.MES_EVALUADO] = acta.mesEvaluado;
  if (acta.fechaReunion !== undefined) out[F.FECHA_REUNION] = acta.fechaReunion;
  if (acta.horaInicio !== undefined) out[F.HORA_INICIO] = acta.horaInicio;
  if (acta.horaCierre !== undefined) out[F.HORA_CIERRE] = acta.horaCierre;
  if (acta.lugar !== undefined) out[F.LUGAR] = acta.lugar;
  if (acta.estado !== undefined) out[F.ESTADO] = acta.estado;
  if (comite === "COPASST") {
    if (acta.accidentesPresentados !== undefined)
      out[F.ACCIDENTES_PRESENTADOS] = acta.accidentesPresentados;
    if (acta.accidentesDetalle !== undefined)
      out[F.ACCIDENTES_DETALLE] = acta.accidentesDetalle ?? "";
    if (acta.incidentesPresentados !== undefined)
      out[F.INCIDENTES_PRESENTADOS] = acta.incidentesPresentados;
    if (acta.incidentesDetalle !== undefined)
      out[F.INCIDENTES_DETALLE] = acta.incidentesDetalle ?? "";
    if (acta.novedadesAdministrativas !== undefined)
      out[F.NOVEDADES_ADMINISTRATIVAS] = acta.novedadesAdministrativas ?? "";
  } else {
    if (acta.quejasAcoso !== undefined) out[F.QUEJAS_ACOSO] = acta.quejasAcoso;
    if (acta.quejasAcosoDetalle !== undefined)
      out[F.QUEJAS_ACOSO_DETALLE] = acta.quejasAcosoDetalle ?? "";
    if (acta.conflictosLaborales !== undefined)
      out[F.CONFLICTOS_LABORALES] = acta.conflictosLaborales;
    if (acta.conflictosLaboralesDetalle !== undefined)
      out[F.CONFLICTOS_DETALLE] = acta.conflictosLaboralesDetalle ?? "";
  }
  return out;
}

// ══════════════════════════════════════════════════════════
// API pública del repositorio
// ══════════════════════════════════════════════════════════
export interface ListarFiltros {
  anio?: number;
  mes?: number;
  estado?: "borrador" | "firmada";
  pageSize?: number;
}

export async function listarActas(
  comite: ComiteTipo,
  filtros: ListarFiltros = {}
): Promise<ActaCompleta[]> {
  const cfg = getCabeceraCfg(comite);
  const F = cfg.cabeceraFields;
  const filters: string[] = [];
  if (filtros.estado) filters.push(`{${F.ESTADO}} = '${filtros.estado}'`);
  if (filtros.anio) filters.push(`YEAR({${F.FECHA_REUNION}}) = ${filtros.anio}`);
  if (filtros.mes) filters.push(`MONTH({${F.FECHA_REUNION}}) = ${filtros.mes}`);
  const params = new URLSearchParams({
    "sort[0][field]": F.FECHA_REUNION,
    "sort[0][direction]": "desc",
    pageSize: String(filtros.pageSize || 50),
    returnFieldsByFieldId: "true",
  });
  if (filters.length) {
    params.set(
      "filterByFormula",
      filters.length === 1 ? filters[0] : `AND(${filters.join(",")})`
    );
  }
  const data = await airtableFetch<AirtableResponse>(
    `${getSGSSTUrl(cfg.cabeceraTableId)}?${params}`
  );
  return data.records.map((r) => mapCabeceraToDomain(comite, r));
}

export async function obtenerActaPorId(
  comite: ComiteTipo,
  idActa: string
): Promise<ActaCompleta | null> {
  const cfg = getCabeceraCfg(comite);
  const F = cfg.cabeceraFields;
  const formula = encodeURIComponent(
    `{${F.ID}} = '${escapeFormulaValue(idActa)}'`
  );
  const data = await airtableFetch<AirtableResponse>(
    `${getSGSSTUrl(cfg.cabeceraTableId)}?filterByFormula=${formula}&returnFieldsByFieldId=true`
  );
  if (data.records.length === 0) return null;
  const rec = data.records[0];
  const recId = rec.id;
  const acta = mapCabeceraToDomain(comite, rec);

  // Resolver asistentes (desde tabla intermedia asistencia_comites)
  // ARRAYJOIN en Airtable devuelve el valor del campo primario (idActa) no el recordId interno.
  const actaTextId = acta.idActa || recId;
  try {
    acta.asistentes = await fetchAsistenciasByActa(comite, actaTextId);
  } catch (e) {
    console.error("[comites] error resolviendo asistentes:", e);
  }

  // Resolver compromisos (compartido)
  const compromisosIds = (rec.fields[F.COMPROMISOS_LINK] as string[]) || [];
  if (compromisosIds.length) {
    try {
      const FC = airtableSGSSTConfig.compromisosFields;
      const recs = await fetchRecordsByIds(
        airtableSGSSTConfig.compromisosTableId,
        compromisosIds
      );
      acta.compromisos = recs.map((r) => ({
        id: r.id,
        compromiso: (r.fields[FC.COMPROMISO] as string) || "",
        responsable: (r.fields[FC.RESPONSABLE] as string) || "",
        fechaLimite: (r.fields[FC.FECHA_LIMITE] as string) || "",
        cumplido:
          r.fields[FC.CUMPLIDO] === undefined ? null : !!r.fields[FC.CUMPLIDO],
      }));
    } catch (e) {
      console.error("[comites] error resolviendo compromisos:", e);
    }
  }

  if (comite === "COPASST") {
    const a = acta as ActaCopasst;

    // Condiciones inseguras (tabla propia)
    const condicionesIds = (rec.fields[F.CONDICIONES_LINK] as string[]) || [];
    if (condicionesIds.length) {
      try {
        const FC = airtableSGSSTConfig.copasstCondicionesFields;
        const recs = await fetchRecordsByIds(
          airtableSGSSTConfig.copasstCondicionesTableId,
          condicionesIds
        );
        a.condicionesInseguras = recs.map((r) => ({
          id: r.id,
          descripcion: (r.fields[FC.DESCRIPCION] as string) || "",
          resultado:
            (r.fields[FC.RESULTADO] as ActaCopasst["condicionesInseguras"][number]["resultado"]) ||
            "ok",
          observacion: (r.fields[FC.OBSERVACION] as string) || null,
        }));
      } catch (e) {
        console.error("[comites] error resolviendo condiciones:", e);
      }
    }

    // Capacitaciones (Programación Capacitaciones — solo IDs en cabecera)
    const capIds = (rec.fields[F.CAPACITACIONES_PROG_LINK] as string[]) || [];
    if (capIds.length) {
      try {
        const map = await fetchCapacitacionesByRecordIds(capIds);
        a.capacitaciones = capIds.map((rid): CapacitacionRef => {
          const m = map.get(rid);
          return {
            recordId: rid,
            tema: m?.tema || "",
            fechaEjecucion: m?.fechaEjecucion || null,
          };
        });
      } catch (e) {
        console.error("[comites] error resolviendo capacitaciones:", e);
      }
    }
  } else {
    const a = acta as ActaCocolab;
    const accionesIds = (rec.fields[F.ACCIONES_LINK] as string[]) || [];
    if (accionesIds.length) {
      try {
        const FC = airtableSGSSTConfig.cocolabAccionesFields;
        const recs = await fetchRecordsByIds(
          airtableSGSSTConfig.cocolabAccionesTableId,
          accionesIds
        );
        a.accionesPreventivas = recs.map((r) => ({
          id: r.id,
          categoria:
            (r.fields[FC.CATEGORIA] as ActaCocolab["accionesPreventivas"][number]["categoria"]) ||
            "otro",
          descripcion: (r.fields[FC.DESCRIPCION] as string) || "",
        }));
      } catch (e) {
        console.error("[comites] error resolviendo acciones:", e);
      }
    }
  }

  return acta;
}

// ══════════════════════════════════════════════════════════
// CREAR / ACTUALIZAR ACTA
// ══════════════════════════════════════════════════════════
export interface CrearActaPayload {
  numeroActa?: string;
  mesEvaluado: string;
  fechaReunion: string;
  horaInicio: string;
  horaCierre: string;
  lugar: string;
  // Asistentes: formato legacy (array de recordId)
  asistentesRecordIds?: string[];
  // Asistentes: formato nuevo (con firmas incluidas)
  asistentesConFirmas?: Array<{
    recordId: string;
    asistio: boolean;
    firma?: string | null;
  }>;
  // Compromisos (texto libre, se insertan en tabla compartida)
  compromisos?: CompromisoActa[];
  // COPASST
  accidentesPresentados?: boolean;
  accidentesDetalle?: string;
  incidentesPresentados?: boolean;
  incidentesDetalle?: string;
  novedadesAdministrativas?: string;
  condicionesInseguras?: ActaCopasst["condicionesInseguras"];
  // Capacitaciones: array de recordId de Programación Capacitaciones
  capacitacionesRecordIds?: string[];
  // COCOLAB
  quejasAcoso?: boolean;
  quejasAcosoDetalle?: string;
  conflictosLaborales?: boolean;
  conflictosLaboralesDetalle?: string;
  accionesPreventivas?: ActaCocolab["accionesPreventivas"];
}

export async function crearActa(
  comite: ComiteTipo,
  payload: CrearActaPayload
): Promise<{ id: string; idActa: string; recordId: string; numeroActa: string }> {
  const cfg = getCabeceraCfg(comite);
  const F = cfg.cabeceraFields;
  const idActa = generarIdActa(comite);
  const numeroActa = payload.numeroActa || (await siguienteNumeroActa(comite));

  // 1) Insertar hijos primero (necesitamos sus recordIds para los multipleRecordLinks)
  const condicionesRecIds: string[] =
    comite === "COPASST" && payload.condicionesInseguras?.length
      ? (
          await postBatched(
            airtableSGSSTConfig.copasstCondicionesTableId,
            payload.condicionesInseguras.map((c) => ({
              fields: {
                [airtableSGSSTConfig.copasstCondicionesFields.ID]: `CND-${crypto
                  .randomBytes(4)
                  .toString("hex")}`,
                [airtableSGSSTConfig.copasstCondicionesFields.DESCRIPCION]:
                  c.descripcion,
                [airtableSGSSTConfig.copasstCondicionesFields.RESULTADO]:
                  c.resultado,
                [airtableSGSSTConfig.copasstCondicionesFields.OBSERVACION]:
                  c.observacion ?? "",
              },
            }))
          )
        ).map((r) => r.id)
      : [];

  const accionesRecIds: string[] =
    comite === "COCOLAB" && payload.accionesPreventivas?.length
      ? (
          await postBatched(
            airtableSGSSTConfig.cocolabAccionesTableId,
            payload.accionesPreventivas.map((a) => ({
              fields: {
                [airtableSGSSTConfig.cocolabAccionesFields.ID]: `APR-${crypto
                  .randomBytes(4)
                  .toString("hex")}`,
                [airtableSGSSTConfig.cocolabAccionesFields.CATEGORIA]:
                  a.categoria,
                [airtableSGSSTConfig.cocolabAccionesFields.DESCRIPCION]:
                  a.descripcion,
              },
            }))
          )
        ).map((r) => r.id)
      : [];

  const compromisosRecIds: string[] = payload.compromisos?.length
    ? (
        await postBatched(
          airtableSGSSTConfig.compromisosTableId,
          payload.compromisos.map((c) => ({
            fields: {
              [airtableSGSSTConfig.compromisosFields.ID]: `CMP-${crypto
                .randomBytes(4)
                .toString("hex")}`,
              [airtableSGSSTConfig.compromisosFields.COMITE]: comite,
              [airtableSGSSTConfig.compromisosFields.COMPROMISO]: c.compromiso,
              [airtableSGSSTConfig.compromisosFields.RESPONSABLE]: c.responsable,
              [airtableSGSSTConfig.compromisosFields.FECHA_LIMITE]:
                c.fechaLimite,
              [airtableSGSSTConfig.compromisosFields.CUMPLIDO]:
                c.cumplido ?? false,
            },
          }))
        )
      ).map((r) => r.id)
    : [];

  // 2) Cabecera (con todos los multipleRecordLinks)
  const cabeceraFields: Record<string, unknown> = {
    [F.ID]: idActa,
    ...cabeceraFieldsFromDomain(comite, {
      ...payload,
      idActa,
      numeroActa,
      estado: "borrador",
    } as ActaPayloadCabecera),
    [F.COMPROMISOS_LINK]: compromisosRecIds,
    [F.CREATED_AT]: new Date().toISOString(),
    [F.UPDATED_AT]: new Date().toISOString(),
  };
  if (comite === "COPASST") {
    cabeceraFields[F.CONDICIONES_LINK] = condicionesRecIds;
    cabeceraFields[F.CAPACITACIONES_PROG_LINK] =
      payload.capacitacionesRecordIds || [];
  } else {
    cabeceraFields[F.ACCIONES_LINK] = accionesRecIds;
  }

  const created = await postBatched(cfg.cabeceraTableId, [
    { fields: cabeceraFields },
  ]);
  const recordId = created[0].id;

  // 3) Insertar registros de asistencia (tabla intermedia)
  const asistentes = payload.asistentesConFirmas ||
    (payload.asistentesRecordIds?.map(id => ({ recordId: id, asistio: true, firma: null })) || []);

  if (asistentes.length) {
    const FA = airtableSGSSTConfig.asistenciaComitesFields;
    const timestamp = new Date().toISOString();

    const asistenciaRecords = asistentes.map((ast) => {
      const fields: Record<string, unknown> = {
        [FA.ID_ASISTENCIA]: `AST-${comite}-${crypto.randomBytes(4).toString("hex")}`,
        [comite === "COPASST" ? FA.ACTA_COPASST_LINK : FA.ACTA_COCOLAB_LINK]: [recordId],
        [FA.MIEMBRO_LINK]: [ast.recordId],
        [FA.COMITE]: comite,
        [FA.ASISTIO]: ast.asistio,
      };

      // Si tiene firma, agregarla con timestamp
      if (ast.firma) {
        fields[FA.FIRMA] = ast.firma;
        fields[FA.FECHA_FIRMA] = timestamp;
      }

      return { fields };
    });

    await postBatched(
      airtableSGSSTConfig.asistenciaComitesTableId,
      asistenciaRecords
    );
  }

  // 4) Backfill: actualizar el campo COMITE en compromisos y crear back-link al acta
  if (compromisosRecIds.length) {
    const FC = airtableSGSSTConfig.compromisosFields;
    await airtableFetch(
      getSGSSTUrl(airtableSGSSTConfig.compromisosTableId),
      {
        method: "PATCH",
        body: JSON.stringify({
          records: compromisosRecIds.map((id) => ({
            id,
            fields: {
              [comite === "COPASST"
                ? FC.ACTA_COPASST_LINK
                : FC.ACTA_COCOLAB_LINK]: [recordId],
            },
          })),
          typecast: true,
        }),
      }
    );
  }

  // idActa generado no se persiste cuando F.ID === F.NUMERO_ACTA (mismo field en Airtable).
  // Usar numeroActa como identificador de ruta, que sí queda almacenado.
  return { id: numeroActa, idActa: numeroActa, recordId, numeroActa };
}

export async function actualizarActa(
  comite: ComiteTipo,
  idActa: string,
  payload: Partial<CrearActaPayload>
): Promise<void> {
  const cfg = getCabeceraCfg(comite);
  const F = cfg.cabeceraFields;
  const existing = await obtenerActaPorId(comite, idActa);
  if (!existing) throw new Error("Acta no encontrada");
  if (existing.estado === "firmada") {
    throw new Error("No se puede modificar un acta firmada");
  }
  const recordId = existing.id!;

  const cabeceraFields: Record<string, unknown> = {
    ...cabeceraFieldsFromDomain(comite, payload as ActaPayloadCabecera),
    [F.UPDATED_AT]: new Date().toISOString(),
  };

  // Actualizar asistentes (reemplazar registros en asistencia_comites)
  if (payload.asistentesRecordIds) {
    const FA = airtableSGSSTConfig.asistenciaComitesFields;

    // 1) Eliminar registros antiguos de asistencia
    const oldAsistencias = await fetchAsistenciasByActa(comite, existing.idActa || recordId);
    const oldIds = oldAsistencias.map((a) => a.id!).filter(Boolean);
    if (oldIds.length) {
      await deleteRecords(airtableSGSSTConfig.asistenciaComitesTableId, oldIds);
    }

    // 2) Insertar nuevos registros
    if (payload.asistentesRecordIds.length) {
      const asistenciaRecords = payload.asistentesRecordIds.map((miembroId) => ({
        fields: {
          [FA.ID_ASISTENCIA]: `AST-${comite}-${crypto.randomBytes(4).toString("hex")}`,
          [comite === "COPASST"
            ? FA.ACTA_COPASST_LINK
            : FA.ACTA_COCOLAB_LINK]: [recordId],
          [FA.MIEMBRO_LINK]: [miembroId],
          [FA.COMITE]: comite,
          [FA.ASISTIO]: true,
          [FA.FIRMA]: "",
          [FA.FECHA_FIRMA]: "",
          [FA.OBSERVACIONES]: "",
        },
      }));
      await postBatched(
        airtableSGSSTConfig.asistenciaComitesTableId,
        asistenciaRecords
      );
    }
  }

  // Reemplazar condiciones (eliminar previas + insertar nuevas)
  if (comite === "COPASST" && payload.condicionesInseguras) {
    const a = existing as ActaCopasst;
    const oldIds = a.condicionesInseguras.map((c) => c.id!).filter(Boolean);
    if (oldIds.length)
      await deleteRecords(airtableSGSSTConfig.copasstCondicionesTableId, oldIds);
    const newIds = payload.condicionesInseguras.length
      ? (
          await postBatched(
            airtableSGSSTConfig.copasstCondicionesTableId,
            payload.condicionesInseguras.map((c) => ({
              fields: {
                [airtableSGSSTConfig.copasstCondicionesFields.ID]: `CND-${crypto
                  .randomBytes(4)
                  .toString("hex")}`,
                [airtableSGSSTConfig.copasstCondicionesFields.DESCRIPCION]:
                  c.descripcion,
                [airtableSGSSTConfig.copasstCondicionesFields.RESULTADO]:
                  c.resultado,
                [airtableSGSSTConfig.copasstCondicionesFields.OBSERVACION]:
                  c.observacion ?? "",
              },
            }))
          )
        ).map((r) => r.id)
      : [];
    cabeceraFields[F.CONDICIONES_LINK] = newIds;
  }

  if (comite === "COPASST" && payload.capacitacionesRecordIds) {
    cabeceraFields[F.CAPACITACIONES_PROG_LINK] = payload.capacitacionesRecordIds;
  }

  if (comite === "COCOLAB" && payload.accionesPreventivas) {
    const a = existing as ActaCocolab;
    const oldIds = a.accionesPreventivas.map((c) => c.id!).filter(Boolean);
    if (oldIds.length)
      await deleteRecords(airtableSGSSTConfig.cocolabAccionesTableId, oldIds);
    const newIds = payload.accionesPreventivas.length
      ? (
          await postBatched(
            airtableSGSSTConfig.cocolabAccionesTableId,
            payload.accionesPreventivas.map((a) => ({
              fields: {
                [airtableSGSSTConfig.cocolabAccionesFields.ID]: `APR-${crypto
                  .randomBytes(4)
                  .toString("hex")}`,
                [airtableSGSSTConfig.cocolabAccionesFields.CATEGORIA]:
                  a.categoria,
                [airtableSGSSTConfig.cocolabAccionesFields.DESCRIPCION]:
                  a.descripcion,
              },
            }))
          )
        ).map((r) => r.id)
      : [];
    cabeceraFields[F.ACCIONES_LINK] = newIds;
  }

  if (payload.compromisos) {
    const oldIds = existing.compromisos.map((c) => c.id!).filter(Boolean);
    if (oldIds.length)
      await deleteRecords(airtableSGSSTConfig.compromisosTableId, oldIds);
    const FC = airtableSGSSTConfig.compromisosFields;
    const newIds = payload.compromisos.length
      ? (
          await postBatched(
            airtableSGSSTConfig.compromisosTableId,
            payload.compromisos.map((c) => ({
              fields: {
                [FC.ID]: `CMP-${crypto.randomBytes(4).toString("hex")}`,
                [FC.COMITE]: comite,
                [FC.COMPROMISO]: c.compromiso,
                [FC.RESPONSABLE]: c.responsable,
                [FC.FECHA_LIMITE]: c.fechaLimite,
                [FC.CUMPLIDO]: c.cumplido ?? false,
                [comite === "COPASST"
                  ? FC.ACTA_COPASST_LINK
                  : FC.ACTA_COCOLAB_LINK]: [recordId],
              },
            }))
          )
        ).map((r) => r.id)
      : [];
    cabeceraFields[F.COMPROMISOS_LINK] = newIds;
  }

  await airtableFetch(getSGSSTUrl(cfg.cabeceraTableId), {
    method: "PATCH",
    body: JSON.stringify({
      records: [{ id: recordId, fields: cleanFields(cabeceraFields) }],
      typecast: true,
    }),
  });
}

// ══════════════════════════════════════════════════════════
// FIRMA Y URL DOCUMENTO
// ══════════════════════════════════════════════════════════
export async function marcarActaFirmada(
  comite: ComiteTipo,
  idActa: string,
  firmaPresidenteEnc: string,
  firmaSecretarioEnc: string
): Promise<void> {
  const cfg = getCabeceraCfg(comite);
  const F = cfg.cabeceraFields;
  const acta = await obtenerActaPorId(comite, idActa);
  if (!acta) throw new Error("Acta no encontrada");
  await airtableFetch(getSGSSTUrl(cfg.cabeceraTableId), {
    method: "PATCH",
    body: JSON.stringify({
      records: [
        {
          id: acta.id,
          fields: cleanFields({
            [F.ESTADO]: "firmada",
            [F.FIRMA_PRESIDENTE]: firmaPresidenteEnc,
            [(comite === "COCOLAB"
              ? F.FIRMA_SECRETARIA
              : F.FIRMA_SECRETARIO) as string]: firmaSecretarioEnc,
            [F.UPDATED_AT]: new Date().toISOString(),
          }),
        },
      ],
      typecast: true,
    }),
  });
}

export async function actualizarUrlDocumento(
  comite: ComiteTipo,
  idActa: string,
  url: string
): Promise<void> {
  const cfg = getCabeceraCfg(comite);
  const F = cfg.cabeceraFields;
  const acta = await obtenerActaPorId(comite, idActa);
  if (!acta) throw new Error("Acta no encontrada");
  await airtableFetch(getSGSSTUrl(cfg.cabeceraTableId), {
    method: "PATCH",
    body: JSON.stringify({
      records: [
        {
          id: acta.id,
          fields: cleanFields({
            [F.URL_DOCUMENTO]: url,
            [F.FECHA_EXPORTACION]: new Date().toISOString(),
          }),
        },
      ],
    }),
  });
}

// ══════════════════════════════════════════════════════════
// FIRMAR ASISTENCIA INDIVIDUAL
// ══════════════════════════════════════════════════════════
export async function firmarAsistencia(
  comite: ComiteTipo,
  idActa: string,
  miembroRecordId: string,
  firmaDataUrl: string
): Promise<void> {
  const acta = await obtenerActaPorId(comite, idActa);
  if (!acta) throw new Error("Acta no encontrada");
  if (acta.estado === "firmada") {
    throw new Error("No se puede firmar asistencia en acta ya firmada");
  }

  // Buscar registro de asistencia
  const asistencia = acta.asistentes.find(
    (a) => a.recordId === miembroRecordId
  );
  if (!asistencia || !asistencia.id) {
    throw new Error("Asistente no encontrado en el acta");
  }

  // Validar que tiene asistencia marcada
  if (!asistencia.asistio) {
    throw new Error("Debe marcar asistencia antes de firmar");
  }

  // Encriptar firma antes de almacenar
  const firmaEncriptada = encryptAES(firmaDataUrl);

  // Actualizar firma
  const FA = airtableSGSSTConfig.asistenciaComitesFields;
  await airtableFetch(
    getSGSSTUrl(airtableSGSSTConfig.asistenciaComitesTableId),
    {
      method: "PATCH",
      body: JSON.stringify({
        records: [
          {
            id: asistencia.id,
            fields: cleanFields({
              [FA.FIRMA]: firmaEncriptada,
              [FA.FECHA_FIRMA]: new Date().toISOString(),
              [FA.ASISTIO]: true, // Confirmar asistencia al firmar
            }),
          },
        ],
        typecast: true,
      }),
    }
  );
}

// ══════════════════════════════════════════════════════════
// Compromisos pendientes (tabla compartida, filtro por comité)
// ══════════════════════════════════════════════════════════
export async function listarCompromisosPendientes(
  comite: ComiteTipo
): Promise<Array<CompromisoActa & { actaRecordId: string }>> {
  const FC = airtableSGSSTConfig.compromisosFields;
  const formula = `AND({${FC.COMITE}} = '${comite}', OR({${FC.CUMPLIDO}} = FALSE(), {${FC.CUMPLIDO}} = BLANK()))`;
  const params = new URLSearchParams({
    filterByFormula: formula,
    pageSize: "100",
    returnFieldsByFieldId: "true",
    "sort[0][field]": FC.FECHA_LIMITE,
    "sort[0][direction]": "asc",
  });
  const data = await airtableFetch<AirtableResponse>(
    `${getSGSSTUrl(airtableSGSSTConfig.compromisosTableId)}?${params}`
  );
  return data.records.map((r) => {
    const linkField =
      comite === "COPASST" ? FC.ACTA_COPASST_LINK : FC.ACTA_COCOLAB_LINK;
    const linked = (r.fields[linkField] as string[]) || [];
    return {
      id: r.id,
      compromiso: (r.fields[FC.COMPROMISO] as string) || "",
      responsable: (r.fields[FC.RESPONSABLE] as string) || "",
      fechaLimite: (r.fields[FC.FECHA_LIMITE] as string) || "",
      cumplido:
        r.fields[FC.CUMPLIDO] === undefined ? null : !!r.fields[FC.CUMPLIDO],
      actaRecordId: linked[0] || "",
    };
  });
}
