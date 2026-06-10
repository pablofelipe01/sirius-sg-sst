"use client";

import { useEffect, useState, useRef } from "react";
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Clock,
  Loader2,
  Award,
  AlertCircle,
  Check,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────

interface Pregunta {
  ppId: string;
  preguntaId: string;
  orden: number;
  puntajeAsignado: number;
  obligatoria: boolean;
  texto: string;
  tipo: string;
  opciones: string[];
  respuestaCorrecta: string;
  explicacion: string;
}

interface PlantillaDetail {
  id: string;
  nombre: string;
  descripcion: string;
  puntajeMinimo: number;
  tiempoLimite: number;
  intentosPermitidos: number;
  mostrarRetro: boolean;
}

// Detalle de cada respuesta del usuario (para el PDF unificado)
export interface RespuestaDetalle {
  orden: number;
  pregunta: string;
  opciones: string[];
  respuestaUsuario: string;
  respuestaCorrecta: string;
  esCorrecta: boolean;
  puntajeAsignado: number;
  puntajeObtenido: number;
}

export interface ResultadoEvaluacion {
  puntaje: number;
  puntajeObtenido: number;
  puntajeMaximo: number;
  aprobada: boolean;
  detalle: RespuestaDetalle[];
}

// ── Props ────────────────────────────────────────────────

interface EvaluacionInduccionProps {
  induccionId: string;
  idEmpleadoCore: string;
  nombreEmpleado: string;
  numeroDocumento: string;
  cargo?: string;
  onAprobada: (puntaje: number, resultado?: ResultadoEvaluacion) => void;
  onReprobada: (resultado?: ResultadoEvaluacion) => void;
}

// ════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════

