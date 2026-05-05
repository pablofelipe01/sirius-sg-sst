import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

// ══════════════════════════════════════════════════════════
// AES-256-CBC Encryption (reutilizado de módulo equipos)
// ══════════════════════════════════════════════════════════
const AES_SECRET = process.env.AES_SIGNATURE_SECRET || "";

function encryptAES(plaintext: string): string {
  const key = crypto.createHash("sha256").update(AES_SECRET).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  return iv.toString("base64") + ":" + encrypted;
}

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
type CondicionCriterio = "Bueno" | "Malo" | "NA" | null;
type TipoArea = "Laboratorio" | "Pirólisis" | "Bodega" | "Administrativa" | "Guaicaramo";

interface CriterioPayload {
  id: string; // ID temporal del frontend (ej: "crit-0")
  categoria: string;
  criterio: string;
  condicion: CondicionCriterio;
  observacion: string;
}

interface AccionCorrectivaPayload {
  descripcion: string;
  tipo: "Preventiva" | "Correctiva" | "Mejora";
  responsable: string; // ID_EMPLEADO_CORE
  fechaPropuestaCierre: string;
  criterioRelacionado: string; // ID del criterio (CriterioEvaluado.id → detalle record)
}

interface ResponsablePayload {
  tipo: "Responsable" | "COPASST" | "Responsable Área";
  nombre: string;
  cedula: string;
  cargo: string;
  firma: string; // Base64 data URL
}

interface InspeccionAreaPayload {
  fechaInspeccion: string;
  inspector: string;
  area: TipoArea;
  observacionesGenerales: string;
  criterios: CriterioPayload[];
  accionesCorrectivas: AccionCorrectivaPayload[];
  responsables: ResponsablePayload[];
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
}

function generateInspeccionId(area: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  const areaPrefix = area.substring(0, 3).toUpperCase();
  return `INSPA-${areaPrefix}-${y}${m}${d}-${rnd}`;
}

