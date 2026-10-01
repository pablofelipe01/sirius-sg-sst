"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  PackagePlus,
  ChevronLeft,
  Search,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Package,
  Plus,
  Minus,
  X,
  User,
  LogIn,
} from "lucide-react";
import { useSession } from "@/presentation/context/SessionContext";

// ── Tipos ────────────────────────────────────────────────
interface InsumoEPP {
  id: string;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  stockMinimo: number;
  estado: string;
  imagen: { url: string; filename: string } | null;
}

interface LineaIngreso {
  insumoId: string;
  insumo: InsumoEPP;
  cantidad: number;
}

type FormState = "idle" | "submitting" | "success" | "error";

// ── Componente principal ─────────────────────────────────
export default function IngresoEPPPage() {
  const router = useRouter();
  const { user, isLoaded } = useSession();

  // Catálogo de EPPs
  const [catalogo, setCatalogo] = useState<InsumoEPP[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(true);

  // Formulario
  const [lineas, setLineas] = useState<LineaIngreso[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSelector, setShowSelector] = useState(false);
  const [showCrearEPP, setShowCrearEPP] = useState(false);
  const [notas, setNotas] = useState("");

  // Estado del formulario de creación de EPP
  const [nuevoEPP, setNuevoEPP] = useState({
    nombre: "",
    unidadMedida: "Unidad",
    stockMinimo: 0,
    referenciaComercial: "",
    categoria: "EPP",
    idAreaOrigen: "",
    fichaTecnica: "",
    areasConsumidoras: [] as string[],
  });
  const [creatingEPP, setCreatingEPP] = useState(false);
  const [createError, setCreateError] = useState("");

  // Estado de envío
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resultados, setResultados] = useState<{ codigo: string; nombre: string }[]>([]);

  // ── Cargar catálogo de EPPs ───────────────────────────
  const fetchCatalogo = useCallback(async () => {
    setLoadingCatalogo(true);
    try {
      const res = await fetch("/api/insumos/epp");
      const json = await res.json();
      if (json.success) setCatalogo(json.data);
    } catch {
      /* silent */
    } finally {
      setLoadingCatalogo(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogo();
  }, [fetchCatalogo]);

  // ── Filtrar catálogo para selector ────────────────────
  const filteredCatalogo = catalogo.filter(
    (i) =>
      !lineas.some((l) => l.insumoId === i.id) &&
      (i.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.codigo.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ── Agregar línea ────────────────────────────────────
  const agregarLinea = (insumo: InsumoEPP) => {
    setLineas((prev) => [...prev, { insumoId: insumo.id, insumo, cantidad: 1 }]);
    setSearchQuery("");
    setShowSelector(false);
  };

  // ── Actualizar cantidad ──────────────────────────────
  const actualizarCantidad = (insumoId: string, delta: number) => {
    setLineas((prev) =>
      prev.map((l) =>
        l.insumoId === insumoId ? { ...l, cantidad: Math.max(1, l.cantidad + delta) } : l
      )
    );
  };

  const setCantidadDirecta = (insumoId: string, val: string) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) {
      setLineas((prev) =>
        prev.map((l) => (l.insumoId === insumoId ? { ...l, cantidad: n } : l))
      );
    }
  };

  // ── Eliminar línea ───────────────────────────────────
  const eliminarLinea = (insumoId: string) => {
    setLineas((prev) => prev.filter((l) => l.insumoId !== insumoId));
  };

  // ── Crear nuevo EPP ──────────────────────────────────
  const handleCrearEPP = async () => {
    if (!nuevoEPP.nombre.trim() || !nuevoEPP.unidadMedida.trim()) {
      setCreateError("Nombre y unidad de medida son obligatorios");
      return;
    }

    setCreatingEPP(true);
    setCreateError("");

    try {
      const res = await fetch("/api/insumos/epp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoEPP),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.message || "Error al crear EPP");
      }

      // Agregar el nuevo EPP al catálogo y a las líneas
      const eppCreado = json.data as InsumoEPP;
      setCatalogo((prev) => [...prev, eppCreado]);
      agregarLinea(eppCreado);

      // Resetear formulario y cerrar modales
      setNuevoEPP({
        nombre: "",
        unidadMedida: "Unidad",
        stockMinimo: 0,
        referenciaComercial: "",
        categoria: "EPP",
        idAreaOrigen: "",
        fichaTecnica: "",
        areasConsumidoras: [],
      });
      setShowCrearEPP(false);
      setShowSelector(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreatingEPP(false);
    }
  };

  // ── Enviar ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (lineas.length === 0) return;

    setFormState("submitting");
    setErrorMsg("");
    const exitos: { codigo: string; nombre: string }[] = [];

    try {
      for (const linea of lineas) {
        const descripcion = notas
          ? `Ingreso: ${linea.insumo.nombre} — ${notas}`
          : `Ingreso: ${linea.insumo.nombre}`;

        const res = await fetch("/api/insumos/movimientos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            insumoId: linea.insumoId,
            cantidad: linea.cantidad,
            tipoMovimiento: "Entrada",
            nombre: descripcion,
            responsable: user?.idEmpleado || "",
          }),
        });

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.message || "Error al registrar movimiento");
        }
        exitos.push({ codigo: json.data.codigo, nombre: linea.insumo.nombre });
      }

      setResultados(exitos);
      setFormState("success");
      setLineas([]);
      setNotas("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
      setFormState("error");
    }
  };

  // ── Resetear formulario ──────────────────────────────
  const resetForm = () => {
    setFormState("idle");
    setResultados([]);
    setErrorMsg("");
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard/inventario-epp")}
                className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/20 hover:border-white/30 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Inventario
              </button>
              <div className="h-8 w-px bg-white/20" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center">
                  <PackagePlus className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Ingreso de EPP</h1>
                  <p className="text-xs text-white/50">Registrar entrada al inventario</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ═══ ESTADO: ÉXITO ═══ */}
        {formState === "success" && (
          <div className="bg-green-500/10 backdrop-blur-xl border border-green-400/20 rounded-2xl p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">¡Ingreso registrado!</h2>
            <p className="text-white/60 mb-6">
              Se registraron {resultados.length} movimiento(s) de entrada exitosamente.
            </p>
            <div className="space-y-2 mb-6">
              {resultados.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2 border border-white/10"
                >
                  <span className="text-sm text-white/80">{r.nombre}</span>
                  <span className="text-xs font-mono text-teal-300">{r.codigo}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetForm}
                className="px-5 py-2.5 rounded-xl bg-teal-500/20 border border-teal-400/30 text-teal-300 text-sm font-semibold hover:bg-teal-500/30 transition-all cursor-pointer"
              >
                Nuevo ingreso
              </button>
              <button
                onClick={() => router.push("/dashboard/inventario-epp")}
                className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white/80 text-sm font-semibold hover:bg-white/20 transition-all cursor-pointer"
              >
                Volver al inventario
              </button>
            </div>
          </div>
        )}

        {/* ═══ ESTADO: ERROR ═══ */}
        {formState === "error" && (
          <div className="bg-red-500/10 backdrop-blur-xl border border-red-400/20 rounded-2xl p-8 text-center mb-6">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-2">Error al registrar</h2>
            <p className="text-red-300 text-sm mb-4">{errorMsg}</p>
            <button
              onClick={resetForm}
              className="px-5 py-2.5 rounded-xl bg-red-500/20 border border-red-400/30 text-red-300 text-sm font-semibold hover:bg-red-500/30 transition-all cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* ═══ FORMULARIO ═══ */}
        {(formState === "idle" || formState === "submitting") && (
          <>
            {/* Selector de EPPs */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">
                  EPPs a ingresar
                  {lineas.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs">
                      {lineas.length}
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setShowSelector(true)}
                  disabled={loadingCatalogo}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500/20 border border-teal-400/30 text-teal-300 text-sm font-medium hover:bg-teal-500/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Agregar EPP
                </button>
              </div>

              {/* Lista de líneas agregadas */}
              {lineas.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-white/10 rounded-xl">
                  <Package className="w-10 h-10 text-white/15 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">
                    Selecciona los EPPs que deseas ingresar al inventario
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lineas.map((linea) => (
                    <div
                      key={linea.insumoId}
                      className="flex items-center gap-4 bg-white/5 rounded-xl border border-white/10 p-4"
                    >
                      {/* Imagen mini */}
                      <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                        {linea.insumo.imagen ? (
                          <img
                            src={linea.insumo.imagen.url}
                            alt=""
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-white/20" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{linea.insumo.nombre}</p>
                        <p className="text-[11px] text-white/40 font-mono">{linea.insumo.codigo}</p>
                      </div>

                      {/* Control de cantidad */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => actualizarCantidad(linea.insumoId, -1)}
                          className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={linea.cantidad}
                          onChange={(e) => setCantidadDirecta(linea.insumoId, e.target.value)}
                          className="w-16 text-center py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-sm font-bold focus:outline-none focus:border-teal-400/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => actualizarCantidad(linea.insumoId, 1)}
                          className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Unidad */}
                      <span className="text-xs text-white/40 w-14 text-right shrink-0">
                        {linea.insumo.unidadMedida}
                      </span>

                      {/* Eliminar */}
                      <button
                        onClick={() => eliminarLinea(linea.insumoId)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Datos adicionales */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6 mb-6">
              <h2 className="text-base font-semibold text-white mb-4">Datos del ingreso</h2>

              {/* Responsable (auto-detectado desde sesión) */}
              {!user && isLoaded ? (
                <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-400/20 rounded-xl px-4 py-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-300">Sesión no detectada</p>
                    <p className="text-xs text-white/50">Inicia sesión para registrar movimientos.</p>
                  </div>
                  <button
                    onClick={() => router.push("/login")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-all cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Iniciar sesión
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-teal-500/10 border border-teal-400/20 rounded-xl px-4 py-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-400/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-teal-300/60">Responsable del ingreso</p>
                    <p className="text-sm font-semibold text-white truncate">
                      {user?.nombreCompleto || "Cargando..."}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-teal-300/50">
                    {user?.idEmpleado || "..."}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs text-white/50 mb-1.5">Notas / Observaciones</label>
                <textarea
                  rows={2}
                  placeholder="Descripción adicional del ingreso..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-teal-400/50 transition-all resize-none"
                />
              </div>
            </div>

            {/* Resumen y botón de envío */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-white/50">Total de líneas</p>
                  <p className="text-2xl font-bold text-white">{lineas.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/50">Unidades totales</p>
                  <p className="text-2xl font-bold text-teal-400">
                    {lineas.reduce((acc, l) => acc + l.cantidad, 0)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={lineas.length === 0 || formState === "submitting" || !user}
                className="w-full py-3.5 rounded-xl bg-teal-500/30 border border-teal-400/40 text-teal-300 font-semibold text-sm hover:bg-teal-500/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {formState === "submitting" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registrando ingreso...
                  </>
                ) : (
                  <>
                    <PackagePlus className="w-5 h-5" />
                    Registrar ingreso al inventario
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </main>

      {/* ═══ MODAL: SELECTOR DE EPP ═══ */}
      {showSelector && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSelector(false)}
        >
          <div
            className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl max-w-lg w-full max-h-[60vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra de búsqueda */}
            <div className="p-4 border-b border-white/10">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar EPP por nombre o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-teal-400/50 transition-all"
                />
              </div>
              <button
                onClick={() => setShowCrearEPP(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500/20 border border-teal-400/30 text-teal-300 text-sm font-medium hover:bg-teal-500/30 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Crear nuevo EPP
              </button>
            </div>

            {/* Lista de EPPs */}
            <div className="flex-1 overflow-y-auto p-2">
              {loadingCatalogo ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                </div>
              ) : filteredCatalogo.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-white/40 text-sm">
                    {searchQuery ? "Sin resultados" : "Todos los EPPs ya fueron agregados"}
                  </p>
                </div>
              ) : (
                filteredCatalogo.map((insumo) => (
                  <button
                    key={insumo.id}
                    onClick={() => agregarLinea(insumo)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-all cursor-pointer text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                      {insumo.imagen ? (
                        <img src={insumo.imagen.url} alt="" className="w-full h-full object-contain p-1" />
                      ) : (
                        <Package className="w-4 h-4 text-white/20" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{insumo.nombre}</p>
                      <p className="text-[11px] text-white/40 font-mono">{insumo.codigo}</p>
                    </div>
                    <span className="text-xs text-white/30">{insumo.unidadMedida}</span>
                    <Plus className="w-4 h-4 text-teal-400/60" />
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/10">
              <button
                onClick={() => setShowSelector(false)}
                className="w-full py-2 rounded-lg bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: CREAR NUEVO EPP ═══ */}
      {showCrearEPP && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setShowCrearEPP(false);
            setCreateError("");
          }}
        >
          <div
            className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">Crear nuevo EPP</h3>
              <p className="text-xs text-white/50 mt-1">
                Completa los datos del nuevo elemento de protección personal
              </p>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  Nombre del EPP <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Casco de seguridad"
                  value={nuevoEPP.nombre}
                  onChange={(e) => setNuevoEPP({ ...nuevoEPP, nombre: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-teal-400/50 transition-all"
                />
              </div>

              {/* Unidad de medida */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  Unidad de medida <span className="text-red-400">*</span>
                </label>
                <select
                  value={nuevoEPP.unidadMedida}
                  onChange={(e) => setNuevoEPP({ ...nuevoEPP, unidadMedida: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm focus:outline-none focus:border-teal-400/50 transition-all"
                >
                  <option value="Unidad" className="bg-gray-800">Unidad</option>
                  <option value="Par" className="bg-gray-800">Par</option>
                  <option value="Juego" className="bg-gray-800">Juego</option>
                  <option value="Caja" className="bg-gray-800">Caja</option>
                  <option value="Paquete" className="bg-gray-800">Paquete</option>
                </select>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Categoría</label>
                <select
                  value={nuevoEPP.categoria}
                  onChange={(e) => setNuevoEPP({ ...nuevoEPP, categoria: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm focus:outline-none focus:border-teal-400/50 transition-all"
                >
                  <option value="EPP" className="bg-gray-800">EPP</option>
                  <option value="Dotación" className="bg-gray-800">Dotación</option>
                </select>
              </div>

              {/* Stock mínimo */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Stock mínimo</label>
                <input
                  type="number"
                  min={0}
                  value={nuevoEPP.stockMinimo}
                  onChange={(e) =>
                    setNuevoEPP({ ...nuevoEPP, stockMinimo: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm focus:outline-none focus:border-teal-400/50 transition-all"
                />
              </div>

              {/* Referencia comercial */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  Referencia comercial (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: REF-12345"
                  value={nuevoEPP.referenciaComercial}
                  onChange={(e) =>
                    setNuevoEPP({ ...nuevoEPP, referenciaComercial: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-teal-400/50 transition-all"
                />
              </div>

              {/* ID Área Origen */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  ID Área Origen (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: EPP-001"
                  value={nuevoEPP.idAreaOrigen}
                  onChange={(e) =>
                    setNuevoEPP({ ...nuevoEPP, idAreaOrigen: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-teal-400/50 transition-all"
                />
                <p className="text-[10px] text-white/30 mt-1">
                  Identificador del área o departamento de origen
                </p>
              </div>

              {/* Ficha Técnica */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  Ficha técnica (opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Descripción técnica del EPP, materiales, especificaciones..."
                  value={nuevoEPP.fichaTecnica}
                  onChange={(e) =>
                    setNuevoEPP({ ...nuevoEPP, fichaTecnica: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-teal-400/50 transition-all resize-none"
                />
              </div>

              {/* Error */}
              {createError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-400/20">
                  <p className="text-xs text-red-300">{createError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 flex gap-3">
              <button
                onClick={() => {
                  setShowCrearEPP(false);
                  setCreateError("");
                }}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-medium hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearEPP}
                disabled={creatingEPP || !nuevoEPP.nombre.trim()}
                className="flex-1 py-2.5 rounded-xl bg-teal-500/30 border border-teal-400/40 text-teal-300 text-sm font-semibold hover:bg-teal-500/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creatingEPP ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Crear EPP
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
