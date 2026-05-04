"use client";

import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Users,
  GraduationCap,
  FileText,
} from "lucide-react";
import MicTranscribeButton, { appendTranscripcion } from "@/presentation/components/ui/MicTranscribeButton";
import AsistenteFirmaModal from "@/presentation/components/comites/AsistenteFirmaModal";

type ComiteSlug = "copasst" | "cocolab";

const RESULTADO_COND = [
  { v: "ok", l: "Conforme" },
  { v: "oportunidad_mejora", l: "Oportunidad de mejora" },
  { v: "critico", l: "Crítico" },
] as const;

const CATEGORIAS_COCOLAB = [
  { v: "riesgo_psicosocial", l: "Riesgo psicosocial" },
  { v: "convivencia_laboral", l: "Convivencia laboral" },
  { v: "articulacion_sgsst", l: "Articulación con SG-SST" },
  { v: "cultura_preventiva", l: "Cultura preventiva" },
  { v: "otro", l: "Otro" },
] as const;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const LUGARES_REUNION = [
  "Sala de juntas",
  "Sala de reuniones",
  "Oficina principal",
  "Virtual (Google Meet)",
  "Virtual (Microsoft Teams)",
  "Virtual (Zoom)",
  "Auditorio",
  "Otro",
] as const;

interface Miembro {
  recordId: string;
  idMiembro: string;
  nombre: string;
  cedula: string;
  cargo: string;
  rol: string;
}

interface CapacitacionRef {
  recordId: string;
  tema: string;
  fechaEjecucion?: string | null;
}

interface CompromisoForm {
  compromiso: string;
  responsable: string;
  fechaLimite: string;
}

interface CondicionForm {
  descripcion: string;
  resultado: "ok" | "oportunidad_mejora" | "critico";
  observacion: string;
}

interface AccionPreventivaForm {
  categoria: string;
  descripcion: string;
}

const ROL_LABEL: Record<string, string> = {
  presidente: "Presidente(a)",
  secretaria: "Secretario(a)",
  secretario: "Secretario(a)",
  suplente_empleador: "Suplente Empleador",
  suplente_empresa: "Suplente Empresa",
  suplente_trabajadores: "Suplente Trabajadores",
  invitado: "Invitado(a)",
};

