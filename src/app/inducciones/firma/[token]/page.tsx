"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense, type ReactNode } from "react";
import {
  PenTool,
  Eraser,
  Check,
  AlertCircle,
  CheckCircle,
  Loader2,
  CalendarDays,
  User,
  ShieldCheck,
  GraduationCap,
  FileText,
  Clock,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { formatFechaColombia } from "@/shared/utils";
import EvaluacionInduccion, { type ResultadoEvaluacion } from "@/components/evaluaciones/EvaluacionInduccion";

// ══════════════════════════════════════════════════════════
// Canvas de Firma
// ══════════════════════════════════════════════════════════
function SignatureCanvas({
  onConfirm,
  loading,
}: {
  onConfirm: (dataUrl: string) => void;
  loading: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasStrokes = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
    hasStrokes.current = true;
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a33";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => { isDrawing.current = false; };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasStrokes.current = false;
    setIsEmpty(true);
  };

  const handleConfirm = () => {
    if (!canvasRef.current || !hasStrokes.current) return;
    onConfirm(canvasRef.current.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-white shadow-inner">
        <canvas
          ref={canvasRef}
          width={700}
          height={220}
          className="w-full h-[180px] sm:h-[200px] cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={clearCanvas}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
        >
          <Eraser className="w-4 h-4" />
          Limpiar
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={isEmpty || loading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Confirmar Firma
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function InduccionesBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10">
        <Image src="/20032025-DSC_3717.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

interface InduccionFirmaData {
  idInduccion: string;
  idEmpleadoCore: string;
  nombreEmpleado: string;
  numeroDocumento: string;
  cargo: string;
  tipo: string;
  fechaRealizacion: string;
  responsableSST?: string;
  fechaIngreso?: string; // De tabla Personal (Nómina)
}

// ══════════════════════════════════════════════════════════
// Página Principal de Firma
// ══════════════════════════════════════════════════════════
function FirmarInduccionContent() {
  const params = useParams();
  const token = params?.token as string;

  const [step, setStep] = useState<"loading" | "data" | "contenido" | "evaluacion" | "sign" | "constancia" | "success" | "error">("loading");
  const [induccion, setInduccion] = useState<InduccionFirmaData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [puntajeEvaluacion, setPuntajeEvaluacion] = useState<number | null>(null);
  const [evaluacionResultado, setEvaluacionResultado] = useState<ResultadoEvaluacion | null>(null);

  // Estado para los campos de la constancia
  const [constanciaData, setConstanciaData] = useState({
    fechaRealizacion: "",
    lugarRealizacion: "",
    lugarOtro: "",
    horaInicio: "",
    horaFin: "",
    responsableSST: "",
    observaciones: "",
  });

  // Estado para checkbox de confirmación de nota
  const [notaConfirmada, setNotaConfirmada] = useState(false);

  // Estado para los temas de la constancia (checkboxes) - TODOS predeterminados en Sí (true)
  const [temasConstancia, setTemasConstancia] = useState({
    // Administrativo
    responsabilidadEmpleado: true,
    reglamentoInterno: true,
    afiliacionSeguridad: true,
    protocoloActividades: true,
    pqrs: true,
    deberesDerechos: true,
    // SST
    reglamentoHigiene: true,
    descripcionSGSST: true,
    epp: true,
    politicasObjetivos: true,
    politicaNoAlcohol: true,
    politicaVial: true,
    politicaAmbiental: true,
    politicaAcoso: true,
    politicaEPP: true,
    matrizIPVRDC: true,
    identificacionRiesgos: true,
    copasst: true,
    cocolab: true,
    definicionAcoso: true,
    riesgosHerramientas: true,
    planEmergencia: true,
    brigadas: true,
    procedimientoAccidente: true,
    reporteActos: true,
    procedimientoEmergencia: true,
    // Medio Ambiente
    aspectosAmbientales: true,
    controlDerrames: true,
    reporteIncendios: true,
  });

  // Cargar datos de la inducción
  useEffect(() => {
    if (!token) {
      setError("Token de firma no válido");
      setStep("error");
      return;
    }

    const fetchInduccion = async () => {
      try {
        const res = await fetch(`/api/inducciones/token/${token}`);
        const data = await res.json();

        if (!data.success) {
          setError(data.message || "Token inválido o expirado");
          setStep("error");
          return;
        }

        setInduccion(data.data);

        // Pre-poblar datos de la constancia con la información del registro
        setConstanciaData((prev) => ({
          ...prev,
          fechaRealizacion: prev.fechaRealizacion || data.data.fechaRealizacion || "",
          responsableSST: prev.responsableSST || data.data.responsableSST || "",
        }));

        setStep("data");
      } catch (err: unknown) {
        console.error("Error cargando inducción:", err);
        setError("Error al cargar los datos");
        setStep("error");
      }
    };

    fetchInduccion();
  }, [token]);

  const handleConfirmSignature = async (signatureDataUrl: string) => {
    setLoading(true);
    try {
      if (!induccion) {
        setError("Error: datos de inducción no disponibles");
        setStep("error");
        return;
      }

      // 1. Procesar y guardar la firma
      const res = await fetch(`/api/inducciones/firma/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmaDataUrl: signatureDataUrl }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Error al procesar la firma");
        setStep("error");
        return;
      }

      // 2. Guardar la constancia (datos ya recolectados antes de firmar)
      const lugarFinal = constanciaData.lugarRealizacion === "Otro" ? constanciaData.lugarOtro : constanciaData.lugarRealizacion;

      const resConstancia = await fetch("/api/inducciones/constancia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          induccionId: induccion.idInduccion,
          fechaRealizacion: constanciaData.fechaRealizacion,
          lugarRealizacion: lugarFinal,
          horaInicio: constanciaData.horaInicio,
          horaFin: constanciaData.horaFin,
          responsableSST: constanciaData.responsableSST,
          observaciones: constanciaData.observaciones,
        }),
      });

      const dataConstancia = await resConstancia.json();

      if (!dataConstancia.success) {
        setError(dataConstancia.message || "Error al guardar la constancia");
        setStep("error");
        return;
      }

      // 3. Generar documento unificado (constancia + evaluación + certificado)
      try {
        await fetch("/api/inducciones/documento-unificado", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            induccionId: induccion.idInduccion,
            constancia: {
              fechaRealizacion: constanciaData.fechaRealizacion,
              lugarRealizacion: lugarFinal,
              horaInicio: constanciaData.horaInicio,
              horaFin: constanciaData.horaFin,
              responsableSST: constanciaData.responsableSST,
              observaciones: constanciaData.observaciones,
              temas: temasConstancia,
            },
            evaluacion: evaluacionResultado,
          }),
        });
      } catch (errDoc) {
        // No bloquear el flujo si la generación del PDF falla; se puede regenerar luego
        console.error("Error generando documento unificado:", errDoc);
      }

      // 4. Proceso completado
      setStep("success");
    } catch (err: unknown) {
      console.error("Error procesando firma:", err);
      setError("Error al procesar la firma");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════
  // STEP: Loading
  // ════════════════════════════════════════════════════════
  if (step === "loading") {
    return (
      <InduccionesBackdrop>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto" />
            <p className="text-slate-300 text-lg font-medium">Cargando datos...</p>
          </div>
        </div>
      </InduccionesBackdrop>
    );
  }

  // ════════════════════════════════════════════════════════
  // STEP: Error
  // ════════════════════════════════════════════════════════
  if (step === "error") {
    return (
      <InduccionesBackdrop>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white">Error</h2>
              <p className="text-slate-300">{error}</p>
            </div>
          </div>
        </div>
      </InduccionesBackdrop>
    );
  }

  // ════════════════════════════════════════════════════════
  // STEP: Constancia (Nuevo paso)
  // ════════════════════════════════════════════════════════
  if (step === "constancia" && induccion) {
    const temas = [
      {
        area: "Administrativo",
        items: [
          { key: "responsabilidadEmpleado", tema: "Responsabilidad con el empleado" },
          { key: "reglamentoInterno", tema: "Reglamento Interno de Trabajo" },
          { key: "afiliacionSeguridad", tema: "Afiliación al Sistema de Seguridad Social" },
          { key: "protocoloActividades", tema: "Protocolo sobre las actividades agrícolas a desarrollar" },
          { key: "pqrs", tema: "Socialización del procedimiento de PQRS" },
          { key: "deberesDerechos", tema: "Deberes y derechos de los trabajadores" },
        ],
      },
      {
        area: "Seguridad y Salud en el Trabajo",
        items: [
          { key: "reglamentoHigiene", tema: "Reglamento de Higiene y Seguridad industrial" },
          { key: "descripcionSGSST", tema: "Descripción del SG-SST" },
          { key: "epp", tema: "EPP (Elementos de protección personal)" },
          { key: "politicasObjetivos", tema: "Políticas del SG-SST y Objetivos del SG-SST" },
          { key: "politicaNoAlcohol", tema: "Política de NO alcohol, drogas y tabaco" },
          { key: "politicaVial", tema: "Política de Seguridad Vial" },
          { key: "politicaAmbiental", tema: "Política Ambiental" },
          { key: "politicaAcoso", tema: "Política de Acoso Laboral" },
          { key: "politicaEPP", tema: "Política de EPP" },
          { key: "matrizIPVRDC", tema: "Matriz de IPVRDC. Factores de riesgo al cargo" },
          { key: "identificacionRiesgos", tema: "Identificación y clasificación de Riesgos y Peligros" },
          { key: "copasst", tema: "COPASST – Integrantes, Responsabilidades" },
          { key: "cocolab", tema: "COCOLAB (Comité de convivencia laboral)" },
          { key: "definicionAcoso", tema: "Definición de Acoso Laboral y qué hacer" },
          { key: "riesgosHerramientas", tema: "Riesgos asociados a herramientas mecánicas" },
          { key: "planEmergencia", tema: "Plan de emergencia (Puntos de Encuentro y Rutas)" },
          { key: "brigadas", tema: "Brigadas de Emergencia" },
          { key: "procedimientoAccidente", tema: "Procedimiento en caso de accidente de trabajo" },
          { key: "reporteActos", tema: "Reporte de Actos y Condiciones Inseguras" },
          { key: "procedimientoEmergencia", tema: "Procedimiento en caso de emergencia" },
        ],
      },
      {
        area: "Medio Ambiente",
        items: [
          { key: "aspectosAmbientales", tema: "Aspectos e Impactos Ambientales" },
          { key: "controlDerrames", tema: "Atención y Control de Derrames" },
          { key: "reporteIncendios", tema: "Reporte de Incendios Forestales" },
        ],
      },
    ];

    return (
      <InduccionesBackdrop>
        <div className="min-h-screen p-4">
          <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">Certificación de Inducción y/o Reinducción del Personal</h2>
                <p className="text-sm text-slate-400 mt-1">SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC - NIT: 901.377.064-8</p>
              </div>
            </div>
          </div>

          {/* Información del empleado */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Nombre</label>
                <p className="text-white font-semibold mt-1">{induccion.nombreEmpleado}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Fecha de Inducción</label>
                <p className="text-white font-semibold mt-1">{formatFechaColombia(induccion.fechaRealizacion)}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Cargo</label>
                <p className="text-white font-semibold mt-1">{induccion.cargo}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Fecha de Ingreso</label>
                <p className="text-white font-semibold mt-1">
                  {induccion.fechaIngreso ? formatFechaColombia(induccion.fechaIngreso) : "Sin información"}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">Fecha de Realización *</label>
                <input
                  type="date"
                  value={constanciaData.fechaRealizacion}
                  onChange={(e) => setConstanciaData({...constanciaData, fechaRealizacion: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-white/20 text-white focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">Hora de Inicio *</label>
                <input
                  type="time"
                  value={constanciaData.horaInicio}
                  onChange={(e) => setConstanciaData({...constanciaData, horaInicio: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-white/20 text-white focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">Hora de Fin *</label>
                <input
                  type="time"
                  value={constanciaData.horaFin}
                  onChange={(e) => setConstanciaData({...constanciaData, horaFin: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-white/20 text-white focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">Lugar *</label>
                <select
                  value={constanciaData.lugarRealizacion}
                  onChange={(e) => setConstanciaData({...constanciaData, lugarRealizacion: e.target.value, lugarOtro: e.target.value === "Otro" ? constanciaData.lugarOtro : ""})}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-white/20 text-white focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value="" className="bg-slate-800 text-slate-400">Seleccionar lugar...</option>
                  <option value="Oficina Principal" className="bg-slate-800 text-white">Oficina Principal</option>
                  <option value="Remoto - Virtual" className="bg-slate-800 text-white">Remoto - Virtual</option>
                  <option value="Otro" className="bg-slate-800 text-white">Otro (especificar)</option>
                </select>
                {constanciaData.lugarRealizacion === "Otro" && (
                  <input
                    type="text"
                    value={constanciaData.lugarOtro}
                    onChange={(e) => setConstanciaData({...constanciaData, lugarOtro: e.target.value})}
                    placeholder="Especificar lugar..."
                    className="w-full mt-3 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    required
                  />
                )}
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">Responsable SST *</label>
                <input
                  type="text"
                  value={constanciaData.responsableSST}
                  onChange={(e) => setConstanciaData({...constanciaData, responsableSST: e.target.value})}
                  placeholder="Nombre del responsable de SST"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-white/20 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tipo</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-white cursor-not-allowed">
                    <input type="radio" checked={induccion.tipo === "Induccion"} readOnly className="w-4 h-4" />
                    <span className="text-sm">Inducción</span>
                  </label>
                  <label className="flex items-center gap-2 text-white cursor-not-allowed">
                    <input type="radio" checked={induccion.tipo === "Reinduccion"} readOnly className="w-4 h-4" />
                    <span className="text-sm">Reinducción</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Declaración */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
            <p className="text-white text-sm leading-relaxed">
              Certifico haber recibido capacitación de la empresa <strong>SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC</strong>,
              con Nit: <strong>901.377.064-8</strong> en aspectos de Seguridad y salud en el trabajo y todos los lineamientos,
              estándares, procedimientos, legislación aplicable y políticas relacionadas con la ejecución segura de mi labor.
            </p>
          </div>

          {/* Tabla de temas */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/10 border-b border-white/10">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white w-16">N.º</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Área</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Tema</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white w-16">Sí</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white w-16">No</th>
                  </tr>
                </thead>
                <tbody>
                  {temas.map((seccion, idx) => (
                    seccion.items.map((item, itemIdx) => (
                      <tr key={item.key} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-400 font-mono">{idx + 1}.{itemIdx + 1}</td>
                        <td className="px-4 py-3 text-sm text-white font-medium">{itemIdx === 0 ? seccion.area : ""}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{item.tema}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={temasConstancia[item.key as keyof typeof temasConstancia]}
                            onChange={(e) => setTemasConstancia({ ...temasConstancia, [item.key]: e.target.checked })}
                            className="w-5 h-5 rounded border-slate-500 bg-white/10 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={!temasConstancia[item.key as keyof typeof temasConstancia]}
                            onChange={(e) => setTemasConstancia({ ...temasConstancia, [item.key]: !e.target.checked })}
                            className="w-5 h-5 rounded border-slate-500 bg-white/10 cursor-pointer"
                          />
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nota y confirmación */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
            <p className="text-amber-200 text-sm font-semibold mb-4">NOTA:</p>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={notaConfirmada}
                onChange={(e) => setNotaConfirmada(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded border-amber-500/50 bg-white/10 cursor-pointer flex-shrink-0"
                required
              />
              <span className="text-white text-sm leading-relaxed group-hover:text-amber-100 transition-colors">
                Certifico que he comprendido todos los temas expuestos en la inducción de SST,
                logrando así comprender los peligros y comprometiéndome a implementar los controles respectivos.
              </span>
            </label>
          </div>

          {/* Botones */}
          <div className="flex items-center gap-3 pb-8">
            <button
              type="button"
              onClick={() => setStep("evaluacion")}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
            >
              ← Volver
            </button>

            <button
              type="button"
              onClick={() => setStep("sign")}
              disabled={
                !constanciaData.fechaRealizacion ||
                !constanciaData.horaInicio ||
                !constanciaData.horaFin ||
                !constanciaData.lugarRealizacion ||
                (constanciaData.lugarRealizacion === "Otro" && !constanciaData.lugarOtro) ||
                !constanciaData.responsableSST ||
                !notaConfirmada
              }
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <PenTool className="w-5 h-5" />
              Continuar a Firma
            </button>
          </div>

          {!notaConfirmada && (
            <p className="text-amber-400 text-sm text-center -mt-4 pb-4">
              * Debe confirmar que ha comprendido todos los temas para continuar
            </p>
          )}
          </div>
        </div>
      </InduccionesBackdrop>
    );
  }

  // ════════════════════════════════════════════════════════
  // STEP: Success
  // ════════════════════════════════════════════════════════
  if (step === "success") {
    return (
      <InduccionesBackdrop>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
          </div>

          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-white">¡Proceso Completado! 🎉</h2>
            <p className="text-slate-300 text-lg">
              Has finalizado exitosamente el proceso de {induccion?.tipo || "inducción"}
            </p>

            {/* Resumen del proceso */}
            <div className="bg-white/5 rounded-xl p-6 space-y-3 text-left">
              <h3 className="text-white font-semibold text-center mb-4">Resumen del Proceso</h3>

              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Evaluación aprobada</p>
                  {puntajeEvaluacion && (
                    <p className="text-sm text-slate-400">Puntaje: {puntajeEvaluacion}%</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Firma digital registrada</p>
                  <p className="text-sm text-slate-400">Firma encriptada y guardada</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Constancia completada</p>
                  <p className="text-sm text-slate-400">Datos guardados correctamente</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Firma guardada de forma segura</span>
            </div>
          </div>
          </div>
        </div>
      </InduccionesBackdrop>
    );
  }

  // ════════════════════════════════════════════════════════
  // STEP: Data → mostrar info y botón para firmar
  // ════════════════════════════════════════════════════════
  if (step === "data" && induccion) {
    return (
      <InduccionesBackdrop>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-white/10">
            <Image
              src="/logo.png"
              alt="Sirius"
              width={60}
              height={60}
              className="rounded-xl"
              style={{ width: 'auto', height: 'auto' }}
            />
            <div>
              <h1 className="text-2xl font-bold text-white">Firma de Inducción</h1>
              <p className="text-slate-400">Sistema de Gestión SG-SST</p>
            </div>
          </div>

          {/* Información de la inducción */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-emerald-400 mt-1" />
              <div>
                <p className="text-sm text-slate-400">Empleado</p>
                <p className="text-white font-semibold">{induccion.nombreEmpleado}</p>
                <p className="text-sm text-slate-400">CC: {induccion.numeroDocumento}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <GraduationCap className="w-5 h-5 text-blue-400 mt-1" />
              <div>
                <p className="text-sm text-slate-400">Tipo</p>
                <p className="text-white font-semibold">{induccion.tipo}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CalendarDays className="w-5 h-5 text-purple-400 mt-1" />
              <div>
                <p className="text-sm text-slate-400">Fecha de Realización</p>
                <p className="text-white font-semibold">
                  {formatFechaColombia(induccion.fechaRealizacion)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-amber-400 mt-1" />
              <div>
                <p className="text-sm text-slate-400">ID Inducción</p>
                <p className="text-white font-semibold font-mono">{induccion.idInduccion}</p>
              </div>
            </div>
          </div>

          {/* Botón para iniciar inducción */}
          <button
            onClick={() => setStep("contenido")}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <div className="flex items-center justify-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Iniciar {induccion.tipo}
            </div>
          </button>
          <p className="text-sm text-slate-400 text-center mt-2">
            Revisa el contenido, luego presenta la evaluación y firma
          </p>
          </div>
        </div>
      </InduccionesBackdrop>
    );
  }

  // ════════════════════════════════════════════════════════
  // STEP: Contenido Educativo
  // ════════════════════════════════════════════════════════
  if (step === "contenido" && induccion) {
    return (
      <InduccionesBackdrop>
        <div className="min-h-screen p-4">
          <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Contenido de {induccion.tipo}</h2>
                  <p className="text-sm text-slate-400">
                    {induccion.nombreEmpleado}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">ID Inducción</p>
                <p className="text-sm text-white font-mono">{induccion.idInduccion}</p>
              </div>
            </div>
          </div>

          {/* Contenido PDF / Presentación */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
            {/* Instrucciones */}
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-b border-white/10 p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-6 h-6 text-blue-300" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg mb-2">
                    Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST)
                  </h3>
                  <p className="text-slate-300 text-sm mb-3">
                    Revisa cuidadosamente el siguiente contenido sobre seguridad y salud en el trabajo.
                    Al finalizar, deberás presentar una evaluación para verificar tu comprensión.
                  </p>
                  <div className="flex items-center gap-6 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Tiempo estimado: 30-45 min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Material de estudio + evaluación</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visor de PDF / Contenido */}
            <div className="p-6 space-y-6">
              {/* Visor de PDF embebido */}
              <div className="bg-white/5 rounded-xl overflow-hidden">
                <iframe
                  src="/documentos/inducciones/contenido-induccion.pdf"
                  className="w-full h-[700px] rounded-lg"
                  title="Contenido de Inducción - Sistema de Gestión SG-SST"
                />
              </div>

              {/* Temas principales - Resumen visual */}
              <div className="bg-white/5 rounded-xl p-6 space-y-4">
                <h4 className="text-white font-semibold text-center mb-4">Temas Cubiertos en la Presentación</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 bg-white/5 rounded-lg p-4">
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium">Sistema de Gestión SG-SST</p>
                      <p className="text-slate-400 text-sm">Conceptos básicos y obligaciones</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white/5 rounded-lg p-4">
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium">Elementos de Protección Personal (EPP)</p>
                      <p className="text-slate-400 text-sm">Uso correcto y mantenimiento</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white/5 rounded-lg p-4">
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium">Identificación de Riesgos</p>
                      <p className="text-slate-400 text-sm">Reporte y prevención</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white/5 rounded-lg p-4">
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium">Emergencias Ocupacionales</p>
                      <p className="text-slate-400 text-sm">Protocolos de respuesta</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white/5 rounded-lg p-4">
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium">Derechos y Deberes</p>
                      <p className="text-slate-400 text-sm">Marco legal y responsabilidades</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white/5 rounded-lg p-4">
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium">Seguridad en el Trabajo</p>
                      <p className="text-slate-400 text-sm">Prácticas seguras diarias</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instrucción importante */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-blue-300 text-sm">
                      <strong>Importante:</strong> Revisa toda la presentación cuidadosamente.
                      La evaluación incluirá preguntas sobre estos temas.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de navegación */}
            <div className="bg-white/5 border-t border-white/10 p-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setStep("data")}
                  className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                >
                  ← Volver
                </button>

                <div className="flex-1" />

                <button
                  onClick={() => setStep("evaluacion")}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                >
                  Continuar a Evaluación
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500 text-center mt-4">
                Asegúrate de revisar todo el contenido antes de continuar
              </p>
            </div>
          </div>
          </div>
        </div>
      </InduccionesBackdrop>
    );
  }

  // ════════════════════════════════════════════════════════
  // STEP: Evaluación
  // ════════════════════════════════════════════════════════
  if (step === "evaluacion" && induccion) {
    return (
      <InduccionesBackdrop>
        <div className="min-h-screen p-4">
          <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Evaluación de Inducción</h2>
                <p className="text-sm text-slate-400">
                  {induccion.nombreEmpleado} - {induccion.tipo}
                </p>
              </div>
            </div>
          </div>

          {/* Componente de Evaluación */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
            <EvaluacionInduccion
              induccionId={induccion.idInduccion}
              idEmpleadoCore={induccion.idEmpleadoCore}
              nombreEmpleado={induccion.nombreEmpleado}
              numeroDocumento={induccion.numeroDocumento}
              cargo={induccion.cargo}
              onAprobada={(puntaje, resultado) => {
                setPuntajeEvaluacion(puntaje);
                if (resultado) setEvaluacionResultado(resultado);
                setStep("constancia"); // Cambiar a constancia primero
              }}
              onReprobada={() => {
                setPuntajeEvaluacion(0);
                setError("Debes aprobar la evaluación para continuar con la firma");
                setStep("error");
              }}
            />
          </div>

          {/* Botón volver */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setStep("data")}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              ← Volver a la información
            </button>
          </div>
          </div>
        </div>
      </InduccionesBackdrop>
    );
  }

  // ════════════════════════════════════════════════════════
  // STEP: Sign → mostrar canvas de firma
  // ════════════════════════════════════════════════════════
  if (step === "sign" && induccion) {
    return (
      <InduccionesBackdrop>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-white/10">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <PenTool className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Firmar Inducción</h2>
              <p className="text-sm text-slate-400">Dibuja tu firma en el espacio inferior</p>
            </div>
          </div>

          {/* Info del empleado */}
          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Empleado:</span>
              <span className="text-white font-semibold">{induccion.nombreEmpleado}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Documento:</span>
              <span className="text-white font-mono">{induccion.numeroDocumento}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ID Inducción:</span>
              <span className="text-white font-mono">{induccion.idInduccion}</span>
            </div>
          </div>

          {/* Canvas de firma */}
          <SignatureCanvas onConfirm={handleConfirmSignature} loading={loading} />

          {/* Botón volver */}
          <button
            onClick={() => setStep("data")}
            disabled={loading}
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            ← Volver a la información
          </button>
          </div>
        </div>
      </InduccionesBackdrop>
    );
  }

  return null;
}

// ══════════════════════════════════════════════════════════
// Export con Suspense
// ══════════════════════════════════════════════════════════
export default function FirmarInduccionPage() {
  return (
    <Suspense
      fallback={
        <InduccionesBackdrop>
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
          </div>
        </InduccionesBackdrop>
      }
    >
      <FirmarInduccionContent />
    </Suspense>
  );
}