// ══════════════════════════════════════════════════════════
// GET /api/inspecciones-areas
// Lista las inspecciones de áreas con filtros opcionales
// ?responsables=true → Devuelve lista de responsables SST para dropdown
// ══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // ── Endpoint para obtener responsables SST ──
    if (searchParams.get("responsables") === "true") {
      const { miembrosComitesTableId, miembrosComitesFields: mF } = airtableSGSSTConfig;
      // Obtener miembros activos del COPASST + Responsables SG-SST
      const formula = encodeURIComponent(
        `AND({${mF.ESTADO}}="Activo", OR({${mF.COMITE}}="COPASST", FIND("Responsable SG-SST", {${mF.CARGO}})>0))`
      );
      const mbrUrl = `${getSGSSTUrl(miembrosComitesTableId)}?returnFieldsByFieldId=true&filterByFormula=${formula}&fields[]=${mF.ID_EMPLEADO}&fields[]=${mF.NOMBRE}&fields[]=${mF.DOCUMENTO}&fields[]=${mF.CARGO}`;
      
      const mbrRes = await fetch(mbrUrl, {
        headers: getSGSSTHeaders(),
        cache: "no-store",
      });

      if (!mbrRes.ok) {
        return NextResponse.json(
          { success: false, message: "Error al consultar responsables SST" },
          { status: 500 }
        );
      }

      const mbrData = await mbrRes.json();
      const responsables = (mbrData.records || []).map((r: AirtableRecord) => ({
        id: r.fields[mF.ID_EMPLEADO] as string || r.id,
        nombre: r.fields[mF.NOMBRE] as string || "Sin nombre",
        cedula: r.fields[mF.DOCUMENTO] as string || "",
        cargo: r.fields[mF.CARGO] as string || "",
      }));

      // Ordenar alfabéticamente
      responsables.sort((a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre));

      return NextResponse.json({
        success: true,
        responsables,
      });
    }

    const area = searchParams.get("area");
    const estado = searchParams.get("estado");

    const { inspeccionesAreasFields } = airtableSGSSTConfig;
    const url = getSGSSTUrl(airtableSGSSTConfig.inspeccionesAreasTableId);

    // Construir filtro
    let filterFormula = "";
    const filters: string[] = [];

    if (area && area !== "Todas") {
      filters.push(`{${inspeccionesAreasFields.AREA}} = '${area}'`);
    }
    if (estado && estado !== "Todos") {
      filters.push(`{${inspeccionesAreasFields.ESTADO}} = '${estado}'`);
    }

    if (filters.length > 0) {
      filterFormula = filters.length === 1 ? filters[0] : `AND(${filters.join(", ")})`;
    }

    const params = new URLSearchParams({
      "sort[0][field]": inspeccionesAreasFields.FECHA,
      "sort[0][direction]": "desc",
      maxRecords: "100",
      returnFieldsByFieldId: "true",
    });

    if (filterFormula) {
      params.set("filterByFormula", filterFormula);
    }

    const response = await fetch(`${url}?${params.toString()}`, {
      method: "GET",
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error listando inspecciones áreas:", errorText);
      return NextResponse.json(
        { success: false, message: "Error al consultar inspecciones" },
        { status: 500 }
      );
    }

    const data: AirtableResponse = await response.json();
    const cabeceraRecordIds = data.records.map((r) => r.id);
    
    // IMPORTANTE: Crear mapas recordId <-> idInspeccion
    // ARRAYJOIN en campos de link devuelve el campo primario (idInspeccion), no el recordId
    const recordIdToIdInspeccion: Record<string, string> = {};
    const idInspeccionToRecordId: Record<string, string> = {};
    data.records.forEach((r) => {
      const idInsp = r.fields[inspeccionesAreasFields.ID] as string;
      recordIdToIdInspeccion[r.id] = idInsp;
      idInspeccionToRecordId[idInsp] = r.id;
    });
    const cabeceraIdInspecciones = data.records.map((r) => r.fields[inspeccionesAreasFields.ID] as string);

    // ── Obtener detalles (criterios) de todas las inspecciones ──
    const { detalleInspeccionAreasFields, accionesCorrectivasAreasFields, respInspeccionAreasFields } = airtableSGSSTConfig;
    
    // NOTA: Las fórmulas de Airtable requieren NOMBRES de campos, no Field IDs
    // Y ARRAYJOIN devuelve el campo PRIMARIO del registro enlazado, no el record ID
    const FIELD_NAME_INSPECCION_DETALLE = "Inspección";
    const FIELD_NAME_CONDICION = "Condición";
    const FIELD_NAME_INSPECCION_ACCIONES = "Inspección";
    const FIELD_NAME_INSPECCION_RESP = "Inspección";
    
    // Función helper para contar registros por inspección
    // Usa idInspeccion en la fórmula (porque ARRAYJOIN devuelve el campo primario)
    // Pero retorna counts indexados por recordId (para compatibilidad con el resto del código)
    const countByInspeccion = async (tableId: string, linkFieldName: string, linkFieldId: string) => {
      const counts: Record<string, number> = {};
      if (cabeceraIdInspecciones.length === 0) return counts;

      // Consultar todos los detalles que pertenezcan a cualquiera de las inspecciones
      // Usar idInspeccion en la fórmula (lo que ARRAYJOIN devuelve)
      const filterFormula2 = `OR(${cabeceraIdInspecciones.map((idInsp) => `FIND('${idInsp}', ARRAYJOIN({${linkFieldName}})) > 0`).join(", ")})`;
      const detUrl = getSGSSTUrl(tableId);
      const detParams = new URLSearchParams({
        filterByFormula: filterFormula2,
        returnFieldsByFieldId: "true",
        "fields[]": linkFieldId,
      });

      const detRes = await fetch(`${detUrl}?${detParams.toString()}`, {
        headers: getSGSSTHeaders(),
        cache: "no-store",
      });

      if (detRes.ok) {
        const detData: AirtableResponse = await detRes.json();
        detData.records.forEach((r) => {
          // Los links en la respuesta SÍ contienen record IDs
          const links = r.fields[linkFieldId] as string[] || [];
          links.forEach((inspId) => {
            counts[inspId] = (counts[inspId] || 0) + 1;
          });
        });
      }
      return counts;
    };

    // Función para contar criterios por condición (Bueno/Malo/NA)
    const countCriteriosByCondicion = async () => {
      const stats: Record<string, { buenos: number; malos: number; na: number }> = {};
      if (cabeceraIdInspecciones.length === 0) return stats;

      // Usar idInspeccion en la fórmula (lo que ARRAYJOIN devuelve)
      const filterFormula2 = `OR(${cabeceraIdInspecciones.map((idInsp) => `FIND('${idInsp}', ARRAYJOIN({${FIELD_NAME_INSPECCION_DETALLE}})) > 0`).join(", ")})`;
      const detUrl = getSGSSTUrl(airtableSGSSTConfig.detalleInspeccionAreasTableId);
      const detParams = new URLSearchParams({
        filterByFormula: filterFormula2,
        returnFieldsByFieldId: "true",
      });
      // Añadir campos necesarios (Field IDs para la respuesta)
      detParams.append("fields[]", detalleInspeccionAreasFields.INSPECCION_LINK);
      detParams.append("fields[]", detalleInspeccionAreasFields.CONDICION);

      const detRes = await fetch(`${detUrl}?${detParams.toString()}`, {
        headers: getSGSSTHeaders(),
        cache: "no-store",
      });

      if (detRes.ok) {
        const detData: AirtableResponse = await detRes.json();
        detData.records.forEach((r) => {
          // Los links en la respuesta SÍ contienen record IDs
          const links = r.fields[detalleInspeccionAreasFields.INSPECCION_LINK] as string[] || [];
          const condicion = r.fields[detalleInspeccionAreasFields.CONDICION] as string || "";
          links.forEach((inspId) => {
            if (!stats[inspId]) {
              stats[inspId] = { buenos: 0, malos: 0, na: 0 };
            }
            if (condicion === "Bueno") stats[inspId].buenos++;
            else if (condicion === "Malo") stats[inspId].malos++;
            else if (condicion === "NA") stats[inspId].na++;
          });
        });
      }
      return stats;
    };

    // Conteos en paralelo (usando nombres de campos en fórmulas)
    const [criteriosCounts, criteriosStats, accionesCounts, responsablesCounts] = await Promise.all([
      countByInspeccion(
        airtableSGSSTConfig.detalleInspeccionAreasTableId, 
        FIELD_NAME_INSPECCION_DETALLE, 
        detalleInspeccionAreasFields.INSPECCION_LINK
      ),
      countCriteriosByCondicion(),
      countByInspeccion(
        airtableSGSSTConfig.accionesCorrectivasAreasTableId, 
        FIELD_NAME_INSPECCION_ACCIONES, 
        accionesCorrectivasAreasFields.INSPECCION_LINK
      ),
      countByInspeccion(
        airtableSGSSTConfig.respInspeccionAreasTableId, 
        FIELD_NAME_INSPECCION_RESP, 
        respInspeccionAreasFields.INSPECCION_LINK
      ),
    ]);

    const inspecciones = data.records.map((record) => {
      const stats = criteriosStats[record.id] || { buenos: 0, malos: 0, na: 0 };
      const fotoRaw = (record.fields[inspeccionesAreasFields.FOTO_URL] as string) || "";
      const fotoUrls = fotoRaw ? fotoRaw.split(",").map((u: string) => u.trim()).filter(Boolean) : [];
      return {
        id: record.id,
        idInspeccion: record.fields[inspeccionesAreasFields.ID] as string,
        fecha: record.fields[inspeccionesAreasFields.FECHA] as string,
        inspector: record.fields[inspeccionesAreasFields.INSPECTOR] as string,
        area: record.fields[inspeccionesAreasFields.AREA] as string,
        estado: record.fields[inspeccionesAreasFields.ESTADO] as string,
        observaciones: (record.fields[inspeccionesAreasFields.OBSERVACIONES] as string) || "",
        urlDocumento: (record.fields[inspeccionesAreasFields.URL_DOCUMENTO] as string) || null,
        fechaExportacion: (record.fields[inspeccionesAreasFields.FECHA_EXPORTACION] as string) || null,
        fotoUrls,
        cantidadCriterios: criteriosCounts[record.id] || 0,
        criteriosBuenos: stats.buenos,
        criteriosMalos: stats.malos,
        criteriosNA: stats.na,
        cantidadAcciones: accionesCounts[record.id] || 0,
        cantidadResponsables: responsablesCounts[record.id] || 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: inspecciones,
      total: inspecciones.length,
    });
  } catch (error) {
    console.error("Error en GET /api/inspecciones-areas:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-areas
// Guarda una inspección de área
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const payload: InspeccionAreaPayload = await request.json();

    // DEBUG: Log completo del payload recibido
    console.log("[Inspección Áreas POST] Payload recibido:", JSON.stringify({
      fechaInspeccion: payload.fechaInspeccion,
      inspector: payload.inspector,
      area: payload.area,
      criteriosRecibidos: payload.criterios?.length || 0,
      accionesRecibidas: payload.accionesCorrectivas?.length || 0,
      responsablesRecibidos: payload.responsables?.length || 0,
      primerCriterio: payload.criterios?.[0],
    }, null, 2));

    // Validaciones
    if (!payload.fechaInspeccion) {
      return NextResponse.json(
        { success: false, message: "La fecha de inspección es requerida" },
        { status: 400 }
      );
    }
    if (!payload.inspector) {
      return NextResponse.json(
        { success: false, message: "El inspector es requerido" },
        { status: 400 }
      );
    }
    if (!payload.area) {
      return NextResponse.json(
        { success: false, message: "El área es requerida" },
        { status: 400 }
      );
    }
    if (!payload.criterios || payload.criterios.length === 0) {
      return NextResponse.json(
        { success: false, message: "Debe incluir al menos un criterio evaluado" },
        { status: 400 }
      );
    }

    const {
      inspeccionesAreasFields,
      detalleInspeccionAreasFields,
      respInspeccionAreasFields,
      accionesCorrectivasAreasFields,
    } = airtableSGSSTConfig;

    const inspeccionId = generateInspeccionId(payload.area);

    console.log("Creando inspección de área:", {
      id: inspeccionId,
      fecha: payload.fechaInspeccion,
      area: payload.area,
      inspector: payload.inspector,
      cantidadCriterios: payload.criterios.length,
    });

    // 1. Crear cabecera
    const cabeceraUrl = getSGSSTUrl(airtableSGSSTConfig.inspeccionesAreasTableId);
    const cabeceraResponse = await fetch(cabeceraUrl, {
      method: "POST",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({
        records: [
          {
            fields: {
              [inspeccionesAreasFields.ID]: inspeccionId,
              [inspeccionesAreasFields.FECHA]: payload.fechaInspeccion,
              [inspeccionesAreasFields.INSPECTOR]: payload.inspector,
              [inspeccionesAreasFields.AREA]: payload.area,
              [inspeccionesAreasFields.ESTADO]: "Completado",
              [inspeccionesAreasFields.OBSERVACIONES]: payload.observacionesGenerales || "",
            },
          },
        ],
      }),
    });

    if (!cabeceraResponse.ok) {
      const errorText = await cabeceraResponse.text();
      console.error("Error creando cabecera:", errorText);
      return NextResponse.json(
        { success: false, message: "Error al crear la inspección" },
        { status: 500 }
      );
    }

    const cabeceraData: AirtableResponse = await cabeceraResponse.json();
    const cabeceraRecordId = cabeceraData.records[0].id;

    // 2. Crear detalles (criterios evaluados) en lotes de 10
    const detalleUrl = getSGSSTUrl(airtableSGSSTConfig.detalleInspeccionAreasTableId);
    const criteriosEvaluados = payload.criterios.filter((c) => c.condicion !== null);
    
    console.log("[Inspección Áreas] Criterios a guardar:", criteriosEvaluados.length);
    console.log("[Inspección Áreas] Table ID detalles:", airtableSGSSTConfig.detalleInspeccionAreasTableId);
    console.log("[Inspección Áreas] Field IDs:", {
      ID: detalleInspeccionAreasFields.ID,
      INSPECCION_LINK: detalleInspeccionAreasFields.INSPECCION_LINK,
      CATEGORIA: detalleInspeccionAreasFields.CATEGORIA,
      CRITERIO: detalleInspeccionAreasFields.CRITERIO,
      CONDICION: detalleInspeccionAreasFields.CONDICION,
      OBSERVACION: detalleInspeccionAreasFields.OBSERVACION,
    });
    
    const detalleRecords = criteriosEvaluados.map((c) => ({
      tempId: c.id, // Guardar el ID temporal para mapear después
      fields: {
        [detalleInspeccionAreasFields.ID]: `${inspeccionId}-${crypto.randomBytes(4).toString("hex")}`,
        [detalleInspeccionAreasFields.INSPECCION_LINK]: [cabeceraRecordId],
        [detalleInspeccionAreasFields.CATEGORIA]: c.categoria,
        [detalleInspeccionAreasFields.CRITERIO]: c.criterio,
        [detalleInspeccionAreasFields.CONDICION]: c.condicion!,
        [detalleInspeccionAreasFields.OBSERVACION]: c.observacion || "",
      },
    }));

    // Mapa: tempId del criterio → record ID de Airtable
    const criterioIdMap: Record<string, string> = {};
    for (let i = 0; i < detalleRecords.length; i += 10) {
      const batch = detalleRecords.slice(i, i + 10);
      const requestBody = { records: batch.map(r => ({ fields: r.fields })) };
      
      console.log(`[Inspección Áreas] Enviando lote ${Math.floor(i/10) + 1} con ${batch.length} registros`);
      console.log("[Inspección Áreas] URL:", detalleUrl);
      console.log("[Inspección Áreas] Primer registro del lote:", JSON.stringify(requestBody.records[0], null, 2));
      
      const resp = await fetch(detalleUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify(requestBody),
      });
      
      const responseText = await resp.text();
      console.log("[Inspección Áreas] Respuesta status:", resp.status);
      console.log("[Inspección Áreas] Respuesta body:", responseText);
      
      if (resp.ok) {
        const data: AirtableResponse = JSON.parse(responseText);
        // Mapear cada record creado con su tempId
        data.records.forEach((record, idx) => {
          const originalIndex = i + idx;
          const tempId = detalleRecords[originalIndex].tempId;
          criterioIdMap[tempId] = record.id;
        });
        console.log(`[Inspección Áreas] Detalles creados (lote ${Math.floor(i/10) + 1}):`, batch.length);
      } else {
        console.error("[Inspección Áreas] Error creando detalles - Status:", resp.status);
      }
    }
    console.log("[Inspección Áreas] Mapa criterios:", Object.keys(criterioIdMap).length, "IDs mapeados");

    // Array de IDs creados (para logs)
    const createdDetalleIds = Object.values(criterioIdMap);

    // 3. Crear acciones correctivas/preventivas
    if (payload.accionesCorrectivas && payload.accionesCorrectivas.length > 0) {
      const accionesUrl = getSGSSTUrl(airtableSGSSTConfig.accionesCorrectivasAreasTableId);
      const accionesRecords = payload.accionesCorrectivas.map((a) => {
        const fieldsData: Record<string, unknown> = {
          [accionesCorrectivasAreasFields.ID]: `${inspeccionId}-ACC-${crypto.randomBytes(3).toString("hex")}`,
          [accionesCorrectivasAreasFields.INSPECCION_LINK]: [cabeceraRecordId],
          [accionesCorrectivasAreasFields.DESCRIPCION]: a.descripcion,
          [accionesCorrectivasAreasFields.TIPO]: a.tipo,
          [accionesCorrectivasAreasFields.RESPONSABLE]: a.responsable,
          [accionesCorrectivasAreasFields.FECHA_PROPUESTA]: a.fechaPropuestaCierre,
          [accionesCorrectivasAreasFields.ESTADO]: "Pendiente",
        };

        // Si hay criterio relacionado, agregar el link
        if (a.criterioRelacionado) {
          const criterioRecordId = criterioIdMap[a.criterioRelacionado];
          if (criterioRecordId) {
            fieldsData[accionesCorrectivasAreasFields.CRITERIO_LINK] = [criterioRecordId];
            console.log(`[Inspección Áreas] Vinculando acción con criterio: ${a.criterioRelacionado} → ${criterioRecordId}`);
          } else {
            console.warn(`[Inspección Áreas] Criterio ${a.criterioRelacionado} no encontrado en mapa. IDs disponibles:`, Object.keys(criterioIdMap));
          }
        }

        return { fields: fieldsData };
      });

      for (let i = 0; i < accionesRecords.length; i += 10) {
        const batch = accionesRecords.slice(i, i + 10);
        console.log("[Inspección Áreas] Creando acciones correctivas, lote", Math.floor(i/10) + 1, "con", batch.length, "registros");
        const resp = await fetch(accionesUrl, {
          method: "POST",
          headers: getSGSSTHeaders(),
          body: JSON.stringify({ records: batch }),
        });
        if (!resp.ok) {
          console.error("[Inspección Áreas] Error creando acciones correctivas:", await resp.text());
        } else {
          console.log("[Inspección Áreas] Acciones creadas exitosamente");
        }
      }
    }

    // 4. Crear responsables (firmas)
    console.log("[Inspección Áreas] Responsables a guardar:", payload.responsables.length);
    const respUrl = getSGSSTUrl(airtableSGSSTConfig.respInspeccionAreasTableId);
    const respRecords = payload.responsables.map((r) => {
      let firmaEncriptada = "";
      if (r.firma && AES_SECRET) {
        firmaEncriptada = encryptAES(
          JSON.stringify({
            signature: r.firma,
            nombre: r.nombre,
            cedula: r.cedula,
            tipo: r.tipo,
            timestamp: new Date().toISOString(),
            inspeccionId,
          })
        );
      }

      return {
        fields: {
          [respInspeccionAreasFields.ID_FIRMA]: `${inspeccionId}-${r.tipo.replace(/\s/g, "-")}`,
          [respInspeccionAreasFields.INSPECCION_LINK]: [cabeceraRecordId],
          [respInspeccionAreasFields.TIPO]: r.tipo,
          [respInspeccionAreasFields.NOMBRE]: r.nombre,
          [respInspeccionAreasFields.CEDULA]: r.cedula,
          [respInspeccionAreasFields.CARGO]: r.cargo,
          [respInspeccionAreasFields.FIRMA]: firmaEncriptada,
          [respInspeccionAreasFields.FECHA_FIRMA]: new Date().toISOString(),
        },
      };
    });

    if (respRecords.length > 0) {
      console.log("[Inspección Áreas] Enviando responsables a:", respUrl);
      console.log("[Inspección Áreas] Primer responsable:", JSON.stringify(respRecords[0], null, 2));
      const respResponse = await fetch(respUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify({ records: respRecords }),
      });
      if (!respResponse.ok) {
        console.error("[Inspección Áreas] Error creando responsables:", await respResponse.text());
      } else {
        console.log("[Inspección Áreas] Responsables creados exitosamente:", respRecords.length);
      }
    } else {
      console.log("[Inspección Áreas] No hay responsables para guardar");
    }

    console.log("Inspección de área guardada:", {
      id: inspeccionId,
      recordId: cabeceraRecordId,
      criterios: createdDetalleIds.length,
      acciones: payload.accionesCorrectivas?.length || 0,
      responsables: respRecords.length,
    });

    return NextResponse.json({
      success: true,
      message: "Inspección de área registrada correctamente",
      data: {
        id: inspeccionId,
        recordId: cabeceraRecordId,
        fecha: payload.fechaInspeccion,
        area: payload.area,
        criteriosEvaluados: createdDetalleIds.length,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-areas:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
