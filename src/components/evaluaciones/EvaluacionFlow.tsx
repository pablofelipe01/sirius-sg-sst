"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Clock,
  Loader2,
  Award,
  BookOpen,
  SkipForward,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────

interface PendienteEval {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  puntajeMinimo: number;
  tiempoLimite: number;
  intentosPermitidos: number;
  intentosRealizados: number;
  aprobada: boolean;
  disponible: boolean;
}

interface Pregunta {
  ppId: string;
  preguntaId: string;
  orden: number;
  puntajeAsignado: number;
  obligatoria: boolean;
  texto: string;
  tipo: string;           // Selección Única | Selección Múltiple | Verdadero/Falso | Escala Numérica | Respuesta Abierta
  opciones: string[];     // for single/multiple choice
  respuestaCorrecta: string;
  explicacion: string;
}

interface PlantillaDetail {
  id: string;
  nombre: string;
  descripcion: string;
  puntajeMinimo: number;
  tiempoLimite: number;    // minutes, 0 = unlimited
  intentosPermitidos: number;
  mostrarRetro: boolean;
}

interface ResultadoFinal {
  evalId: string;
  puntajeObtenido: number;
  puntajeMaximo: number;
  porcentaje: number;
  estado: "Aprobada" | "No Aprobada";
  puntajeMinimo: number;
  respuestas: Map<string, string>;
  preguntas: Pregunta[];
}

// ── Props ────────────────────────────────────────────────

interface EvaluacionFlowProps {
  idEmpleadoCore: string;
  nombres: string;
  cedula: string;
  cargo?: string;
  progCapId?: string;
  tipo?: string;             // tipo de evento
  temasTratados?: string;    // temas tratados
  onFinished?: () => void;   // called when user dismisses the evaluation flow
  allowSkip?: boolean;       // when false, hide skip/close buttons & auto-advance on approval (default true)
}

// ════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════

