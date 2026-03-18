import { NextRequest, NextResponse } from "next/server";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";
import {
  airtableInsumosConfig,
  getInsumosUrl,
  getInsumosHeaders,
} from "@/infrastructure/config/airtableInsumos";
import {
  airtableConfig,
  getAirtableUrl,
  getAirtableHeaders,
} from "@/infrastructure/config/airtable";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

interface DetalleEntrega {
  nombreInsumo: string;
  codigoInsumo: string;
  cantidad: number;
  talla: string;
  condicion: string;
}

interface TokenEntrega {
  tokenId: string;
  estado: string;
  fechaGeneracion: string;
}

interface Entrega {
  id: string;
  idEntrega: string;
  fechaEntrega: string;
  responsable: string;
  estado: string;
  motivo: string;
  fechaConfirmacion: string;
  observaciones: string;
  detalles: DetalleEntrega[];
  tokens: TokenEntrega[];
}

interface EmpleadoInfo {
  id: string;
  nombre: string;
  documento: string;
}

interface ResumenHistorial {
  totalEntregas: number;
  entregasConfirmadas: number;
  entregasPendientes: number;
  entregasAnuladas: number;
  totalEPPsEntregados: number;
  ultimaEntrega: string;
}

interface HistorialResponse {
  empleado: EmpleadoInfo;
  totalEntregas: number;
  entregas: Entrega[];
  resumen: ResumenHistorial;
}

// ══════════════════════════════════════════════════════════
// Helpers de paginación Airtable
// ══════════════════════════════════════════════════════════
async function fetchAllRecords(
  url: string,
  headers: HeadersInit,
  extraParams: Record<string, string> = {}
): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({
      pageSize: "100",
      returnFieldsByFieldId: "true",
      ...extraParams,
    });
    if (offset) params.set("offset", offset);

    const res = await fetch(`${url}?${params.toString()}`, { headers });
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`);
    const data: AirtableListResponse = await res.json();
    all.push(...data.records);
    offset = data.offset;
  } while (offset);

  return all;
}

async function fetchRecordsByIds(
  url: string,
  headers: HeadersInit,
  ids: string[]
): Promise<Map<string, AirtableRecord>> {
  const map = new Map<string, AirtableRecord>();
  if (ids.length === 0) return map;

  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const formula = `OR(${batch.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
    const params = new URLSearchParams({
      filterByFormula: formula,
      pageSize: "100",
      returnFieldsByFieldId: "true",
    });
    const res = await fetch(`${url}?${params.toString()}`, { headers });
    if (res.ok) {
      const data: AirtableListResponse = await res.json();
      for (const r of data.records) map.set(r.id, r);
    }
  }
  return map;
}

