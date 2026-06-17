# Generador PDF Profesional - Perfil Sociodemográfico

## Código del Documento
**FT-SST-060 - PERFIL SOCIODEMOGRÁFICO**
- Versión: 01
- Fecha de edición: 08/06/2024

## Descripción

Sistema de generación de informes PDF profesionales para perfiles sociodemográficos, basado en el patrón de diseño corporativo de las actas COPASST/COCOLAB de Sirius Regenerative Solutions.

## Patrón de Diseño Corporativo

El informe sigue el estándar visual establecido para documentos oficiales de Sirius:

### 1. Encabezado de 3 Columnas (Consistente en todos los documentos SST)
```
┌──────────────┬────────────────────────────────────┬──────────────────┐
│              │  SIRIUS REGENERATIVE SOLUTIONS     │  CODIGO: FT-...  │
│     LOGO     │  S.A.S. ZOMAC.                    │  VERSION: XX     │
│              │  NIT. 901.377.064-8                │  FECHA EDICION   │
│              │  ─────────────────────────────     │                  │
│              │  FORMATO DE PERFIL                 │                  │
│              │  SOCIODEMOGRÁFICO                  │                  │
└──────────────┴────────────────────────────────────┴──────────────────┘
```

### 2. Barra de Título (Fondo negro, texto blanco)
```
┌──────────────────────────────────────────────────────────────────┐
│  PERFIL SOCIODEMOGRÁFICO - [NOMBRE DE LA CAMPAÑA]               │
└──────────────────────────────────────────────────────────────────┘
```

### 3. Panel de Datos (Tabla 2x4)
```
┌─────────────────────┬──────────────────┬───────────────────┬─────────────────┐
│ Empresa:            │ SIRIUS           │ Campaña:          │ [Nombre]        │
│ Periodo:            │ Semestre X 2024  │ Total respuestas: │ XX colaboradores│
│ Estado:             │ Activa/Cerrada   │ Fecha de cierre:  │ DD/MM/AAAA      │
│ Generado:           │ DD/MM/AAAA       │ Edad promedio:    │ XX años         │
└─────────────────────┴──────────────────┴───────────────────┴─────────────────┘
```

### 4. Paleta de Colores
- **Verde Corporativo**: RGB(0, 182, 2) - `#00B602`
- **Azul Institucional**: RGB(1, 84, 172) - `#0154AC`
- **Negro Texto**: RGB(26, 26, 51) - `#1A1A33`
- **Gris Claro**: RGB(242, 242, 242) - `#F2F2F2`
- **Violeta Acento**: RGB(88, 28, 135) - `#581C87`

### 5. Títulos de Sección
Barra azul (`#0154AC`) con texto blanco, fuente Helvetica Bold 10pt:
```
┌──────────────────────────────────────────────────────────────────┐
│  1. RESUMEN EJECUTIVO                                            │
└──────────────────────────────────────────────────────────────────┘
```

### 6. Pie de Página Corporativo
```
─────────────────────────────────────────────── (Línea verde)
Sirius Regenerative Solutions SAS Zomac / Nit: 901.377.064-8 / 
Teléfono: 320 9568566 / Correo: adm@siriusregenerative.com
Plantación: Barranca de Upía, km 7 vía Cabuyaro, Meta, Colombia

                                                         Pág. X / Y
```

## Estructura del Informe

### Sección 1: Resumen Ejecutivo
- **Propósito**: Contexto normativo y panorama general
- **Contenido**:
  - Descripción de la población evaluada
  - Referencia a normativa (Res. 0312 de 2019, SG-SST)
  - Panel de indicadores clave:
    - Total de colaboradores
    - Edad promedio
    - Distribución por género
    - Nivel educativo predominante
    - Área de trabajo principal

### Sección 2: Caracterización Demográfica
- **2.1.** Distribución por género
- **2.2.** Distribución por rangos de edad (18-25, 26-35, 36-45, 46-55, 56+)
- **2.3.** Estado civil
- **2.4.** Estrato socioeconómico

**Formato de tablas**: Encabezado verde, filas alternadas con fondo gris claro

### Sección 3: Caracterización Laboral
- **3.1.** Nivel de escolaridad
- **3.2.** Distribución por área de trabajo
- **3.3.** Tipo de contrato

### Sección 4: Movilidad y Desplazamiento
- **Contexto**: Identificación de riesgos in itinere
- **4.1.** Medio de transporte principal
- **4.2.** Tiempo de desplazamiento