export default function EvaluacionInduccion({
  induccionId,
  idEmpleadoCore,
  nombreEmpleado,
  numeroDocumento,
  cargo = "",
  onAprobada,
  onReprobada,
}: EvaluacionInduccionProps) {
  const draftKey = `sirius-induccion-eval-draft:${induccionId}:${idEmpleadoCore}`;
  type Screen = "loading" | "tomando" | "resultado" | "error";
  const [screen, setScreen] = useState<Screen>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [plantilla, setPlantilla] = useState<PlantillaDetail | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [puntajeObtenido, setPuntajeObtenido] = useState(0);
  const [puntajeMaximo, setPuntajeMaximo] = useState(0);
  const [porcentaje, setPorcentaje] = useState(0);
  const [aprobada, setAprobada] = useState(false);

  // Timer
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveDraft = (nextAnswers: Map<string, string>, nextIdx: number, nextSecondsLeft: number) => {
    if (typeof window === "undefined") return;

    const payload = {
      answers: Array.from(nextAnswers.entries()),
      currentIdx: nextIdx,
      secondsLeft: nextSecondsLeft,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(draftKey, JSON.stringify(payload));
  };

  const clearDraft = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(draftKey);
  };

  // ── Load evaluation ──────────────────────────────────────
  useEffect(() => {
    async function loadEval() {
      try {
        const params = new URLSearchParams({ induccionId, idEmpleadoCore });
        const res = await fetch(`/api/inducciones/evaluacion?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!json.success) throw new Error(json.message);

        const pend = json.pendientes?.[0];
        if (!pend || !pend.disponible) {
          throw new Error("No hay evaluación disponible o ya fue aprobada");
        }

        setPlantilla(json.plantilla);
        setPreguntas(json.preguntas);

        // Start timer if applicable
        if (json.plantilla.tiempoLimite > 0) {
          setSecondsLeft(json.plantilla.tiempoLimite * 60);
        }

        if (typeof window !== "undefined") {
          const rawDraft = localStorage.getItem(draftKey);
          if (rawDraft) {
            try {
              const parsed = JSON.parse(rawDraft) as {
                answers?: Array<[string, string]>;
                currentIdx?: number;
                secondsLeft?: number;
              };

              if (Array.isArray(parsed.answers)) {
                setAnswers(new Map(parsed.answers));
              }

              if (typeof parsed.currentIdx === "number" && parsed.currentIdx >= 0 && parsed.currentIdx < json.preguntas.length) {
                setCurrentIdx(parsed.currentIdx);
              }

              if (json.plantilla.tiempoLimite > 0 && typeof parsed.secondsLeft === "number" && parsed.secondsLeft > 0) {
                setSecondsLeft(parsed.secondsLeft);
              }
            } catch {
              // Ignorar draft corrupto y continuar limpio
            }
          }
        }

        setScreen("tomando");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Error cargando evaluación");
        setScreen("error");
      }
    }

    loadEval();
  }, [induccionId, idEmpleadoCore]);

  useEffect(() => {
    if (screen !== "tomando") return;
    saveDraft(answers, currentIdx, secondsLeft);
  }, [answers, currentIdx, secondsLeft, screen]);

  // ── Timer ───────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "tomando" || secondsLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, secondsLeft]);

  // ── Handle answer ───────────────────────────────────────
  const handleAnswer = (ppId: string, value: string) => {
    setAnswers((prev) => new Map(prev).set(ppId, value));
  };

  // ── Handle multiple answer (checkbox) ───────────────────
  const handleMultipleAnswer = (ppId: string, value: string) => {
    const current = answers.get(ppId) || "";
    const currentArray = current ? current.split("|") : [];
    const newArray = currentArray.includes(value)
      ? currentArray.filter((v) => v !== value)
      : [...currentArray, value];
    setAnswers((prev) => new Map(prev).set(ppId, newArray.join("|")));
  };

  // ── Auto-complete (solo DEV) ─────────────────────────────
  const handleAutoComplete = () => {
    const newAnswers = new Map<string, string>();
    preguntas.forEach((p) => {
      newAnswers.set(p.ppId, p.respuestaCorrecta);
    });
    setAnswers(newAnswers);
  };

  // ── Auto-submit (solo DEV) ───────────────────────────────
  const handleAutoSubmit = async () => {
    // Calcular todas las respuestas correctas
    const allAnswers = new Map<string, string>();
    preguntas.forEach((p) => {
      allAnswers.set(p.ppId, p.respuestaCorrecta);
    });

    // Actualizar estado para que se vea en la UI
    setAnswers(allAnswers);

    // Llamar submit con las respuestas calculadas directamente
    await handleSubmitWithAnswers(allAnswers);
  };

  // ── Submit con respuestas específicas ────────────────────
  const handleSubmitWithAnswers = async (answersToSubmit: Map<string, string>) => {
    if (submitting) return;
    setSubmitting(true);

    try {
      // Calcular puntaje
      let puntaje = 0;
      let max = 0;
      const detalle: RespuestaDetalle[] = [];

      preguntas.forEach((p) => {
        max += p.puntajeAsignado;
        const respuesta = answersToSubmit.get(p.ppId);

        let esCorrecta = false;

        if (respuesta) {
          // Para selección múltiple, comparar arrays
          if (p.tipo === "Selección Múltiple") {
            const respuestaArray = respuesta.split("|").sort();
            const correctaArray = p.respuestaCorrecta.split("|").sort();
            if (JSON.stringify(respuestaArray) === JSON.stringify(correctaArray)) {
              esCorrecta = true;
            }
          } else {
            // Para selección única, comparar strings
            if (respuesta.trim() === p.respuestaCorrecta.trim()) {
              esCorrecta = true;
            }
          }
        }

        if (esCorrecta) {
          puntaje += p.puntajeAsignado;
        }

        detalle.push({
          orden: p.orden,
          pregunta: p.texto,
          opciones: p.opciones,
          respuestaUsuario: respuesta ? respuesta.split("|").join(", ") : "Sin responder",
          respuestaCorrecta: p.respuestaCorrecta.split("|").join(", "),
          esCorrecta,
          puntajeAsignado: p.puntajeAsignado,
          puntajeObtenido: esCorrecta ? p.puntajeAsignado : 0,
        });
      });

      const porc = max > 0 ? Math.round((puntaje / max) * 100) : 0;
      const aprobadaResult = porc >= (plantilla?.puntajeMinimo || 70);

      setPuntajeObtenido(puntaje);
      setPuntajeMaximo(max);
      setPorcentaje(porc);
      setAprobada(aprobadaResult);

      const resultado: ResultadoEvaluacion = {
        puntaje: porc,
        puntajeObtenido: puntaje,
        puntajeMaximo: max,
        aprobada: aprobadaResult,
        detalle,
      };

      const res = await fetch("/api/inducciones/evaluacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          induccionId,
          idEmpleadoCore,
          puntajeEvaluacion: porc,
          estadoEvaluacion: aprobadaResult ? "Aprobada" : "No_Presentada",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || "Error al guardar resultado de evaluación");
      }

      setScreen("resultado");
      clearDraft();

      // Llamar callback según resultado
      if (aprobadaResult) {
        setTimeout(() => onAprobada(porc, resultado), 2000);
      } else {
        setTimeout(() => onReprobada(resultado), 2000);
      }
    } catch (error: any) {
      console.error("[EvaluacionInduccion] Error:", error);
      setErrorMsg(error.message || "Error al enviar evaluación");
      setScreen("error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit evaluation ───────────────────────────────────
  const handleSubmit = async () => {
    await handleSubmitWithAnswers(answers);
  };

  // ── Render: Loading ──────────────────────────────────────
  if (screen === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
        <p className="text-white font-medium">Cargando evaluación...</p>
      </div>
    );
  }

  // ── Render: Error ────────────────────────────────────────
  if (screen === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-white font-semibold text-lg">Error</p>
        <p className="text-slate-400 text-center">{errorMsg}</p>
      </div>
    );
  }

  // ── Render: Resultado ────────────────────────────────────
  if (screen === "resultado") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center ${
              aprobada ? "bg-emerald-500/20" : "bg-red-500/20"
            }`}
          >
            {aprobada ? (
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            ) : (
              <XCircle className="w-10 h-10 text-red-400" />
            )}
          </div>

          <div className="text-center">
            <h3 className={`text-2xl font-bold ${aprobada ? "text-emerald-400" : "text-red-400"}`}>
              {aprobada ? "¡Evaluación Aprobada!" : "Evaluación No Aprobada"}
            </h3>
            <p className="text-slate-400 mt-2">
              Puntaje: {puntajeObtenido} / {puntajeMaximo} ({porcentaje}%)
            </p>
            <p className="text-slate-500 text-sm">
              Puntaje mínimo requerido: {plantilla?.puntajeMinimo}%
            </p>
          </div>
        </div>

        {aprobada && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
            <p className="text-emerald-300 text-sm">
              ¡Felicitaciones! Ahora puedes continuar con la firma digital.
            </p>
          </div>
        )}

        {!aprobada && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-red-300 text-sm">
              Debes aprobar la evaluación para continuar con el proceso de inducción.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Tomando evaluación ───────────────────────────
  const currentPregunta = preguntas[currentIdx];
  const progress = ((currentIdx + 1) / preguntas.length) * 100;
  const canNext = currentIdx < preguntas.length - 1;
  const canPrev = currentIdx > 0;
  const currentAnswer = answers.get(currentPregunta?.ppId || "");

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            Pregunta {currentIdx + 1} de {preguntas.length}
          </span>
          {plantilla && plantilla.tiempoLimite > 0 && secondsLeft > 0 && (
            <div className="flex items-center gap-2 text-amber-400">
              <Clock className="w-4 h-4" />
              <span className="font-mono">
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Botones de Test (solo en desarrollo) */}
      {process.env.NODE_ENV === "development" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleAutoComplete}
            className="px-4 py-2 rounded-xl bg-yellow-500/20 border-2 border-yellow-500/50 text-yellow-300 font-medium hover:bg-yellow-500/30 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            [TEST] Auto-completar
          </button>
          <button
            type="button"
            onClick={handleAutoSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-300 font-medium hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Award className="w-5 h-5" />
            [TEST] Aprobar y Continuar
          </button>
        </div>
      )}

      {/* Pregunta */}
      {currentPregunta && (
        <div className="bg-white/5 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium text-lg leading-relaxed">{currentPregunta.texto}</p>
              {currentPregunta.obligatoria && (
                <span className="inline-block mt-2 text-xs text-red-400">* Obligatoria</span>
              )}
            </div>
          </div>

          {/* Opciones */}
          <div className="space-y-2 mt-4">
            {currentPregunta.tipo === "Selección Múltiple" ? (
              // Checkboxes para selección múltiple
              currentPregunta.opciones.map((opcion, idx) => {
                const currentAnswers = currentAnswer ? currentAnswer.split("|") : [];
                const isSelected = currentAnswers.includes(opcion);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleMultipleAnswer(currentPregunta.ppId, opcion)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-purple-500 bg-purple-500/20 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? "border-purple-500 bg-purple-500"
                            : "border-slate-500"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span>{opcion}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              // Radio buttons para selección única
              currentPregunta.opciones.map((opcion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAnswer(currentPregunta.ppId, opcion)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    currentAnswer === opcion
                      ? "border-purple-500 bg-purple-500/20 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        currentAnswer === opcion
                          ? "border-purple-500 bg-purple-500"
                          : "border-slate-500"
                      }`}
                    >
                      {currentAnswer === opcion && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span>{opcion}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCurrentIdx((prev) => prev - 1)}
          disabled={!canPrev}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        {canNext ? (
          <button
            type="button"
            onClick={() => setCurrentIdx((prev) => prev + 1)}
            className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors flex items-center gap-2"
          >
            Siguiente
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Award className="w-5 h-5" />
                Finalizar Evaluación
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