// ══════════════════════════════════════════════════════════
// GET /api/entregas-epp/historial
//
// Consulta historial completo de entregas EPP de un empleado específico
// Query params:
//   - idEmpleado (requerido): ID Empleado Core (ej: "EMP-001")
//   - estado (opcional): filtro por estado ("Pendiente", "Confirmada", "Anulada")
//   - fechaDesde (opcional): filtro desde fecha (YYYY-MM-DD)
//   - fechaHasta (opcional): filtro hasta fecha (YYYY-MM-DD)
// ══════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    // ── 1. Validar parámetros requeridos ──────────────────
    const idEmpleado = searchParams.get("idEmpleado");
    if (!idEmpleado) {
      return NextResponse.json(
        { success: false, message: "Se requiere idEmpleado" },
        { status: 400 }
      );
    }

    const estadoFiltro = searchParams.get("estado");
    const fechaDesde = searchParams.get("fechaDesde");
    const fechaHasta = searchParams.get("fechaHasta");

    // Validar formatos para prevenir inyección en fórmulas Airtable
    if (estadoFiltro && !["Pendiente", "Confirmada", "Anulada"].includes(estadoFiltro)) {
      return NextResponse.json(
        { success: false, message: "Estado inválido" },
        { status: 400 }
      );
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if ((fechaDesde && !dateRegex.test(fechaDesde)) || (fechaHasta && !dateRegex.test(fechaHasta))) {
      return NextResponse.json(
        { success: false, message: "Formato de fecha inválido (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const sgHeaders = getSGSSTHeaders();
    const insHeaders = getInsumosHeaders();
    const authHeaders = getAirtableHeaders();

    const {
      entregasTableId,
      entregasFields,
      detalleTableId,
      detalleFields,
      tokensTableId,
      tokensFields,
    } = airtableSGSSTConfig;

    const { insumoTableId, insumoFields } = airtableInsumosConfig;
    const { personalTableId, personalFields } = airtableConfig;

    // ── 2. Construir filtro de Airtable ───────────────────
    const safeIdEmpleado = idEmpleado.replace(/'/g, "\\'");
    let filterFormula = `{${entregasFields.ID_EMPLEADO_CORE}} = '${safeIdEmpleado}'`;

    if (estadoFiltro) {
      filterFormula = `AND(${filterFormula}, {${entregasFields.ESTADO}} = '${estadoFiltro}')`;
    }

    if (fechaDesde && fechaHasta) {
      // Airtable compara fechas ISO: YYYY-MM-DD
      filterFormula = `AND(${filterFormula}, IS_AFTER({${entregasFields.FECHA_ENTREGA}}, '${fechaDesde}'), IS_BEFORE({${entregasFields.FECHA_ENTREGA}}, DATEADD('${fechaHasta}', 1, 'days')))`;
    } else if (fechaDesde) {
      filterFormula = `AND(${filterFormula}, IS_AFTER({${entregasFields.FECHA_ENTREGA}}, '${fechaDesde}'))`;
    } else if (fechaHasta) {
      filterFormula = `AND(${filterFormula}, IS_BEFORE({${entregasFields.FECHA_ENTREGA}}, DATEADD('${fechaHasta}', 1, 'days')))`;
    }

    const entregasParams = {
      filterByFormula: filterFormula,
      [`sort[0][field]`]: entregasFields.FECHA_ENTREGA,
      [`sort[0][direction]`]: "desc", // Más reciente primero
    };

    // ── 3. Fetch en paralelo: entregas del empleado + datos maestros ──
    const [entregasEmpleado, allInsumos, allPersonal] = await Promise.all([
      fetchAllRecords(getSGSSTUrl(entregasTableId), sgHeaders, entregasParams),
      fetchAllRecords(getInsumosUrl(insumoTableId), insHeaders),
      fetchAllRecords(getAirtableUrl(personalTableId), authHeaders),
    ]);

    // ── 4. Validar que el empleado existe ─────────────────
    const personalMap = new Map<string, { nombre: string; documento: string }>();
    for (const r of allPersonal) {
      const f = r.fields;
      const empId = (f[personalFields.ID_EMPLEADO] as string) || "";
      personalMap.set(empId, {
        nombre: (f[personalFields.NOMBRE_COMPLETO] as string) || empId,
        documento: (f[personalFields.NUMERO_DOCUMENTO] as string) || "",
      });
    }

    const empleadoInfo = personalMap.get(idEmpleado);
    if (!empleadoInfo) {
      return NextResponse.json(
        { success: false, message: "Empleado no encontrado" },
        { status: 404 }
      );
    }

    // ── 5. Si no hay entregas, retornar respuesta vacía válida ──
    if (entregasEmpleado.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          empleado: {
            id: idEmpleado,
            nombre: empleadoInfo.nombre,
            documento: empleadoInfo.documento,
          },
          totalEntregas: 0,
          entregas: [],
          resumen: {
            totalEntregas: 0,
            entregasConfirmadas: 0,
            entregasPendientes: 0,
            entregasAnuladas: 0,
            totalEPPsEntregados: 0,
            ultimaEntrega: "",
          },
        },
      });
    }

    // ── 6. Construir mapa de insumos (para nombres) ───────
    const insumoNombreMap = new Map<string, string>();
    for (const r of allInsumos) {
      const codigo = r.fields[insumoFields.CODIGO] as string;
      const nombre = r.fields[insumoFields.NOMBRE] as string;
      if (codigo && nombre) insumoNombreMap.set(codigo, nombre);
    }

    // ── 7. Recopilar IDs de detalle y tokens ──────────────
    const detalleIds = new Set<string>();
    const tokenIds = new Set<string>();

    for (const ent of entregasEmpleado) {
      const dLinks = ent.fields[entregasFields.DETALLE_LINK] as string[] | undefined;
      const tLinks = ent.fields[entregasFields.TOKENS_LINK] as string[] | undefined;
      dLinks?.forEach((id) => detalleIds.add(id));
      tLinks?.forEach((id) => tokenIds.add(id));
    }

    // ── 8. Fetch detalles y tokens en paralelo ────────────
    const [detalleMap, tokenMap] = await Promise.all([
      fetchRecordsByIds(getSGSSTUrl(detalleTableId), sgHeaders, Array.from(detalleIds)),
      fetchRecordsByIds(getSGSSTUrl(tokensTableId), sgHeaders, Array.from(tokenIds)),
    ]);

    // ── 9. Construir respuesta con entregas completas ─────
    const entregas: Entrega[] = [];
    let entregasConfirmadas = 0;
    let entregasPendientes = 0;
    let entregasAnuladas = 0;
    let totalEPPs = 0;

    for (const ent of entregasEmpleado) {
      const f = ent.fields;
      const estado = (f[entregasFields.ESTADO] as string) || "";

      // Contadores por estado
      if (estado === "Confirmada") entregasConfirmadas++;
      else if (estado === "Pendiente") entregasPendientes++;
      else if (estado === "Anulada") entregasAnuladas++;

      // Resolver detalles
      const dLinks = (f[entregasFields.DETALLE_LINK] as string[]) || [];
      const detalles: DetalleEntrega[] = dLinks
        .map((id) => {
          const r = detalleMap.get(id);
          if (!r) return null;
          const df = r.fields;
          const codigoInsumo = (df[detalleFields.CODIGO_INSUMO] as string) || "";
          const cantidad = (df[detalleFields.CANTIDAD] as number) || 0;
          totalEPPs += cantidad;

          return {
            nombreInsumo: insumoNombreMap.get(codigoInsumo) || codigoInsumo,
            codigoInsumo,
            cantidad,
            talla: (df[detalleFields.TALLA] as string) || "",
            condicion: (df[detalleFields.CONDICION] as string) || "",
          };
        })
        .filter((d): d is DetalleEntrega => d !== null);

      // Resolver tokens
      const tLinks = (f[entregasFields.TOKENS_LINK] as string[]) || [];
      const tokens: TokenEntrega[] = tLinks
        .map((id) => {
          const r = tokenMap.get(id);
          if (!r) return null;
          const tf = r.fields;
          return {
            tokenId: (tf[tokensFields.TOKEN_ID] as string) || "",
            estado: (tf[tokensFields.ESTADO] as string) || "",
            fechaGeneracion: (tf[tokensFields.FECHA_GENERACION] as string) || "",
          };
        })
        .filter((t): t is TokenEntrega => t !== null);

      entregas.push({
        id: ent.id,
        idEntrega: (f[entregasFields.ID_ENTREGA] as string) || "",
        fechaEntrega: (f[entregasFields.FECHA_ENTREGA] as string) || "",
        responsable: (f[entregasFields.RESPONSABLE] as string) || "",
        estado,
        motivo: (f[entregasFields.MOTIVO] as string) || "",
        fechaConfirmacion: (f[entregasFields.FECHA_CONFIRMACION] as string) || "",
        observaciones: (f[entregasFields.OBSERVACIONES] as string) || "",
        detalles,
        tokens,
      });
    }

    // ── 10. Construir resumen estadístico ─────────────────
    const ultimaEntrega = entregas.length > 0 ? entregas[0].fechaEntrega : "";

    const resumen: ResumenHistorial = {
      totalEntregas: entregas.length,
      entregasConfirmadas,
      entregasPendientes,
      entregasAnuladas,
      totalEPPsEntregados: totalEPPs,
      ultimaEntrega,
    };

    // ── 11. Respuesta final ───────────────────────────────
    const response: HistorialResponse = {
      empleado: {
        id: idEmpleado,
        nombre: empleadoInfo.nombre,
        documento: empleadoInfo.documento,
      },
      totalEntregas: entregas.length,
      entregas,
      resumen,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("Error fetching historial entregas EPP:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al consultar historial de entregas",
      },
      { status: 500 }
    );
  }
}
