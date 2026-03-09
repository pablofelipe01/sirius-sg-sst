"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ClipboardList, MapPin, ShieldCheck } from "lucide-react";

const inspectionTypes = [
  {
    title: "Inspecciones de EPPs",
    description: "Registro y seguimiento del estado de los elementos de protección personal por empleado.",
    icon: <ShieldCheck className="w-7 h-7 text-green-400" />,
    iconBg: "bg-green-500/20 border-green-400/30",
    cardBg: "bg-green-500/10 hover:bg-green-500/20 border-green-400/20 hover:border-green-400/35",
    arrowColor: "text-green-400/50",
    titleHover: "group-hover:text-green-300",
    href: "/dashboard/inventario-epp/inspeccion",
    available: true,
  },
  {
    title: "Inspecciones de Áreas",
    description: "Verificación de condiciones de seguridad en las diferentes áreas de trabajo.",
    icon: <MapPin className="w-7 h-7 text-blue-400" />,
    iconBg: "bg-blue-500/20 border-blue-400/30",
    cardBg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-400/20 hover:border-blue-400/35",
    arrowColor: "text-blue-400/50",
    titleHover: "group-hover:text-blue-300",
    href: "#",
    available: false,
  },
  {
    title: "Inspecciones de Equipos de Emergencia",
    description: "Control de extintores, botiquines, camillas y kits de derrames por área.",
    icon: <ClipboardList className="w-7 h-7 text-red-400" />,
    iconBg: "bg-red-500/20 border-red-400/30",
    cardBg: "bg-red-500/10 hover:bg-red-500/20 border-red-400/20 hover:border-red-400/35",
    arrowColor: "text-red-400/50",
    titleHover: "group-hover:text-red-300",
    href: "/dashboard/inspecciones-equipos",
    available: true,
  },
];

export default function InspeccionesPage() {
  const router = useRouter();

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
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/20 hover:border-white/30 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Dashboard
            </button>
            <div className="h-8 w-px bg-white/20" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sirius-retono/40 border border-sirius-verde/30 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-sirius-verde" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Inspecciones</h1>
                <p className="text-xs text-white/50">SG-SST</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Selecciona el tipo de inspección</h2>
          <p className="mt-1 text-white/50 text-sm">Registra y gestiona inspecciones de seguridad en el trabajo.</p>
        </div>

        <div className="flex flex-col gap-4">
          {inspectionTypes.map((item) => (
            <button
              key={item.title}
              onClick={() => { if (item.available) router.push(item.href); }}
              disabled={!item.available}
              className={`flex items-center gap-5 backdrop-blur-xl rounded-2xl border p-6 text-left transition-all group ${item.cardBg} ${item.available ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
            >
              <div className={`w-14 h-14 rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${item.iconBg}`}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold text-white transition-colors ${item.titleHover}`}>
                    {item.title}
                  </h3>
                  {!item.available && (
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/40 text-[10px] font-medium border border-white/10">
                      Próximamente
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/50 mt-0.5">{item.description}</p>
              </div>
              {item.available && (
                <svg className={`w-5 h-5 shrink-0 ${item.arrowColor} group-hover:translate-x-1 transition-transform`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
