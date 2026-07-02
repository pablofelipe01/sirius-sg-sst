import { NextRequest, NextResponse } from "next/server";
import { airtableSGSSTConfig, getSGSSTUrl, getSGSSTHeaders } from "@/infrastructure/config/airtableSGSST";

/**
 * GET /api/evaluaciones/pendientes?idEmpleadoCore=X[&progCapId=Y]
 *
 * Returns list of pending evaluations for an employee.
 * Filters by Población Objetivo (employee's committees).
 * When progCapId is given, attempt counting is scoped so evaluations
 * aren't double-counted across different trainings.
 *
 * Logic:
 *  1. Query MiembrosComites for employee's active committee memberships
 *  2. Query PlantillasEval (Estado=Activa, current year)
 *  3. Filter by Población Objetivo
 *  4. Check EvalAplicadas (scoped to progCapId when provided) for attempt count
 *  5. Build response
 */
export async function GET(request: NextRequest) {
  const idEmpleadoCore = request.nextUrl.searchParams.get("idEmpleadoCore");
  const progCapId = request.nextUrl.searchParams.get("progCapId") || null;
  const tipo = request.nextUrl.searchParams.get("tipo") || null;
  const temasTratados = request.nextUrl.searchParams.get("temasTratados") || null;

  if (!idEmpleadoCore) {
    return NextResponse.json({ success: false, message: "idEmpleadoCore requerido" }, { status: 400 });
  }

  console.log('[pendientes] Request params:', { idEmpleadoCore, progCapId, tipo, temasTratados });

  // ── REGLA ESPECIAL: Charlas de socialización NO tienen evaluación ──
  if (tipo === "Charla" || tipo === "Socialización" ||
      (temasTratados && (
        temasTratados.toLowerCase().includes("socialización") ||
        temasTratados.toLowerCase().includes("socializacion")
      ))) {
    console.log('[pendientes] Evento es Charla/Socialización - sin evaluación por regla');
    return NextResponse.json(
      { success: true, pendientes: [] },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } }
    );
  }

  // ── 0. Excluir empleados marcados con checkbox (Miembros Comité SST) ────
  try {
    const { miembrosComitesTableId: mbrTbl, miembrosComitesFields: mbrF } = airtableSGSSTConfig;
    const exclFormula = encodeURIComponent(
      `AND({${mbrF.ID_EMPLEADO}}="${idEmpleadoCore}", {${mbrF.EXCLUIR_ASISTENCIA}}=TRUE())`
    );
    const exclRes = await fetch(
      `${getSGSSTUrl(mbrTbl)}?returnFieldsByFieldId=true&filterByFormula=${exclFormula}&fields[]=${mbrF.ID_EMPLEADO}&pageSize=1`,
      { headers: getSGSSTHeaders(), cache: "no-store" }
    );
    if (exclRes.ok) {
      const exclData = await exclRes.json();
      if (exclData.records?.length > 0) {
        return NextResponse.json(
          { success: true, pendientes: [] },
          { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } }
        );
      }
    }
  } catch (e) {
    console.warn("[pendientes] Error checking exclusion checkbox:", e);
  }

  const {
    miembrosComitesTableId,
    miembrosComitesFields: mF,
    plantillasEvalTableId,
    plantillasEvalFields: pF,
    evalAplicadasTableId,
    evalAplicadasFields: eF,
  } = airtableSGSSTConfig;

  const headers = getSGSSTHeaders();
  const base = getSGSSTUrl;

  // ── 1. Obtener membresías activas ────────────────────
  const mbrFormula = encodeURIComponent(
    `AND({${mF.ID_EMPLEADO}}="${idEmpleadoCore}", {${mF.ESTADO}}="Activo")`
  );
  const mbrUrl = `${base(miembrosComitesTableId)}?returnFieldsByFieldId=true&filterByFormula=${mbrFormula}&fields[]=${mF.COMITE}`;
  const mbrRes = await fetch(mbrUrl, { headers, cache: "no-store" });
  const mbrData = mbrRes.ok ? await mbrRes.json() : { records: [] };
  const comites: string[] = (mbrData.records || []).map(
    (r: { fields: Record<string, string> }) => r.fields[mF.COMITE] as string
  ).filter(Boolean);

  // ── 2. Obtener mes y año actual (zona Colombia) ────────
  const now = new Date();
  const currentYear = now.getFullYear().toString();
  const currentMonth = now.toLocaleString('es-CO', {
    month: 'long',
    timeZone: 'America/Bogota'
  });
  const currentMonthCapitalized = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1); // "Marzo"

  // ── 3. Si NO hay progCapId, obtener programaciones del mes actual ─
  let progCapIdsDelMes: string[] = [];
  if (!progCapId) {
    const { programacionCapacitacionesTableId: progTbl, programacionCapacitacionesFields: pgF } = airtableSGSSTConfig;
    const progFormula = encodeURIComponent(
      `AND({${pgF.MES}}="${currentMonthCapitalized}", YEAR({${pgF.FECHA_EJECUCION}})=${currentYear})`
    );
    const progUrl = `${base(progTbl)}?returnFieldsByFieldId=true&filterByFormula=${progFormula}`;
    const progRes = await fetch(progUrl, { headers, cache: "no-store" });
    if (progRes.ok) {
      const progData = await progRes.json();
      progCapIdsDelMes = (progData.records || []).map((r: { id: string }) => r.id);
    }
  }

  // ── 4. Obtener plantillas activas para el año en curso ─
  // Si no hay progCapId, filtrar también por programaciones del mes actual
  let plntFormula: string;
  if (!progCapId && progCapIdsDelMes.length > 0) {
    // Filtrar por estado, vigencia Y programaciones del mes
    const progFilters = progCapIdsDelMes.map(id => `FIND("${id}", ARRAYJOIN({${pF.PROGRAMACIONES}}))`).join(",");
    plntFormula = encodeURIComponent(
      `AND({${pF.ESTADO}}="Activa", {${pF.VIGENCIA}}="${currentYear}", OR(${progFilters}))`
    );
  } else {
    // Filtrar solo por estado y vigencia (cuando hay progCapId o no hay programaciones del mes)
    plntFormula = encodeURIComponent(
      `AND({${pF.ESTADO}}="Activa", {${pF.VIGENCIA}}="${currentYear}")`
    );
  }

  const plntUrl = `${base(plantillasEvalTableId)}?returnFieldsByFieldId=true&filterByFormula=${plntFormula}`;
  const plntRes = await fetch(plntUrl, { headers, cache: "no-store" });
  if (!plntRes.ok) {
    return NextResponse.json({ success: false, message: "Error cargando plantillas" }, { status: 500 });
  }
  const plntData = await plntRes.json();

  // ── 3. Filtrar por Población Objetivo ────────────────
  const plantillasElegibles = (plntData.records || []).filter((r: { fields: Record<string, unknown> }) => {
    const poblacion = (r.fields[pF.POBLACION] as string) || "";
    return !poblacion || poblacion === "Todos los Colaboradores"
      || comites.some((c) => poblacion.includes(c));
  });

  if (plantillasElegibles.length === 0) {
    return NextResponse.json(
      { success: true, pendientes: [] },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } }
    );
  }

  // ── 4. Verificar intentos ya realizados ─────────────
  // Fetch all evaluations for this employee, then filter by progCapId in code
  // (FIND/ARRAYJOIN with field IDs doesn't work on linked record fields)
  const evalFormula = encodeURIComponent(`{${eF.ID_EMPLEADO}}="${idEmpleadoCore}"`);
  const evalUrl = `${base(evalAplicadasTableId)}?returnFieldsByFieldId=true&filterByFormula=${evalFormula}&fields[]=${eF.PLANTILLA}&fields[]=${eF.ESTADO}&fields[]=${eF.INTENTO}&fields[]=${eF.PROG_CAP}`;
  const evalRes = await fetch(evalUrl, { headers, cache: "no-store" });
  const evalData = evalRes.ok ? await evalRes.json() : { records: [] };

  // Map: plantillaRecordId -> { intentos, aprobada }
  const intentosMap: Record<string, { intentos: number; aprobada: boolean }> = {};
  for (const r of (evalData.records || [])) {
    const progCapIds: string[] = (r.fields[eF.PROG_CAP] as string[]) || [];

    // If progCapId is given, only count attempts scoped to that training
    if (progCapId) {
      if (!progCapIds.includes(progCapId)) continue;
    } else {
      // If no progCapId, only count attempts from current month's programaciones
      if (progCapIdsDelMes.length > 0) {
        const hasOverlap = progCapIds.some(id => progCapIdsDelMes.includes(id));
        if (!hasOverlap) continue;
      }
    }

    const plantIds: string[] = (r.fields[eF.PLANTILLA] as string[]) || [];
    const estado = r.fields[eF.ESTADO] as string;
    const intento = Number(r.fields[eF.INTENTO]) || 1;
    for (const pid of plantIds) {
      if (!intentosMap[pid]) intentosMap[pid] = { intentos: 0, aprobada: false };
      intentosMap[pid].intentos = Math.max(intentosMap[pid].intentos, intento);
      if (estado === "Aprobada") intentosMap[pid].aprobada = true;
    }
  }

  // ── 5. Construir respuesta ─────────────────────────────
  const pendientes = plantillasElegibles
    .map((r: { id: string; fields: Record<string, unknown> }) => {
      const intentosPermitidos = Number(r.fields[pF.INTENTOS]) || 1;
      const info = intentosMap[r.id];
      const intentosRealizados = info?.intentos ?? 0;
      const aprobada = info?.aprobada ?? false;
      const disponible = !aprobada && intentosRealizados < intentosPermitidos;

      return {
        id: r.id,
        codigo: r.fields[pF.CODIGO] as string,
        nombre: r.fields[pF.NOMBRE] as string,
        descripcion: r.fields[pF.DESCRIPCION] as string,
        tipo: r.fields[pF.TIPO] as string,
        puntajeMinimo: Number(r.fields[pF.PUNTAJE_MINIMO]) || 60,
        tiempoLimite: Number(r.fields[pF.TIEMPO_LIMITE]) || 0,
        intentosPermitidos,
        intentosRealizados,
        aprobada,
        disponible,
      };
    })
    .filter((e: { disponible: boolean; aprobada: boolean }) => e.disponible || e.aprobada);

  return NextResponse.json(
    { success: true, pendientes },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } }
  );
}
