"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Loader2,
  AlertTriangle,
  GraduationCap,
  ClipboardList,
  Link,
  Copy,
  Check,
  CheckCircle,
  Clock,
  Users,
  RefreshCw,
  X,
} from "lucide-react";

interface RegistroResumen {
  id: string;
  idRegistro: string;
  nombreEvento: string;
  ciudad: string;
  fecha: string;
  tipo: string;
  estado: string;
  cantidadAsistentes: number;
}

interface AsistenteDetalle {
  id: string;
  nombre: string;
  cedula: string;
  labor: string;
  firmaConfirmada: boolean;
}

interface RegistroDetalle {
  id: string;
  idRegistro: string;
  nombreEvento: string;
  fecha: string;
  ciudad: string;
  lugar: string;
  tipo?: string; // Tipo de evento
  temasTratados?: string; // Temas tratados
  progCapIds?: string[]; // IDs de programaciones vinculadas
  asistentes: AsistenteDetalle[];
}

interface EvalLinkItem {
  detalleRecordId: string;
  nombre: string;
  url: string;
}

export default function EvaluacionesPage() {
  const router = useRouter();

  // ── Lista de registros ────────────────────────────────────
  const [registros, setRegistros] = useState<RegistroResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Registro seleccionado ─────────────────────────────────
  const [detalle, setDetalle] = useState<RegistroDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // ── Links de evaluación ───────────────────────────────────
  const [evalLinks, setEvalLinks] = useState<EvalLinkItem[]>([]);
  const [generatingLinks, setGeneratingLinks] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Verificar si el evento tiene evaluaciones ─────────────
  const [hasEvaluaciones, setHasEvaluaciones] = useState(false);
  const [checkingEval, setCheckingEval] = useState(false);

  // ── Fetch registros ───────────────────────────────────────
  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/registros-asistencia");
      const json = await res.json();
      if (json.success) setRegistros(json.data);
      else setError(json.message || "Error cargando registros");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  // ── Seleccionar registro → cargar detalle ─────────────────
  const handleSelectRegistro = useCallback(async (id: string) => {
    setLoadingDetalle(true);
    setDetalle(null);
    setEvalLinks([]);
    setHasEvaluaciones(false);
    try {
      const res = await fetch(`/api/registros-asistencia/${id}`);
      const json = await res.json();
      if (json.success) {
        const registroDetalle = json.data as RegistroDetalle;
        setDetalle(registroDetalle);

        // Verificar si este evento tiene evaluaciones
        checkIfHasEvaluaciones(registroDetalle);
      }
      else setError(json.message || "Error cargando detalle");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoadingDetalle(false);
    }
  }, []);

  // ── Verificar si el evento tiene evaluaciones asociadas ───
  const checkIfHasEvaluaciones = useCallback(async (detalle: RegistroDetalle) => {
    if (!detalle.asistentes || detalle.asistentes.length === 0) {
      setHasEvaluaciones(false);
      return;
    }

    setCheckingEval(true);
    try {
      const idEmpleadoCores = detalle.asistentes
        .map((a) => a.cedula) // Usando cedula como proxy, ajustar si tienes idEmpleado
        .filter(Boolean);

      const progCapIds = detalle.progCapIds || [];

      const res = await fetch("/api/evaluaciones/check-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idEmpleadoCores,
          progCapIds,
          tipo: detalle.tipo,
          temasTratados: detalle.temasTratados
        }),
        cache: "no-store",
      });

      const json = await res.json();
      if (json.success) {
        setHasEvaluaciones(json.hasEvaluaciones ?? false);
      }
    } catch (err) {
      console.error("Error verificando evaluaciones:", err);
      setHasEvaluaciones(false);
    } finally {
      setCheckingEval(false);
    }
  }, []);

  // ── Generar enlaces de evaluación ─────────────────────────
  const generateEvalLinks = useCallback(async () => {
    if (!detalle) return;
    setGeneratingLinks(true);
    try {
      // Use all attendees (not just unsigned) — evaluation is independent of signature
      const asistentes = detalle.asistentes;
      if (asistentes.length === 0) return;

      const res = await fetch("/api/registros-asistencia/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: window.location.origin,
          asistentes: asistentes.map((a) => ({
            detalleRecordId: a.id,
            eventoRecordId: detalle.id,
            nombre: a.nombre,
            cedula: a.cedula,
          })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        const links: EvalLinkItem[] = json.tokens.map((t: { detalleRecordId: string; nombre: string; url: string }) => ({
          detalleRecordId: t.detalleRecordId,
          nombre: t.nombre,
          url: t.url,
        }));
        setEvalLinks(links);
      } else {
        setError("Error generando los enlaces");
      }
    } catch {
      setError("Error generando los enlaces");
    } finally {
      setGeneratingLinks(false);
    }
  }, [detalle]);

  // ── Copiar enlace ─────────────────────────────────────────
  const copyLink = useCallback(async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignore */ }
  }, []);

  const formatFecha = (raw: string) => {
    if (!raw) return "—";
    try {
      const d = new Date(raw + "T12:00:00");
      return d.toLocaleDateString("es-CO", {
        timeZone: "America/Bogota",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch { return raw; }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Image src="/20032025-DSC_3717.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <button
              onClick={() => router.push("/dashboard/registros-asistencia")}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/20 backdrop-blur-sm">
                <GraduationCap className="w-6 h-6 text-violet-300" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Iniciar Evaluaciones</h1>
                <p className="text-xs text-white/60">
                  Genera enlaces individuales de evaluación + firma para cada participante
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Panel izquierdo: lista de registros ─────────── */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-purple-300" />
                  <span className="text-sm font-semibold text-white">Registros de Asistencia</span>
                </div>
                <button
                  onClick={fetchRegistros}
                  disabled={loading}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="max-h-[520px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                  </div>
                ) : error ? (
                  <div className="p-5 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm text-white/60">{error}</p>
                  </div>
                ) : registros.length === 0 ? (
                  <div className="p-5 text-center">
                    <p className="text-sm text-white/40">No hay registros disponibles</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {registros.map((r) => (
                      <li key={r.id}>
                        <button
                          onClick={() => handleSelectRegistro(r.id)}
                          className={`w-full text-left px-5 py-4 transition-all hover:bg-white/10 ${detalle?.id === r.id ? "bg-violet-500/20 border-l-2 border-violet-400" : ""}`}
                        >
                          <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                            {r.nombreEvento}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-white/50">{formatFecha(r.fecha)}</span>
                            <span className="text-white/20">·</span>
                            <span className="flex items-center gap-1 text-xs text-white/50">
                              <Users className="w-3 h-3" />
                              {r.cantidadAsistentes}
                            </span>
                            <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              r.estado === "Cerrado"
                                ? "bg-slate-500/30 text-slate-300"
                                : "bg-green-500/20 text-green-300"
                            }`}>
                              {r.estado}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* ── Panel derecho: detalle + links ──────────────── */}
          <div className="flex-1 min-w-0">
            {loadingDetalle ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
              </div>
            ) : !detalle ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                  <GraduationCap className="w-7 h-7 text-white/30" />
                </div>
                <p className="text-white/40 text-sm">Selecciona un registro para generar los enlaces</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Cabecera del evento */}
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">Evento</p>
                      <h2 className="text-base font-bold text-white leading-snug">{detalle.nombreEvento}</h2>
                      <p className="text-sm text-white/50 mt-1">
                        {formatFecha(detalle.fecha)} · {detalle.ciudad}
                      </p>
                    </div>
                    <button
                      onClick={() => { setDetalle(null); setEvalLinks([]); }}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-all shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <Users className="w-4 h-4" />
                      <span>{detalle.asistentes.length} participante{detalle.asistentes.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-300">
                      <CheckCircle className="w-4 h-4" />
                      <span>{detalle.asistentes.filter((a) => a.firmaConfirmada).length} firmaron</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-amber-300">
                      <Clock className="w-4 h-4" />
                      <span>{detalle.asistentes.filter((a) => !a.firmaConfirmada).length} pendientes firma</span>
                    </div>
                  </div>
                </div>

                {/* Botón generar enlaces - Solo si tiene evaluaciones */}
                {hasEvaluaciones && evalLinks.length === 0 && (
                  <button
                    onClick={generateEvalLinks}
                    disabled={generatingLinks || detalle.asistentes.length === 0 || checkingEval}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-900/30"
                  >
                    {generatingLinks ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Generando enlaces…</>
                    ) : checkingEval ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Verificando…</>
                    ) : (
                      <><Link className="w-5 h-5" /> Generar enlaces de evaluación</>
                    )}
                  </button>
                )}

                {/* Mensaje informativo si NO tiene evaluaciones */}
                {!hasEvaluaciones && !checkingEval && evalLinks.length === 0 && (
                  <div className="w-full py-4 px-5 rounded-2xl bg-blue-500/10 border border-blue-400/30 text-center">
                    <div className="flex items-center justify-center gap-2 text-blue-300 mb-1">
                      <ClipboardList className="w-5 h-5" />
                      <span className="font-semibold">Este evento no requiere evaluación</span>
                    </div>
                    <p className="text-sm text-white/60">
                      Los participantes pueden firmar directamente sin completar una evaluación previa
                    </p>
                  </div>
                )}

                {/* Lista de enlaces */}
                {evalLinks.length > 0 && (
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <Link className="w-4 h-4 text-violet-300" />
                        <span className="text-sm font-semibold text-white">
                          {evalLinks.length} enlace{evalLinks.length !== 1 ? "s" : ""} generado{evalLinks.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <button
                        onClick={() => setEvalLinks([])}
                        className="text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
                      >
                        Limpiar
                      </button>
                    </div>

                    <div className="p-3 bg-violet-500/10 border-b border-white/5">
                      <p className="text-xs text-violet-200 leading-relaxed">
                        Comparte cada enlace al participante correspondiente. Al abrirlo,
                        podrá presentar su evaluación y luego firmar la asistencia.
                        Los enlaces son válidos por <strong>72 horas</strong>.
                      </p>
                    </div>

                    <ul className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                      {evalLinks.map((item) => {
                        const asistente = detalle.asistentes.find((a) => a.id === item.detalleRecordId);
                        return (
                          <li key={item.detalleRecordId} className="px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 text-xs font-bold shrink-0">
                                    {item.nombre.charAt(0).toUpperCase()}
                                  </div>
                                  <p className="text-sm font-medium text-white truncate">{item.nombre}</p>
                                  {asistente?.firmaConfirmada && (
                                    <span className="shrink-0 text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded-full font-medium">
                                      Firmó ✓
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-white/40 font-mono truncate pl-9">
                                  {item.url.replace(window.location.origin, "")}
                                </p>
                              </div>
                              <button
                                onClick={() => copyLink(item.url, item.detalleRecordId)}
                                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                  copiedId === item.detalleRecordId
                                    ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                    : "bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/20"
                                }`}
                              >
                                {copiedId === item.detalleRecordId ? (
                                  <><Check className="w-3.5 h-3.5" /> Copiado</>
                                ) : (
                                  <><Copy className="w-3.5 h-3.5" /> Copiar</>
                                )}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Copiar todos */}
                    <div className="px-5 py-4 border-t border-white/10">
                      <button
                        onClick={async () => {
                          const all = evalLinks
                            .map((l) => `${l.nombre}: ${l.url}`)
                            .join("\n");
                          await navigator.clipboard.writeText(all);
                          setCopiedId("__all__");
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                          copiedId === "__all__"
                            ? "bg-green-500/20 text-green-300 border border-green-500/30"
                            : "bg-white/10 hover:bg-white/20 text-white/70 border border-white/10"
                        }`}
                      >
                        {copiedId === "__all__" ? (
                          <><Check className="w-4 h-4" /> ¡Todos copiados!</>
                        ) : (
                          <><Copy className="w-4 h-4" /> Copiar todos los enlaces</>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista de asistentes (preview) */}
                {evalLinks.length === 0 && (
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                      <Users className="w-4 h-4 text-white/50" />
                      <span className="text-sm font-semibold text-white">Participantes</span>
                    </div>
                    <ul className="divide-y divide-white/5 max-h-64 overflow-y-auto">
                      {detalle.asistentes.map((a) => (
                        <li key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 text-xs font-bold shrink-0">
                              {a.nombre.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-white font-medium truncate">{a.nombre}</p>
                              <p className="text-xs text-white/40">{a.labor}</p>
                            </div>
                          </div>
                          {a.firmaConfirmada ? (
                            <span className="flex items-center gap-1 text-xs text-green-300 shrink-0">
                              <CheckCircle className="w-3.5 h-3.5" /> Firmó
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-amber-300/70 shrink-0">
                              <Clock className="w-3.5 h-3.5" /> Pendiente
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