### Sección 5: Registro Individual de Colaboradores
- Tabla resumen con todos los colaboradores
- Columnas: #, Nombre, Edad, Género, Estado Civil, Municipio, Estrato, Escolaridad, Área, Cargo
- **Confidencialidad**: Conforme Res. 2346 de 2007

### Sección 6: Fichas Individuales Detalladas ⭐ NUEVA
**Una página completa por cada colaborador con 8 subsecciones:**

#### 6.1. Datos Personales
- Nombre completo
- Número de documento
- Fecha de nacimiento
- Edad calculada
- Género
- Estado civil

#### 6.2. Vivienda y Situación Socioeconómica
- Municipio de residencia
- Estrato socioeconómico
- Tipo de vivienda
- Personas a cargo

#### 6.3. Educación y Formación
- Nivel de escolaridad
- ¿Estudia actualmente?
- Programa que cursa (si aplica)

#### 6.4. Información Laboral
- Área de trabajo
- Cargo
- Tipo de contrato
- Fecha de ingreso a Sirius
- Jornada/turno de trabajo
- ¿Tiene otro empleo?
- Descripción del otro empleo (si aplica)

#### 6.5. Condiciones de Salud
- ¿Enfermedad crónica diagnosticada?
- Enfermedad(es) crónica(s) (si aplica)
- ¿Tiene alguna discapacidad?
- Tipo de discapacidad (si aplica)
- ¿Tratamiento médico actual?
- Descripción del tratamiento (si aplica)
- ¿Accidentes de trabajo previos?
- Descripción de accidentes (si aplica)
- ¿Enfermedad laboral diagnosticada?
- Descripción enfermedad laboral (si aplica)

#### 6.6. Hábitos y Estilo de Vida
- ¿Fuma?
- Consumo de alcohol
- ¿Practica deporte?
- Deporte(s) que practica (si aplica)
- Actividades en tiempo libre
- Otra actividad especificada (si aplica)

#### 6.7. Transporte y Movilidad
- Medio de transporte principal
- Tiempo de desplazamiento (ida)

#### 6.8. Consentimiento y Declaraciones
- Acepta política de tratamiento de datos personales (Ley 1581/2012)
- Declara que la información es veraz y completa
- Fecha de respuesta

**Nota de confidencialidad al final de cada ficha**

## Ventajas del Nuevo Formato

### ✅ Profesionalismo
- Diseño consistente con otros documentos SST de Sirius
- Imagen corporativa unificada
- Presentación formal para auditorías
- Una página completa por colaborador
- Organización clara en 8 subsecciones

### ✅ Normativa
- Código de formato visible (FT-SST-060)
- Versión y fecha de edición rastreables
- Referencias a normativa vigente
- Cumple Res. 2346/2007 (evaluaciones médicas)
- Incluye consentimiento Ley 1581/2012

### ✅ Usabilidad
- Información organizada por categorías
- Tablas de distribución con porcentajes
- Fácil lectura e interpretación
- **Fichas individuales completas y detalladas**
- Toda la información en un solo documento
- No se omite ningún campo capturado

### ✅ Mantenibilidad
- Código modular y reutilizable
- Mismos helpers que actas COPASST
- Fácil actualización de paleta o formato

### ✅ Completitud ⭐ NUEVO
- **100% de los datos capturados se muestran**
- Fichas individuales de página completa
- Información condicional se muestra solo si aplica
- Nota de confidencialidad en cada ficha
- Formato estructurado para análisis individual

## Implementación Técnica

### Archivos Clave
```
src/
├── lib/
│   └── sociodemografico/
│       └── perfilPdf.ts          # Generador principal
└── app/
    └── api/
        └── socio/
            └── campanas/
                └── [id]/
                    └── exportar-pdf/
                        └── route.ts  # Endpoint API
```

### Endpoint
```
GET /api/socio/campanas/:id/exportar-pdf
```

**Respuesta**:
- Content-Type: `application/pdf`
- Nombre de archivo: `FT-SST-060_Perfil_Sociodemografico_[Nombre_Campaña].pdf`

### Uso desde el Frontend
```typescript
const response = await fetch(`/api/socio/campanas/${campanaId}/exportar-pdf`);
const blob = await response.blob();
// Descargar automáticamente
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'Perfil_Sociodemografico.pdf';
a.click();
```

## Comparación con Formato Anterior

