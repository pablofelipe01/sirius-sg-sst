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

// ══════════════════════════════════════════════════════════
// POST /api/evaluaciones/poblaciones
// Body: { registroRecordId }
// Returns: { success: true, poblaciones: string[] }
// Detects unique population types for evaluations of an event
// ══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { registroRecordId } = body;
    if (!registroRecordId) {
      return NextResponse.json(
        { success: false, message: "registroRecordId requerido" },
        { status: 400 }
      );
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

    // 1. Fetch event → programacion IDs + asistencia IDs
    const evtRes = await fetch(
      `${base(eventosCapacitacionTableId)}/${registroRecordId}?returnFieldsByFieldId=true`,
      { headers, cache: "no-store" }
    );
    if (!evtRes.ok) {
      return NextResponse.json(
        { success: false, message: "Evento no encontrado" },
        { status: 404 }
      );
    }
    const evtFields = (await evtRes.json()).fields || {};
    const progIds = (evtFields[evtF.PROGRAMACION_LINK] as string[]) || [];
    const asisIds = (evtFields[evtF.ASISTENCIA_LINK] as string[]) || [];

    if (!progIds.length || !asisIds.length) {
      return NextResponse.json({ success: true, poblaciones: [] });
    }

    // 2. Fetch employee IDs from asistencia
    const employeeIds: string[] = [];
    for (let i = 0; i < asisIds.length; i += 50) {
      const batch = asisIds.slice(i, i + 50);
      const formula = `OR(${batch.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const url = `${base(asistenciaCapacitacionesTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(formula)}&fields[]=${aF.ID_EMPLEADO_CORE}`;
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of (data.records || []) as AirtableRecord[]) {
        const eid = r.fields[aF.ID_EMPLEADO_CORE] as string;
        if (eid) employeeIds.push(eid);
      }
    }

    if (!employeeIds.length) {
      return NextResponse.json({ success: true, poblaciones: [] });
    }

    // 3. Fetch EvalAplicadas → plantilla IDs (only matching programaciones)
    const progIdsSet = new Set(progIds);
    const plantillaIdsSet = new Set<string>();

    for (let i = 0; i < employeeIds.length; i += 20) {
      const batch = employeeIds.slice(i, i + 20);
      const formula = encodeURIComponent(
        `OR(${batch.map((id) => `{${eF.ID_EMPLEADO}}="${id}"`).join(",")})`
      );
      let url: string | null = `${base(evalAplicadasTableId)}?returnFieldsByFieldId=true&filterByFormula=${formula}&fields[]=${eF.PLANTILLA}&fields[]=${eF.PROG_CAP}`;
      while (url) {
        const res: Response = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) break;
        const data: { records?: AirtableRecord[]; offset?: string } = await res.json();
        for (const r of (data.records || []) as AirtableRecord[]) {
          if (
            ((r.fields[eF.PROG_CAP] as string[]) || []).some((pid) =>
              progIdsSet.has(pid)
            )
          ) {
            const plId = ((r.fields[eF.PLANTILLA] as string[]) || [])[0];
            if (plId) plantillaIdsSet.add(plId);
          }
        }
        url = data.offset
          ? `${base(evalAplicadasTableId)}?returnFieldsByFieldId=true&filterByFormula=${formula}&fields[]=${eF.PLANTILLA}&fields[]=${eF.PROG_CAP}&offset=${data.offset}`
          : null;
      }
    }

    if (plantillaIdsSet.size === 0) {
      return NextResponse.json({ success: true, poblaciones: [] });
    }

    // 4. Fetch plantillas → POBLACION
    const plantillaIds = [...plantillaIdsSet];
    const formula = `OR(${plantillaIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
    const plUrl = `${base(plantillasEvalTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(formula)}&fields[]=${pF.POBLACION}`;
    const plRes = await fetch(plUrl, { headers, cache: "no-store" });

    const poblacionesSet = new Set<string>();
    if (plRes.ok) {
      for (const r of ((await plRes.json()).records || []) as AirtableRecord[]) {
        const pob = ((r.fields[pF.POBLACION] as string) || "").trim();
        poblacionesSet.add(pob || "General");
      }
    }

    return NextResponse.json({
      success: true,
      poblaciones: [...poblacionesSet].sort(),
    });
  } catch (err) {
    console.error("[poblaciones] Error:", err);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
