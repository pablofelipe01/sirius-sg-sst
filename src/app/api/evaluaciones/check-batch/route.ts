import { NextRequest, NextResponse } from "next/server";
import { airtableSGSSTConfig, getSGSSTUrl, getSGSSTHeaders } from "@/infrastructure/config/airtableSGSST";

/**
 * POST /api/evaluaciones/check-batch
 *
 * Checks evaluation completion status for a batch of employees.
 * Returns which employees have completed (Aprobada) their evaluation
 * for the given programación(es).
 *
 * Body:
 *   {
 *     idEmpleadoCores: string[];   // e.g. ["SIRIUS-PER-0009", "SIRIUS-PER-0012"]
 *     progCapIds: string[];        // Programación Capacitación record IDs
 *   }
 *
 * Response:
 *   {
 *     success: true,
 *     hasEvaluaciones: boolean,       // true if there are active plantillas
 *     results: { [idEmpleadoCore: string]: boolean }  // true = eval completed/approved
 *   }
 */
export async function POST(request: NextRequest) {
  let body: { idEmpleadoCores: string[]; progCapIds: string[]; tipo?: string; temasTratados?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Body inválido" }, { status: 400 });
  }

  const { idEmpleadoCores, progCapIds, tipo, temasTratados } = body;

  console.log('[check-batch] Request body:', JSON.stringify({ idEmpleadoCores, progCapIds, tipo }, null, 2));

  // ── REGLA ESPECIAL: Charlas de socialización NO tienen evaluación ──
  if (tipo === "Charla" || tipo === "Socialización" ||
      (temasTratados && (
        temasTratados.toLowerCase().includes("socialización") ||
        temasTratados.toLowerCase().includes("socializacion")
      ))) {
    console.log('[check-batch] Evento es Charla/Socialización - sin evaluación por regla');
    const results: Record<string, boolean> = {};
    for (const id of idEmpleadoCores) results[id] = true;
    return NextResponse.json(
      { success: true, hasEvaluaciones: false, results },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } }
    );
  }

  if (!Array.isArray(idEmpleadoCores) || idEmpleadoCores.length === 0) {
    return NextResponse.json({ success: false, message: "idEmpleadoCores requerido" }, { status: 400 });
  }

  // ── 0. Identificar empleados excluidos (checkbox en Miembros Comité SST) ──
  const excludedSet = new Set<string>();
  try {
    const { miembrosComitesTableId: mbrTbl, miembrosComitesFields: mbrF } = airtableSGSSTConfig;
    const exclFormula = encodeURIComponent(`{${mbrF.EXCLUIR_ASISTENCIA}}=TRUE()`);
    const exclRes = await fetch(
      `${getSGSSTUrl(mbrTbl)}?returnFieldsByFieldId=true&filterByFormula=${exclFormula}&fields[]=${mbrF.ID_EMPLEADO}`,
      { headers: getSGSSTHeaders(), cache: "no-store" }
    );
    if (exclRes.ok) {
      const exclData = await exclRes.json();
      for (const r of (exclData.records || [])) {
        const empId = r.fields[mbrF.ID_EMPLEADO] as string;
        if (empId) excludedSet.add(empId);
      }
    }
  } catch (e) {
    console.warn("[check-batch] Error checking exclusion checkbox:", e);
  }

  const {
    plantillasEvalTableId,
    plantillasEvalFields: pF,
    evalAplicadasTableId,
    evalAplicadasFields: eF,
  } = airtableSGSSTConfig;

  const headers = getSGSSTHeaders();
  const base = getSGSSTUrl;

  // ── 1. Check if there are active plantillas for this year AND these specific programaciones ──
  const currentYear = new Date().getFullYear().toString();

  // Si no hay programaciones específicas (evento "Otra" o sin vincular), NO tiene evaluaciones
  if (!progCapIds || progCapIds.length === 0) {
    console.log('[check-batch] No hay progCapIds - evento sin evaluación');
    const results: Record<string, boolean> = {};
    for (const id of idEmpleadoCores) results[id] = true;
    return NextResponse.json(
      { success: true, hasEvaluaciones: false, results },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } }
    );
  }

  // CÓDIGO REMOVIDO - Ya no verificamos plantillas generales
  /*
  if (!progCapIds || progCapIds.length === 0) {
  */

  // Verificar si existe alguna plantilla activa vinculada a estas programaciones específicas
  console.log('[check-batch] Verificando plantillas para progCapIds:', progCapIds);
  {
  // Verificar si existe alguna plantilla activa vinculada a estas programaciones específicas
  const progFormulaParts = progCapIds.map(pid => `FIND("${pid}", ARRAYJOIN({${pF.PROGRAMACIONES}})) > 0`);
  const plntFormula = encodeURIComponent(
    `AND({${pF.ESTADO}}="Activa", {${pF.VIGENCIA}}="${currentYear}", OR(${progFormulaParts.join(",")}))`
  );
  console.log('[check-batch] Formula:', plntFormula);
  const plntUrl = `${base(plantillasEvalTableId)}?returnFieldsByFieldId=true&filterByFormula=${plntFormula}&fields[]=${pF.CODIGO}&fields[]=${pF.PROGRAMACIONES}`;
  const plntRes = await fetch(plntUrl, { headers, cache: "no-store" });
  const plntData = plntRes.ok ? await plntRes.json() : { records: [] };

  console.log('[check-batch] Plantillas encontradas:', plntData.records?.length || 0);

  if (!plntData.records || plntData.records.length === 0) {
    // No hay plantillas activas para estas programaciones específicas — todos pueden firmar
    console.log('[check-batch] No hay plantillas vinculadas - evento sin evaluación');
    const results: Record<string, boolean> = {};
    for (const id of idEmpleadoCores) results[id] = true;
    return NextResponse.json(
      { success: true, hasEvaluaciones: false, results },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } }
    );
  }

  console.log('[check-batch] Plantillas encontradas - evento CON evaluación');
}

  // ── 2. Fetch all EvalAplicadas with status "Aprobada" for these employees ──
  // Build formula: OR(id1, id2, ...) with estado = Aprobada
  // Batch employees in groups of 20 for formula length constraints
  const approvedMap: Record<string, Set<string>> = {}; // idEmpleadoCore -> Set<progCapId>

  const batchSize = 20;
  for (let i = 0; i < idEmpleadoCores.length; i += batchSize) {
    const batch = idEmpleadoCores.slice(i, i + batchSize);
    const orParts = batch.map((id) => `{${eF.ID_EMPLEADO}}="${id}"`);
    const formula = encodeURIComponent(
      `AND(OR(${orParts.join(",")}), {${eF.ESTADO}}="Aprobada")`
    );
    const evalUrl = `${base(evalAplicadasTableId)}?returnFieldsByFieldId=true&filterByFormula=${formula}&fields[]=${eF.ID_EMPLEADO}&fields[]=${eF.PROG_CAP}&fields[]=${eF.ESTADO}`;
    const evalRes = await fetch(evalUrl, { headers, cache: "no-store" });
    if (!evalRes.ok) continue;
    const evalData = await evalRes.json();

    for (const r of (evalData.records || [])) {
      const empId = r.fields[eF.ID_EMPLEADO] as string;
      const progIds: string[] = (r.fields[eF.PROG_CAP] as string[]) || [];
      if (!empId) continue;
      if (!approvedMap[empId]) approvedMap[empId] = new Set();
      for (const pid of progIds) approvedMap[empId].add(pid);
    }
  }

  // ── 3. Build results ──
  const results: Record<string, boolean> = {};
  for (const empId of idEmpleadoCores) {
    // Responsable SST siempre pasa (excluida de evaluaciones)
    if (excludedSet.has(empId)) {
      results[empId] = true;
      continue;
    }
    if (!progCapIds || progCapIds.length === 0) {
      // No specific progCapIds — just check if they have ANY approved eval
      results[empId] = !!(approvedMap[empId] && approvedMap[empId].size > 0);
    } else {
      // Check if approved for at least one of the progCapIds
      const approved = approvedMap[empId];
      results[empId] = !!approved && progCapIds.some((pid) => approved.has(pid));
    }
  }

  const noCache = { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } };
  return NextResponse.json({ success: true, hasEvaluaciones: true, results }, noCache);
}