| Aspecto | Formato Anterior | Formato Nuevo |
|---------|-----------------|---------------|
| Encabezado | Texto simple centrado | Encabezado 3 columnas corporativo |
| Código de formato | No visible | FT-SST-060 v01 |
| Título | Texto simple | Barra negra profesional |
| Secciones | Sin jerarquía visual | Barras azules diferenciadas |
| Tablas | Encabezado violeta | Encabezado verde/azul según contexto |
| Pie de página | Texto simple | Línea verde + datos corporativos |
| Consistencia | Diseño único | Alineado con actas COPASST/COCOLAB |
| Estadísticas | Texto plano | Tablas estructuradas con % |
| **Fichas individuales** | **Texto corrido básico** | **Página completa por persona (8 secciones)** |
| **Completitud de datos** | **Información parcial** | **100% de los datos capturados** |
| **Organización individual** | **Sin estructura** | **Tablas estructuradas por categoría** |
| **Información de salud** | **Párrafo simple** | **Tabla detallada con condiciones** |
| **Consentimientos** | **No mostrados** | **Sección específica con fechas** |

## Estadísticas Calculadas

El generador calcula automáticamente:

1. **Total de respuestas**
2. **Edad promedio** de la población
3. **Distribución por género** (cantidad y %)
4. **Distribución por rangos de edad** (5 grupos)
5. **Distribución por estado civil** (5 categorías)
6. **Distribución por estrato** (1-6)
7. **Distribución por escolaridad** (5 niveles)
8. **Distribución por área de trabajo** (4 áreas)
9. **Distribución por tipo de contrato** (4 tipos)
10. **Distribución por medio de transporte** (6 opciones)
11. **Distribución por tiempo de desplazamiento** (4 rangos)

Todas con:
- Valor absoluto (cantidad)
- Valor relativo (porcentaje)
- Ordenamiento de mayor a menor

## Ejemplo de Uso Completo

```typescript
// 1. Usuario hace clic en botón "PDF" en estadísticas
const handleExportarPDF = async () => {
  setExportandoPDF(true);
  try {
    const res = await fetch(`/api/socio/campanas/${campanaId}/exportar-pdf`);
    if (!res.ok) throw new Error("Error al generar PDF");
    
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FT-SST-060_Perfil_Sociodemografico_${campana.nombre}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    setError(err.message);
  } finally {
    setExportandoPDF(false);
  }
};

// 2. El endpoint procesa la solicitud
// 3. El generador crea el PDF con formato profesional
// 4. El navegador descarga el archivo
```

## Notas Técnicas

### Dependencias
- `jspdf` - Generación de PDFs
- `jspdf-autotable` - Tablas automáticas
- `fs` / `path` - Carga del logo desde `public/logo.png`

### Características Técnicas
- **Formato**: Letter (215.9 x 279.4 mm)
- **Orientación**: Portrait
- **Márgenes**: 12mm todos los lados
- **Pie de página**: 24mm reservados
- **Paginación automática**: Verifica espacio y agrega páginas
- **Logo**: Carga desde `public/logo.png` o usa fallback

### Gestión de Páginas
- `checkPage(y, needed, PH, FH)`: Verifica si hay espacio
- Si no hay espacio → agrega nueva página automáticamente
- El pie de página se renderiza en TODAS las páginas al final

### Encriptación de Datos
- **No aplica**: El PDF no incluye información sensible de salud
- Los datos individuales se muestran conforme a la Res. 2346 de 2007
- Para información confidencial, se debe implementar encriptación del PDF

## Mantenimiento

### Actualizar Paleta de Colores
Editar en `src/lib/sociodemografico/perfilPdf.ts`:
```typescript
const C = {
  VERDE:      [0, 182, 2]     as [number, number, number],
  AZUL:       [1, 84, 172]    as [number, number, number],
  // ...
} as const;
```

### Actualizar Datos de la Empresa
```typescript
const EMPRESA    = "SIRIUS";
const NIT        = "901.377.064-8";
const TELEFONO   = "320 9568566";
// ...
```

### Actualizar Versión del Formato
```typescript
const FORMATO = {
  codigo:       "FT-SST-060",
  version:      "02",  // ← Cambiar aquí
  fechaEdicion: "DD/MM/YYYY",
} as const;
```

## Roadmap

### Futuras Mejoras
- [ ] Gráficos de barras/torta para distribuciones
- [ ] Pirámide poblacional por edad y género
- [ ] Mapa de calor de riesgos por área
- [ ] Firma digital del responsable SST
- [ ] Exportación a PowerPoint para presentaciones
- [ ] Comparativas entre campañas (tendencias)
- [ ] Indicadores de riesgo psicosocial destacados

---

**Fecha de creación**: Junio 17, 2026  
**Autor**: Claude Sonnet 4.5 + 14-David-06  
**Basado en**: `src/lib/comites/actaPdf.ts`
