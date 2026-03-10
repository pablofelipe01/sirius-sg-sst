import { NextRequest, NextResponse } from "next/server";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

export interface EvalAplicadaItem {
  evalAplicadaId: string;
  nombres: string;
  cedula: string;
  empleadoCoreId: string;
  plantillaNombre: string;
  plantillaCodigo: string;
  fecha: string;
  estado: string;
  porcentaje: number;
}

// ══════════════════════════════════════════════════════════
// POST /api/evaluaciones/lista-evento
// Body: { registroRecordId }
// Returns list of best-attempt EvalAplicadas for an event
// ══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { registroRecordId } = body;
    if (!registroRecordId) {
      return NextResponse.json({ success: false, message: "registroRecordId requerido" }, { status: 400 });
    }

    const {
      eventosCapacitacionTableId,
      eventosCapacitacionFields: evtF,
      evalAplicadasTableId,
      evalAplicadasFields: eF,
      plantillasEvalTableId,
      plantillasEvalFields: pF,
      asistenciaCapacitacionesTableId,
      asistenciaCapacitacionesFields: aF,
    } = airtableSGSSTConfig;

    const headers = getSGSSTHeaders();
    const base = getSGSSTUrl;

    // ── 1. Fetch event ─────────────────────────────────────
    const evtRes = await fetch(`${base(eventosCapacitacionTableId)}/${registroRecordId}?returnFieldsByFieldId=true`, { headers, cache: "no-store" });
    if (!evtRes.ok) throw new Error("Evento no encontrado");
    const evtData = await evtRes.json();
    const evtFields = evtData.fields || {};
    const progIds = (evtFields[evtF.PROGRAMACION_LINK] as string[]) || [];
    const asisIds = (evtFields[evtF.ASISTENCIA_LINK] as string[]) || [];

    if (!progIds.length) {
      return NextResponse.json({ success: false, message: "El evento no tiene programaciones asociadas" }, { status: 404 });
    }

    // ── 2. Get employee IDs from attendees ─────────────────
    const employeeIds: string[] = [];
    for (let i = 0; i < asisIds.length; i += 50) {
      const batch = asisIds.slice(i, i + 50);
      const formula = `OR(${batch.map(id => `RECORD_ID()='${id}'`).join(",")})`;
      const url = `${base(asistenciaCapacitacionesTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(formula)}&fields[]=${aF.ID_EMPLEADO_CORE}`;
      const res = await fetch(url, { headers, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        for (const r of (data.records || []) as AirtableRecord[]) {
          const eid = r.fields[aF.ID_EMPLEADO_CORE] as string;
          if (eid) employeeIds.push(eid);
        }
      }
    }

    if (!employeeIds.length) {
      return NextResponse.json({ success: false, message: "No hay asistentes para este evento" }, { status: 404 });
    }

    // ── 3. Fetch EvalAplicadas filtered by employees + PROG_CAP ──
    const progIdsSet = new Set(progIds);
    const evalRecords: AirtableRecord[] = [];
    const evalFields = [eF.NOMBRES, eF.CEDULA, eF.PLANTILLA, eF.PORCENTAJE, eF.ESTADO, eF.INTENTO, eF.FECHA, eF.ID_EMPLEADO, eF.PROG_CAP];
    const fqs = evalFields.map(f => `fields[]=${f}`).join("&");

    for (let i = 0; i < employeeIds.length; i += 20) {
      const batch = employeeIds.slice(i, i + 20);
      const formula = encodeURIComponent(`OR(${batch.map(id => `{${eF.ID_EMPLEADO}}="${id}"`).join(",")})`);
      let url: string | null = `${base(evalAplicadasTableId)}?returnFieldsByFieldId=true&filterByFormula=${formula}&${fqs}`;
      while (url) {
        const res: Response = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) break;
        const data = await res.json();
        for (const r of (data.records || []) as AirtableRecord[]) {
          if (((r.fields[eF.PROG_CAP] as string[]) || []).some(pid => progIdsSet.has(pid))) {
            evalRecords.push(r);
          }
        }
        url = data.offset
          ? `${base(evalAplicadasTableId)}?returnFieldsByFieldId=true&filterByFormula=${formula}&${fqs}&offset=${data.offset}`
          : null;
      }
    }

    if (!evalRecords.length) {
      return NextResponse.json({ success: false, message: "No hay evaluaciones para este evento" }, { status: 404 });
    }

    // ── 4. Fetch plantilla name + code ─────────────────────
    const plantillaIds = [...new Set(
      evalRecords.flatMap(r => (r.fields[eF.PLANTILLA] as string[]) || []).filter(Boolean)
    )];
    const plantillaMap: Record<string, { nombre: string; codigo: string }> = {};
    if (plantillaIds.length) {
      const formula = `OR(${plantillaIds.map(id => `RECORD_ID()='${id}'`).join(",")})`;
      const url = `${base(plantillasEvalTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(formula)}&fields[]=${pF.NOMBRE}&fields[]=${pF.CODIGO}`;
      const res = await fetch(url, { headers, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        for (const r of (data.records || []) as AirtableRecord[]) {
          plantillaMap[r.id] = {
            nombre: r.fields[pF.NOMBRE] as string || "Evaluación",
            codigo: (r.fields[pF.CODIGO] as string || "EVAL").replace(/[^A-Za-z0-9-]/g, ""),
          };
        }
      }
    }

    // ── 5. Build items, keep best attempt per (cedula, plantilla) ──
    const rawItems = evalRecords.map(r => {
      const plId = ((r.fields[eF.PLANTILLA] as string[]) || [])[0] || "";
      const pl = plantillaMap[plId] || { nombre: "Evaluación", codigo: "EVAL" };
      return {
        evalAplicadaId: r.id,
        nombres: r.fields[eF.NOMBRES] as string || "",
        cedula: r.fields[eF.CEDULA] as string || "",
        empleadoCoreId: r.fields[eF.ID_EMPLEADO] as string || "",
        plantillaId: plId,
        plantillaNombre: pl.nombre,
        plantillaCodigo: pl.codigo,
        fecha: r.fields[eF.FECHA] as string || "",
        estado: r.fields[eF.ESTADO] as string || "",
        porcentaje: Number(r.fields[eF.PORCENTAJE]) || 0,
      };
    });

    const bestMap: Record<string, typeof rawItems[0]> = {};
    for (const item of rawItems) {
      const key = `${item.cedula}__${item.plantillaId}`;
      if (!bestMap[key] || item.porcentaje > bestMap[key].porcentaje) bestMap[key] = item;
    }

    const evaluaciones: EvalAplicadaItem[] = Object.values(bestMap)
      .sort((a, b) => a.nombres.localeCompare(b.nombres))
      .map(({ plantillaId: _plId, ...rest }) => rest);

    return NextResponse.json({ success: true, evaluaciones });
  } catch (err) {
    console.error("[lista-evento] Error:", err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