export default function EvaluacionFlow({
  idEmpleadoCore,
  nombres,
  cedula,
  cargo = "",
  progCapId,
  tipo,
  temasTratados,
  onFinished,
  allowSkip = true,
}: EvaluacionFlowProps) {
  type Screen = "loading" | "lista" | "tomando" | "resultado" | "vacio" | "error";
  const [screen, setScreen] = useState<Screen>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [pendientes, setPendientes] = useState<PendienteEval[]>([]);
  const [plantilla, setPlantilla] = useState<PlantillaDetail | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<ResultadoFinal | null>(null);
  const [intentoNumero, setIntentoNumero] = useState(1);

  // Timer
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ── Load pending evaluations ─────────────────────────
  const loadPendientes = useCallback(async () => {
    setScreen("loading");
    try {
      const params = new URLSearchParams({ idEmpleadoCore });
      if (progCapId) params.set("progCapId", progCapId);
      if (tipo) params.set("tipo", tipo);
      if (temasTratados) params.set("temasTratados", temasTratados);
      params.set("_t", Date.now().toString());
      const res = await fetch(`/api/evaluaciones/pendientes?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      if (!json.pendientes?.length) {
        setScreen("vacio");
      } else {
        setPendientes(json.pendientes);
        setScreen("lista");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error cargando evaluaciones");
      setScreen("error");
    }
  }, [idEmpleadoCore, progCapId, tipo, temasTratados]);

  useEffect(() => { loadPendientes(); }, [loadPendientes]);

  // ── Check remaining evaluations (for multi-eval flow) ──
  const checkRemainingEvals = useCallback(async () => {
    try {
      const params = new URLSearchParams({ idEmpleadoCore });
      if (progCapId) params.set("progCapId", progCapId);
      if (tipo) params.set("tipo", tipo);
      if (temasTratados) params.set("temasTratados", temasTratados);
      params.set("_t", Date.now().toString());
      const res = await fetch(`/api/evaluaciones/pendientes?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      const list: PendienteEval[] = json.pendientes || [];
      const stillPending = list.some((p) => p.disponible && !p.aprobada);
      if (!stillPending) {
        // All evaluations completed → advance to signature
        if (onFinished) onFinished();
      } else {
        // More evaluations remain → go back to list
        setPendientes(list);
        setScreen("lista");
      }
    } catch {
      // On error, fall back to showing the list
      loadPendientes();
    }
  }, [idEmpleadoCore, progCapId, onFinished, loadPendientes]);

  // ── Start an evaluation ──────────────────────────────
  const startEval = async (p: PendienteEval) => {
    setScreen("loading");
    try {
      const res = await fetch(`/api/evaluaciones/plantilla/${p.id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setPlantilla(json.plantilla);
      setPreguntas(json.preguntas);
      setCurrentIdx(0);
      setAnswers(new Map());
      setIntentoNumero(p.intentosRealizados + 1);
      startTimeRef.current = Date.now();
      if (json.plantilla.tiempoLimite > 0) {
        setSecondsLeft(json.plantilla.tiempoLimite * 60);
      } else {
        setSecondsLeft(0);
      }
      setScreen("tomando");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error cargando evaluación");
      setScreen("error");
    }
  };

  // ── Timer ────────────────────────────────────────────
  useEffect(() => {
    if (screen === "tomando" && secondsLeft > 0) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleSubmit(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ── Answer helpers ───────────────────────────────────
  const setAnswer = (preguntaId: string, value: string) => {
    setAnswers((prev) => new Map(prev).set(preguntaId, value));
  };

  const toggleMultiple = (preguntaId: string, opcion: string) => {
    setAnswers((prev) => {
      const current = prev.get(preguntaId) || "";
      const selected: string[] = current ? JSON.parse(current) : [];
      const idx = selected.indexOf(opcion);
      if (idx >= 0) selected.splice(idx, 1);
      else selected.push(opcion);
      return new Map(prev).set(preguntaId, JSON.stringify(selected));
    });
  };

  // ── Submit evaluation ────────────────────────────────
  const handleSubmit = useCallback(async (forced = false) => {
    if (!plantilla || submitting) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);

    const tiempoEmpleadoMin = Math.round((Date.now() - startTimeRef.current) / 60000);

    const respuestasPayload = preguntas.map((p, idx) => {
      const respuestaDada = answers.get(p.preguntaId) || "";
      const esCorrecta = evaluarCorrecta(p, respuestaDada);
      const puntajeObtenido = esCorrecta ? p.puntajeAsignado : 0;
      return {
        preguntaId: p.preguntaId,
        ppId: p.ppId,
        respuestaDada,
        esCorrecta,
        puntajeObtenido,
        tiempoSeg: 0,
        ordenPresentado: idx + 1,
      };
    });

    const puntajeMaximo = preguntas.reduce((s, p) => s + p.puntajeAsignado, 0);

    try {
      const res = await fetch("/api/evaluaciones/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantillaId: plantilla.id,
          idEmpleadoCore,
          nombres,
          cedula,
          cargo,
          progCapId,
          respuestas: respuestasPayload,
          puntajeMaximo,
          tiempoEmpleadoMin,
          intentoNumero,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      const resultData: ResultadoFinal = {
        evalId: json.evalId,
        puntajeObtenido: json.puntajeObtenido,
        puntajeMaximo: json.puntajeMaximo,
        porcentaje: json.porcentaje,
        estado: json.estado,
        puntajeMinimo: json.puntajeMinimo,
        respuestas: new Map(answers),
        preguntas: [...preguntas],
      };
      setResultado(resultData);
      setScreen("resultado");

      // When skip not allowed: after showing result, check remaining evals
      if (!allowSkip && json.estado === "Aprobada") {
        setTimeout(() => {
          checkRemainingEvals();
        }, 2500);
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al enviar evaluación");
      setScreen("error");
    } finally {
      setSubmitting(false);
      if (!forced) { /* user-initiated */ }
    }
  }, [plantilla, submitting, preguntas, answers, idEmpleadoCore, nombres, cedula, cargo, progCapId, intentoNumero, allowSkip, checkRemainingEvals]);

  // ── Evaluar correcta ─────────────────────────────────
  function evaluarCorrecta(p: Pregunta, respuestaDada: string): boolean {
    if (!respuestaDada) return false;
    if (p.tipo === "Respuesta Abierta") return false; // manual review

    // Para Selección Múltiple: comparar arrays normalizados
    if (p.tipo === "Selección Múltiple") {
      try {
        const dada: string[] = JSON.parse(respuestaDada);
        const correcta: string[] = JSON.parse(p.respuestaCorrecta);

        // Normalizar cada elemento y ordenar
        const dadaNormalized = dada
          .map(s => normalizeString(s))
          .filter(Boolean)
          .sort();
        const correctaNormalized = correcta
          .map(s => normalizeString(s))
          .filter(Boolean)
          .sort();

        return JSON.stringify(dadaNormalized) === JSON.stringify(correctaNormalized);
      } catch { return false; }
    }

    // Para otros tipos: comparación normalizada
    return normalizeString(respuestaDada) === normalizeString(p.respuestaCorrecta);
  }

  // Normaliza strings para comparación robusta
  function normalizeString(str: string): string {
    if (!str) return "";
    return str
      .trim()                           // Eliminar espacios al inicio/final
      .replace(/\s+/g, " ")             // Reducir espacios múltiples a uno solo
      .toLowerCase()                     // Case-insensitive
      .normalize("NFD")                  // Normalizar Unicode (descomponer acentos)
      .replace(/[\u0300-\u036f]/g, ""); // Eliminar marcas diacríticas
  }

  // ════════════════════════════════════════════════════
  // Render screens — wrapped to never return null
  // ════════════════════════════════════════════════════

  const renderScreen = () => {

  if (screen === "loading") return (
    <div className="flex flex-col items-center gap-3 py-8">
      <Loader2 className="w-7 h-7 text-[#0154AC] animate-spin" />
      <p className="text-sm text-slate-500">Cargando evaluaciones…</p>
    </div>
  );

  if (screen === "error") return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
      <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
      <p className="text-sm text-red-600">{errorMsg}</p>
      <button onClick={loadPendientes} className="mt-3 text-xs text-red-500 underline">
        Reintentar
      </button>
    </div>
  );

  if (screen === "vacio") return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
      <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-3" />
      <p className="text-sm font-semibold text-slate-700">No hay evaluaciones pendientes</p>
      <p className="text-xs text-slate-500 mt-1">No tienes evaluaciones requeridas para esta capacitación.</p>
      {onFinished && (
        <button
          onClick={onFinished}
          className="mt-4 px-4 py-2 bg-[#0154AC] text-white text-xs rounded-lg font-medium hover:bg-[#0143A0]"
        >
          {allowSkip ? "Cerrar" : "Continuar a firmar"}
        </button>
      )}
    </div>
  );

  if (screen === "lista") return (
    <div className="space-y-3">
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[#0154AC]" />
          <h3 className="text-sm font-bold text-slate-800">Evaluaciones disponibles</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1 ml-7">Evaluación de <span className="font-semibold text-slate-700">{nombres}</span></p>
      </div>
      {pendientes.map((p) => (
        <div
          key={p.id}
          className={`rounded-xl border p-4 ${
            p.aprobada
              ? "border-green-200 bg-green-50"
              : p.disponible
              ? "border-blue-200 bg-white"
              : "border-slate-200 bg-slate-50 opacity-60"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {p.aprobada ? (
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <BookOpen className="w-4 h-4 text-[#0154AC] shrink-0" />
                )}
                <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{p.nombre}</p>
              </div>
              {p.descripcion && (
                <p className="text-xs text-slate-500 leading-snug mb-2">{p.descripcion}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="bg-slate-100 px-2 py-0.5 rounded-full">Mín. {p.puntajeMinimo}%</span>
                {p.tiempoLimite > 0 && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3" />{p.tiempoLimite} min
                  </span>
                )}
                {p.intentosPermitidos > 1 && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded-full">
                    Intento {p.intentosRealizados + 1}/{p.intentosPermitidos}
                  </span>
                )}
                {p.aprobada && (
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Aprobada ✓</span>
                )}
              </div>
            </div>
            {p.disponible && !p.aprobada && (
              <button
                onClick={() => startEval(p)}
                className="shrink-0 px-3 py-2 bg-[#0154AC] text-white text-xs rounded-lg font-medium hover:bg-[#0143A0] flex items-center gap-1"
              >
                Iniciar <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
      {allowSkip && onFinished && (
        <button
          onClick={onFinished}
          className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1"
        >
          <SkipForward className="w-3.5 h-3.5" /> Omitir evaluaciones
        </button>
      )}
    </div>
  );

  if (screen === "tomando" && plantilla && preguntas.length > 0) {
    const pregunta = preguntas[currentIdx];
    const answer = answers.get(pregunta.preguntaId) || "";
    const isLast = currentIdx === preguntas.length - 1;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">{plantilla.nombre}</p>
            <p className="text-xs text-slate-500">Evaluación de <span className="font-semibold text-slate-700">{nombres}</span></p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              Pregunta {currentIdx + 1} de {preguntas.length}
            </p>
          </div>
          {secondsLeft > 0 && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold ${
              secondsLeft < 60 ? "bg-red-100 text-red-600" : "bg-blue-50 text-[#0154AC]"
            }`}>
              <Clock className="w-4 h-4" />
              {formatTime(secondsLeft)}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div
            className="bg-[#0154AC] h-1.5 rounded-full transition-all"
            style={{ width: `${((currentIdx + 1) / preguntas.length) * 100}%` }}
          />
        </div>

        {/* Question card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 leading-relaxed mb-4">{pregunta.texto}</p>

          <QuestionInput
            pregunta={pregunta}
            answer={answer}
            onAnswer={(v) => setAnswer(pregunta.preguntaId, v)}
            onToggle={(v) => toggleMultiple(pregunta.preguntaId, v)}
          />
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentIdx > 0 && (
            <button
              onClick={() => setCurrentIdx((i) => i - 1)}
              className="px-4 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
          )}
          <div className="flex-1" />
          {!isLast ? (
            <button
              onClick={() => setCurrentIdx((i) => i + 1)}
              className="px-5 py-3 rounded-xl bg-[#0154AC] text-white text-sm font-semibold hover:bg-[#0143A0] flex items-center gap-1 shadow"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => handleSubmit()}
              disabled={submitting}
              className="px-5 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 flex items-center gap-1 shadow disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
              Enviar evaluación
            </button>
          )}
        </div>
      </div>
    );
  }

  if (screen === "resultado" && resultado) {
    const aprobada = resultado.estado === "Aprobada"; // "No Aprobada" = reprobada
    return (
      <div className="space-y-4">
        {/* Result card */}
        <div className={`rounded-2xl border p-6 ${
          aprobada ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
        }`}>
          <div className="flex flex-col items-center text-center mb-4">
            {aprobada ? (
              <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
            ) : (
              <XCircle className="w-12 h-12 text-red-400 mb-3" />
            )}
            <h3 className={`text-xl font-bold mb-1 ${aprobada ? "text-green-700" : "text-red-600"}`}>
              {aprobada ? "¡Evaluación Aprobada!" : "Evaluación No Aprobada"}
            </h3>
            <p className="text-sm text-slate-600">
              {aprobada
                ? "¡Felicitaciones! Has superado el puntaje mínimo."
                : `Necesitas al menos ${resultado.puntajeMinimo}% para aprobar.`}
            </p>
          </div>

          {/* Score */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white rounded-xl p-3">
              <p className="text-2xl font-bold text-slate-800">{Number(resultado.porcentaje).toFixed(2)}%</p>
              <p className="text-xs text-slate-500">Tu puntaje</p>
            </div>
            <div className="bg-white rounded-xl p-3">
              <p className="text-2xl font-bold text-slate-800">{resultado.puntajeMinimo}%</p>
              <p className="text-xs text-slate-500">Mínimo</p>
            </div>
            <div className="bg-white rounded-xl p-3">
              <p className="text-2xl font-bold text-slate-800">
                {Number(resultado.puntajeObtenido).toFixed(2)}/{Number(resultado.puntajeMaximo).toFixed(2)}
              </p>
              <p className="text-xs text-slate-500">Puntos</p>
            </div>
          </div>
        </div>

        {/* Retroalimentación */}
        {plantilla?.mostrarRetro && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Retroalimentación</p>
            {resultado.preguntas.map((p, i) => {
              const respDada = resultado.respuestas.get(p.preguntaId) || "";
              const isOk = evaluarCorrecta(p, respDada);
              return (
                <div key={p.preguntaId} className={`rounded-lg p-3 text-sm border ${
                  isOk ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"
                }`}>
                  <p className="font-medium text-slate-700 mb-1">{i + 1}. {p.texto}</p>
                  <div className="flex items-start gap-1.5 text-xs">
                    {isOk ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                    )}
                    <span className={isOk ? "text-green-700" : "text-red-600"}>
                      {respDada
                        ? `Respondiste: ${respDada.startsWith("[") ? JSON.parse(respDada).join(", ") : respDada}`
                        : "Sin respuesta"}
                    </span>
                  </div>
                  {!isOk && p.respuestaCorrecta && p.tipo !== "Respuesta Abierta" && (
                    <p className="text-xs text-slate-500 mt-1 ml-5">
                      Respuesta correcta: {p.respuestaCorrecta.startsWith("[")
                        ? JSON.parse(p.respuestaCorrecta).join(", ")
                        : p.respuestaCorrecta}
                    </p>
                  )}
                  {p.explicacion && (
                    <p className="text-xs text-slate-500 mt-1 ml-5 italic">{p.explicacion}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* If approved & not allowSkip → checking remaining evals */}
        {!allowSkip && resultado.estado === "Aprobada" ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-green-600 font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            Verificando evaluaciones restantes…
          </div>
        ) : (
          <>
            {/* Show retry / return to list button */}
            {(resultado.estado !== "Aprobada" || allowSkip) && (
              <button
                onClick={() => { loadPendientes(); }}
                className="w-full py-3 rounded-xl bg-[#0154AC] text-white text-sm font-semibold hover:bg-[#0143A0]"
              >
                {resultado.estado === "Aprobada" ? "Ver evaluaciones" : "Intentar de nuevo"}
              </button>
            )}
            {allowSkip && onFinished && (
              <button
                onClick={onFinished}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-600"
              >
                Cerrar
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // Fallback — should never reach here
  return (
    <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-5 text-center">
      <p className="text-sm font-bold text-orange-700">Estado inesperado: {screen}</p>
      <p className="text-xs text-orange-600 mt-1">pendientes: {pendientes.length} | plantilla: {plantilla ? "sí" : "no"} | preguntas: {preguntas.length}</p>
      <button onClick={loadPendientes} className="mt-3 text-xs text-orange-500 underline">
        Reintentar
      </button>
    </div>
  );

  }; // end renderScreen

  return renderScreen();
}

// ════════════════════════════════════════════════════════
// Question Input Component
// ════════════════════════════════════════════════════════

function QuestionInput({
  pregunta,
  answer,
  onAnswer,
  onToggle,
}: {
  pregunta: Pregunta;
  answer: string;
  onAnswer: (v: string) => void;
  onToggle: (v: string) => void;
}) {
  const { tipo, opciones } = pregunta;

  if (tipo === "Selección Única") {
    return (
      <div className="space-y-2">
        {opciones.map((op) => (
          <label
            key={op}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              answer === op
                ? "border-[#0154AC] bg-blue-50"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name={pregunta.preguntaId}
              value={op}
              checked={answer === op}
              onChange={() => onAnswer(op)}
              className="accent-[#0154AC]"
            />
            <span className="text-sm text-slate-700">{op}</span>
          </label>
        ))}
      </div>
    );
  }

  if (tipo === "Selección Múltiple") {
    const selected: string[] = answer ? JSON.parse(answer) : [];
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-400 mb-2">Selecciona todas las respuestas correctas</p>
        {opciones.map((op) => (
          <label
            key={op}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              selected.includes(op)
                ? "border-[#0154AC] bg-blue-50"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(op)}
              onChange={() => onToggle(op)}
              className="accent-[#0154AC]"
            />
            <span className="text-sm text-slate-700">{op}</span>
          </label>
        ))}
      </div>
    );
  }

  if (tipo === "Verdadero/Falso") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {["Verdadero", "Falso"].map((op) => (
          <button
            key={op}
            onClick={() => onAnswer(op)}
            className={`py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
              answer === op
                ? op === "Verdadero"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-red-400 bg-red-50 text-red-600"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            {op === "Verdadero" ? "✓ Verdadero" : "✗ Falso"}
          </button>
        ))}
      </div>
    );
  }

  if (tipo === "Escala Numérica") {
    const max = opciones.length > 0 ? opciones.length : 5;
    const nums = Array.from({ length: max }, (_, i) => String(i + 1));
    return (
      <div className="flex gap-2 flex-wrap">
        {nums.map((n) => (
          <button
            key={n}
            onClick={() => onAnswer(n)}
            className={`w-10 h-10 rounded-full border-2 text-sm font-bold transition-all ${
              answer === n
                ? "border-[#0154AC] bg-[#0154AC] text-white"
                : "border-slate-200 text-slate-600 hover:border-[#0154AC]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  if (tipo === "Respuesta Abierta") {
    return (
      <textarea
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
        placeholder="Escribe tu respuesta aquí…"
        rows={4}
        className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0154AC]/30 resize-none"
      />
    );
  }

  return <p className="text-xs text-slate-400">Tipo de pregunta no soportado: {tipo}</p>;
}