export default function NuevaActaPage({
  params,
}: {
  params: Promise<{ comite: ComiteSlug }>;
}) {
  const { comite } = use(params);
  const router = useRouter();
  const isCopasst = comite === "copasst";

  // ── Estado: cabecera ──
  const today = new Date();
  const [fechaReunion, setFechaReunion] = useState(today.toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaCierre, setHoraCierre] = useState("10:00");
  const [lugarSeleccionado, setLugarSeleccionado] = useState<string>("");
  const [lugarOtro, setLugarOtro] = useState("");
  const [mesEvaluado, setMesEvaluado] = useState(
    `${MESES[today.getMonth()]} ${today.getFullYear()}`
  );
  const [numeroActa, setNumeroActa] = useState("");

  // ── COPASST ──
  const [accidentesPresentados, setAccidentesPresentados] = useState(false);
  const [accidentesDetalle, setAccidentesDetalle] = useState("");
  const [incidentesPresentados, setIncidentesPresentados] = useState(false);
  const [incidentesDetalle, setIncidentesDetalle] = useState("");
  const [novedades, setNovedades] = useState("");
  const [condiciones, setCondiciones] = useState<CondicionForm[]>([]);

  // ── COCOLAB ──
  const [quejasAcoso, setQuejasAcoso] = useState(false);
  const [quejasDetalle, setQuejasDetalle] = useState("");
  const [conflictos, setConflictos] = useState(false);
  const [conflictosDetalle, setConflictosDetalle] = useState("");
  const [acciones, setAcciones] = useState<AccionPreventivaForm[]>([]);

  // ── Compromisos ──
  const [compromisos, setCompromisos] = useState<CompromisoForm[]>([]);

  // ── Personal (para dropdown de responsable en compromisos) ──
  const [personal, setPersonal] = useState<{ id: string; nombreCompleto: string }[]>([]);

  // ── Miembros del comité ──
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [loadingMiembros, setLoadingMiembros] = useState(true);
  const [asistenciaMap, setAsistenciaMap] = useState<Record<string, boolean>>({});
  const [firmasMap, setFirmasMap] = useState<Record<string, string>>({});
  const [modalAsistente, setModalAsistente] = useState<Miembro | null>(null);

  // ── Capacitaciones ejecutadas (solo COPASST) ──
  const [capsCatalogo, setCapsCatalogo] = useState<CapacitacionRef[]>([]);
  const [loadingCaps, setLoadingCaps] = useState(false);
  const [capsSeleccionadas, setCapsSeleccionadas] = useState<Record<string, boolean>>({});

  const [estado, setEstado] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Cargar miembros del comité (Miembros Comite SST filtrado por COMITE + activo)
  useEffect(() => {
    setLoadingMiembros(true);
    fetch(`/api/comites/miembros?comite=${comite.toUpperCase()}&estado=activo`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        const list: Miembro[] = (j.data || []).map(
          (m: Record<string, unknown>): Miembro => ({
            recordId: String(m.recordId || ""),
            idMiembro: String(m.idMiembro || ""),
            nombre: String(m.nombre || ""),
            cedula: String(m.cedula || ""),
            cargo: String(m.cargo || ""),
            rol: String(m.rol || ""),
          })
        );
        setMiembros(list);
        const init: Record<string, boolean> = {};
        list.forEach((m) => (init[m.recordId] = true));
        setAsistenciaMap(init);
      })
      .catch(() => setMiembros([]))
      .finally(() => setLoadingMiembros(false));
  }, [comite]);

  // Cargar personal de Sirius Nómina Core (para responsable de compromisos)
  useEffect(() => {
    fetch("/api/personal")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) {
          setPersonal(
            j.data.map((p: Record<string, unknown>) => ({
              id: String(p.id || ""),
              nombreCompleto: String(p.nombreCompleto || ""),
            }))
          );
        }
      })
      .catch(() => setPersonal([]));
  }, []);

  // Cargar capacitaciones ejecutadas del mes (solo COPASST)
  useEffect(() => {
    if (!isCopasst) return;
    const d = new Date(fechaReunion + "T00:00:00");
    const mes = d.getMonth() + 1;
    const anio = d.getFullYear();
    setLoadingCaps(true);
    fetch(`/api/comites/capacitaciones-ejecutadas?mes=${mes}&anio=${anio}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        const list: CapacitacionRef[] = (j.data || []).map(
          (c: Record<string, unknown>): CapacitacionRef => ({
            recordId: String(c.recordId || ""),
            tema: String(c.tema || "(sin tema)"),
            fechaEjecucion: (c.fechaEjecucion as string) || null,
          })
        );
        setCapsCatalogo(list);
      })
      .catch(() => setCapsCatalogo([]))
      .finally(() => setLoadingCaps(false));
  }, [isCopasst, fechaReunion]);

  const asistentesRecordIds = useMemo(
    () => Object.entries(asistenciaMap).filter(([, v]) => v).map(([k]) => k),
    [asistenciaMap]
  );

  const capacitacionesRecordIds = useMemo(
    () => Object.entries(capsSeleccionadas).filter(([, v]) => v).map(([k]) => k),
    [capsSeleccionadas]
  );

  const submit = async () => {
    setErrorMsg("");
    const lugarFinal = lugarSeleccionado === "Otro" ? lugarOtro : lugarSeleccionado;
    if (!lugarFinal.trim()) {
      setErrorMsg("Ingrese el lugar de la reunión");
      return;
    }
    if (asistentesRecordIds.length === 0) {
      setErrorMsg("Marque al menos un asistente");
      return;
    }
    setEstado("saving");

    // Preparar asistentes con firmas
    const asistentesConFirmas = asistentesRecordIds.map(recordId => ({
      recordId,
      asistio: true,
      firma: firmasMap[recordId] || null,
    }));

    const payload: Record<string, unknown> = {
      numeroActa: numeroActa || undefined,
      mesEvaluado,
      fechaReunion,
      horaInicio,
      horaCierre,
      lugar: lugarFinal,
      asistentesConFirmas, // Enviar con firmas incluidas
      compromisos: compromisos.filter((c) => c.compromiso.trim()),
    };
    if (isCopasst) {
      payload.accidentesPresentados = accidentesPresentados;
      payload.accidentesDetalle = accidentesDetalle;
      payload.incidentesPresentados = incidentesPresentados;
      payload.incidentesDetalle = incidentesDetalle;
      payload.novedadesAdministrativas = novedades;
      payload.condicionesInseguras = condiciones.filter((c) => c.descripcion.trim());
      payload.capacitacionesRecordIds = capacitacionesRecordIds;
    } else {
      payload.quejasAcoso = quejasAcoso;
      payload.quejasAcosoDetalle = quejasDetalle;
      payload.conflictosLaborales = conflictos;
      payload.conflictosLaboralesDetalle = conflictosDetalle;
      payload.accionesPreventivas = acciones.filter((a) => a.descripcion.trim());
    }

    try {
      const r = await fetch(`/api/${comite}/actas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        setErrorMsg(j.message || "Error al guardar");
        setEstado("error");
        return;
      }
      setEstado("ok");
      setTimeout(() => {
        router.push(`/dashboard/comites/${comite}/${j.data.idActa}`);
      }, 700);
    } catch (e) {
      console.error(e);
      setErrorMsg("Error de red");
      setEstado("error");
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="/20032025-DSC_3717.jpg"
          alt=""
          fill
          className="object-cover"
          priority
          quality={85}
        />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 py-5">
            <button
              onClick={() => router.push(`/dashboard/comites/${comite}`)}
              className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/20 hover:border-white/30 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver
            </button>
            <div className="h-8 w-px bg-white/20" />
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${isCopasst ? "bg-blue-500/20 border-blue-400/30" : "bg-emerald-500/20 border-emerald-400/30"}`}>
                <FileText className={`w-5 h-5 ${isCopasst ? "text-blue-300" : "text-emerald-300"}`} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Nueva acta {comite.toUpperCase()}</h1>
                <p className="text-xs text-white/50">SG-SST</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Nueva acta {comite.toUpperCase()}</h2>
          <p className="mt-1 text-white/50 text-sm">
            Diligencie la información — el sistema asignará el correlativo
            automáticamente si lo deja en blanco.
          </p>
        </div>

        <div className="space-y-6">
          {/* Datos generales */}
          <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Datos generales</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Mes evaluado">
                <input type="text" value={mesEvaluado} onChange={(e) => setMesEvaluado(e.target.value)} className="input" />
              </Field>
              <Field label="Fecha de reunión">
                <input type="date" value={fechaReunion} onChange={(e) => setFechaReunion(e.target.value)} className="input" />
              </Field>
              <Field label="Hora inicio">
                <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="input" />
              </Field>
              <Field label="Hora cierre">
                <input type="time" value={horaCierre} onChange={(e) => setHoraCierre(e.target.value)} className="input" />
              </Field>
              <Field label="Lugar">
                <select
                  value={lugarSeleccionado}
                  onChange={(e) => {
                    setLugarSeleccionado(e.target.value);
                    if (e.target.value !== "Otro") setLugarOtro("");
                  }}
                  className="input"
                >
                  <option value="" className="bg-slate-900">Seleccione el lugar...</option>
                  {LUGARES_REUNION.map((l) => (
                    <option key={l} value={l} className="bg-slate-900">{l}</option>
                  ))}
                </select>
              </Field>
              {lugarSeleccionado === "Otro" && (
                <Field label="Especifique el lugar">
                  <input
                    type="text"
                    value={lugarOtro}
                    onChange={(e) => setLugarOtro(e.target.value)}
                    placeholder="Escriba el lugar de la reunión"
                    className="input"
                  />
                </Field>
              )}
            </div>
          </section>

          {/* Asistentes */}
          <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Asistentes — miembros activos del comité {comite.toUpperCase()}
              </h2>
              <span className="text-xs text-white/50">
                {asistentesRecordIds.length} de {miembros.length} marcados
              </span>
            </div>
            {loadingMiembros ? (
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando miembros...
              </div>
            ) : miembros.length === 0 ? (
              <p className="text-amber-300 text-sm">
                No hay miembros activos registrados para este comité. Verifique
                la tabla &quot;Miembros Comite SST&quot; en Airtable.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-white/60">
                    <tr>
                      <th className="text-center py-2 w-12">Asistió</th>
                      <th className="text-left py-2">Nombre</th>
                      <th className="text-left py-2">Cédula</th>
                      <th className="text-left py-2">Cargo</th>
                      <th className="text-left py-2">Rol en el comité</th>
                      <th className="text-center py-2 w-24">Firma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {miembros.map((m) => (
                      <tr key={m.recordId} className="border-t border-white/10">
                        <td className="py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!asistenciaMap[m.recordId]}
                            onChange={(e) => {
                              const nuevoMap = { ...asistenciaMap, [m.recordId]: e.target.checked };
                              setAsistenciaMap(nuevoMap);
                              // Limpiar firma si se desmarca
                              if (!e.target.checked && firmasMap[m.recordId]) {
                                const nuevoFirmasMap = { ...firmasMap };
                                delete nuevoFirmasMap[m.recordId];
                                setFirmasMap(nuevoFirmasMap);
                              }
                            }}
                            className="w-4 h-4 accent-blue-500"
                          />
                        </td>
                        <td className="py-2 text-white/90">{m.nombre}</td>
                        <td className="py-2 text-white/70">{m.cedula}</td>
                        <td className="py-2 text-white/70">{m.cargo}</td>
                        <td className="py-2 text-white/70">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-white/10 border border-white/15 text-white/80">
                            {ROL_LABEL[m.rol?.toLowerCase()] || m.rol || "—"}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          {asistenciaMap[m.recordId] && (
                            firmasMap[m.recordId] ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Firmado
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setModalAsistente(m)}
                                className="text-xs px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-400/30 text-blue-300 transition-colors"
                              >
                                Firmar
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Específicos COPASST */}
          {isCopasst && (
            <>
              <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Accidentes e incidentes</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <BoolDetalle label="¿Hubo accidentes?" value={accidentesPresentados} onChange={setAccidentesPresentados} detalle={accidentesDetalle} onDetalle={setAccidentesDetalle} onMicError={setErrorMsg} />
                  <BoolDetalle label="¿Hubo incidentes?" value={incidentesPresentados} onChange={setIncidentesPresentados} detalle={incidentesDetalle} onDetalle={setIncidentesDetalle} onMicError={setErrorMsg} />
                </div>
              </section>

              <Repeater
                titulo="Condiciones inseguras observadas"
                items={condiciones}
                setItems={setCondiciones}
                nuevo={() => ({ descripcion: "", resultado: "ok" as const, observacion: "" })}
                render={(c, set) => (
                  <>
                    <div className="flex-1 flex items-center gap-1">
                      <input placeholder="Descripción" value={c.descripcion} onChange={(e) => set({ ...c, descripcion: e.target.value })} className="input flex-1" />
                      <MicTranscribeButton
                        variant="icon"
                        onTranscribed={(t) => set({ ...c, descripcion: appendTranscripcion(c.descripcion, t) })}
                        onError={setErrorMsg}
                      />
                    </div>
                    <select value={c.resultado} onChange={(e) => set({ ...c, resultado: e.target.value as CondicionForm["resultado"] })} className="input w-48">
                      {RESULTADO_COND.map((r) => (
                        <option key={r.v} value={r.v} className="bg-slate-900">{r.l}</option>
                      ))}
                    </select>
                    <div className="flex-1 flex items-center gap-1">
                      <input placeholder="Observación" value={c.observacion} onChange={(e) => set({ ...c, observacion: e.target.value })} className="input flex-1" />
                      <MicTranscribeButton
                        variant="icon"
                        onTranscribed={(t) => set({ ...c, observacion: appendTranscripcion(c.observacion, t) })}
                        onError={setErrorMsg}
                      />
                    </div>
                  </>
                )}
              />

              {/* Capacitaciones del mes (FK a Programación Capacitaciones) */}
              <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    Capacitaciones ejecutadas del mes
                  </h2>
                  <span className="text-xs text-white/50">
                    {capacitacionesRecordIds.length} seleccionadas
                  </span>
                </div>
                {loadingCaps ? (
                  <div className="flex items-center gap-2 text-white/50 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando capacitaciones...
                  </div>
                ) : capsCatalogo.length === 0 ? (
                  <p className="text-white/40 text-sm italic">
                    No hay capacitaciones registradas en{" "}
                    {MESES[new Date(fechaReunion + "T00:00:00").getMonth()]}{" "}
                    {new Date(fechaReunion + "T00:00:00").getFullYear()}.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {capsCatalogo.map((c) => (
                      <li key={c.recordId} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
                        <input
                          type="checkbox"
                          checked={!!capsSeleccionadas[c.recordId]}
                          onChange={(e) => setCapsSeleccionadas({ ...capsSeleccionadas, [c.recordId]: e.target.checked })}
                          className="w-4 h-4 mt-0.5 accent-blue-500"
                        />
                        <div className="flex-1">
                          <div className="text-white/90 text-sm">{c.tema}</div>
                          {c.fechaEjecucion && (
                            <div className="text-xs text-white/50">Ejecutada: {c.fechaEjecucion}</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-white">Novedades administrativas</h2>
                  <MicTranscribeButton
                    onTranscribed={(t) => setNovedades((p) => appendTranscripcion(p, t, "\n"))}
                    onError={setErrorMsg}
                  />
                </div>
                <textarea rows={3} value={novedades} onChange={(e) => setNovedades(e.target.value)} placeholder="Cambios de personal, cumplimiento de plan, etc." className="input w-full" />
              </section>
            </>
          )}

          {/* Específicos COCOLAB */}
          {!isCopasst && (
            <>
              <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Quejas y conflictos del periodo</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <BoolDetalle label="¿Quejas de acoso laboral?" value={quejasAcoso} onChange={setQuejasAcoso} detalle={quejasDetalle} onDetalle={setQuejasDetalle} onMicError={setErrorMsg} />
                  <BoolDetalle label="¿Conflictos laborales?" value={conflictos} onChange={setConflictos} detalle={conflictosDetalle} onDetalle={setConflictosDetalle} onMicError={setErrorMsg} />
                </div>
              </section>

              <Repeater
                titulo="Acciones preventivas y de promoción"
                items={acciones}
                setItems={setAcciones}
                nuevo={() => ({ categoria: "convivencia_laboral", descripcion: "" })}
                render={(a, set) => (
                  <>
                    <select value={a.categoria} onChange={(e) => set({ ...a, categoria: e.target.value })} className="input w-56">
                      {CATEGORIAS_COCOLAB.map((c) => (
                        <option key={c.v} value={c.v} className="bg-slate-900">{c.l}</option>
                      ))}
                    </select>
                    <div className="flex-1 flex items-center gap-1">
                      <input placeholder="Descripción de la acción" value={a.descripcion} onChange={(e) => set({ ...a, descripcion: e.target.value })} className="input flex-1" />
                      <MicTranscribeButton
                        variant="icon"
                        onTranscribed={(t) => set({ ...a, descripcion: appendTranscripcion(a.descripcion, t) })}
                        onError={setErrorMsg}
                      />
                    </div>
                  </>
                )}
              />
            </>
          )}

          {/* Compromisos */}
          <Repeater
            titulo="Compromisos y tareas"
            items={compromisos}
            setItems={setCompromisos}
            nuevo={() => ({ compromiso: "", responsable: "", fechaLimite: "" })}
            render={(c, set) => (
              <>
                <div className="flex-1 flex items-center gap-1">
                  <input placeholder="Compromiso" value={c.compromiso} onChange={(e) => set({ ...c, compromiso: e.target.value })} className="input flex-1" />
                  <MicTranscribeButton
                    variant="icon"
                    onTranscribed={(t) => set({ ...c, compromiso: appendTranscripcion(c.compromiso, t) })}
                    onError={setErrorMsg}
                  />
                </div>
                <select
                  value={c.responsable}
                  onChange={(e) => set({ ...c, responsable: e.target.value })}
                  className="input w-56"
                >
                  <option value="" className="bg-slate-900">Seleccionar responsable...</option>
                  {personal.map((p) => (
                    <option key={p.id} value={p.nombreCompleto} className="bg-slate-900">
                      {p.nombreCompleto}
                    </option>
                  ))}
                </select>
                <input type="date" value={c.fechaLimite} onChange={(e) => set({ ...c, fechaLimite: e.target.value })} className="input w-44" />
              </>
            )}
          />

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-400/30 px-4 py-3 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4" />
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-3 pb-12">
            <Link href={`/dashboard/comites/${comite}`} className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white/90 transition-colors">
              Cancelar
            </Link>
            <button
              onClick={submit}
              disabled={estado === "saving"}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              {estado === "saving" ? <Loader2 className="w-5 h-5 animate-spin" /> : estado === "ok" ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              {estado === "saving" ? "Guardando..." : estado === "ok" ? "Guardado" : "Guardar borrador"}
            </button>
          </div>
        </div>
      </main>

      {/* Modal de firma */}
      {modalAsistente && (
        <AsistenteFirmaModal
          isOpen={true}
          onClose={() => setModalAsistente(null)}
          miembroNombre={modalAsistente.nombre}
          miembroCedula={modalAsistente.cedula}
          miembroCargo={modalAsistente.cargo}
          miembroRecordId={modalAsistente.recordId}
          onFirmaGuardada={() => setModalAsistente(null)}
          onFirmaCapturada={(recordId, firmaDataUrl) => {
            setFirmasMap({ ...firmasMap, [recordId]: firmaDataUrl });
          }}
          comite={comite}
        />
      )}
    </div>
  );
}

function Field({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="block text-xs font-medium text-white/70">{label}</span>
        {action}
      </div>
      {children}
    </label>
  );
}

function BoolDetalle({
  label, value, onChange, detalle, onDetalle, onMicError,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void;
  detalle: string; onDetalle: (v: string) => void;
  onMicError?: (m: string) => void;
}) {
  return (
    <div>
      <div className="text-sm text-white/90 mb-2">{label}</div>
      <div className="flex gap-4 mb-2">
        <label className="inline-flex items-center gap-2 text-sm text-white/70">
          <input type="radio" checked={!value} onChange={() => onChange(false)} className="accent-blue-500" />
          No
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-white/70">
          <input type="radio" checked={value} onChange={() => onChange(true)} className="accent-blue-500" />
          Sí
        </label>
      </div>
      {value && (
        <>
          <div className="flex justify-end mb-1">
            <MicTranscribeButton
              onTranscribed={(t) => onDetalle(appendTranscripcion(detalle, t, "\n"))}
              onError={onMicError}
            />
          </div>
          <textarea rows={2} value={detalle} onChange={(e) => onDetalle(e.target.value)} placeholder="Detalle..." className="input w-full" />
        </>
      )}
    </div>
  );
}

function Repeater<T>({
  titulo, items, setItems, nuevo, render,
}: {
  titulo: string; items: T[]; setItems: (v: T[]) => void;
  nuevo: () => T; render: (item: T, set: (v: T) => void) => React.ReactNode;
}) {
  return (
    <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">{titulo}</h2>
        <button
          type="button"
          onClick={() => setItems([...items, nuevo()])}
          className="inline-flex items-center gap-1 text-sm bg-white/10 hover:bg-white/15 border border-white/15 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-white/40 italic text-sm">Sin registros.</p>
      ) : (
        <div className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="flex flex-wrap gap-2 items-center">
              {render(it, (v) => {
                const nx = [...items];
                nx[idx] = v;
                setItems(nx);
              })}
              <button
                type="button"
                onClick={() => setItems(items.filter((_, k) => k !== idx))}
                className="text-red-300 hover:text-red-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
