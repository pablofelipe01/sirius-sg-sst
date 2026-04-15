# Sirius SG-SST

Sistema de Gestión de Seguridad y Salud en el Trabajo - Plataforma integral para la gestión del SG-SST en Sirius Regenerative Solutions S.A.S ZOMAC.

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)
![React](https://img.shields.io/badge/React-19.2.3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8)
   
## Descripción

Sirius SG-SST es una aplicación web moderna y completa para la gestión del Sistema de Gestión de Seguridad y Salud en el Trabajo, diseñada específicamente para cumplir con la normativa colombiana. La plataforma integra todos los aspectos del SG-SST en un solo sistema, desde capacitaciones y evaluaciones hasta inspecciones y gestión de EPP.

### Características Principales

- **Gestión de Capacitaciones**: Planificación anual, registro de asistencia, firma digital, y evaluaciones post-capacitación
- **Sistema de Evaluaciones**: Banco de preguntas, plantillas personalizables, aplicación de evaluaciones y generación de reportes PDF
- **Gestión de EPP**: Control de inventario, entregas con firma digital, historial de empleados, alertas de vencimiento
- **Inspecciones Integrales**:
  - Inspecciones de EPP (9 criterios)
  - Inspecciones de áreas físicas (categorías personalizables + acciones correctivas)
  - Inspecciones de equipos de emergencia
  - Inspecciones específicas: botiquines, extintores, camillas, kits de derrames
- **Exportación y Reportes**: Excel y PDF con firma digital
- **Autenticación Segura**: Sistema de 3 pasos con JWT y bcrypt
- **Almacenamiento en la Nube**: AWS S3 para evidencias y documentos

## Stack Tecnológico

### Frontend & Backend (Monorepo)
- **Next.js 16.1.6** con App Router
- **React 19.2.3** con React Compiler
- **TypeScript 5.x** (strict mode)
- **Tailwind CSS 4** con diseño glassmorphism oscuro

### Base de Datos
- **Airtable** (3 bases independientes):
  - Base Personal (empleados, accesos, autenticación)
  - Base Insumos SST (inventario EPP)
  - Base SG-SST (50+ tablas: capacitaciones, evaluaciones, inspecciones)

### Servicios Externos
- **AWS S3** (almacenamiento de evidencias y documentos)
- **OpenAI API** (transcripción de audio y asistencia)

### Librerías Principales
- **jsPDF + jsPDF-AutoTable** (generación de PDFs)
- **ExcelJS** (exportación a Excel)
- **Lucide React** (iconos)
- **bcryptjs** (hash de contraseñas)

### Arquitectura
- **Clean Architecture** (Domain → Use Cases → Infrastructure → Presentation)
- **Dependency Injection** manual con Composition Root

## Instalación

### Prerrequisitos

- Node.js 20.x o superior
- npm o yarn
- Cuenta de Airtable con 3 bases configuradas
- Cuenta AWS con bucket S3
- Clave de OpenAI API (opcional, para transcripción)

### Pasos de Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-org/sirius-sg-sst.git
   cd sirius-sg-sst
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**

   Copiar el archivo de ejemplo y configurar las variables:
   ```bash
   cp .env.example .env.local
   ```

   Editar `.env.local` y completar todas las variables requeridas:
   - Tokens de Airtable (3 bases)
   - IDs de tablas (50+ tablas)
   - Field IDs (300+ campos)
   - Credenciales AWS S3
   - JWT Secret

   **IMPORTANTE:** El proyecto requiere más de 300 variables de entorno para los Field IDs de Airtable. Ver `.env.example` para la lista completa.

4. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```

   La aplicación estará disponible en `http://localhost:3000`

5. **Build para producción**
   ```bash
   npm run build
   npm start
   ```

## Estructura del Proyecto

```
sirius-sg-sst/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # Backend API routes
│   │   ├── dashboard/          # Páginas protegidas
│   │   ├── (auth)/             # Páginas de autenticación
│   │   └── evaluar/            # Páginas públicas
│   ├── core/                   # Clean Architecture - Domain
│   │   ├── domain/             # Entidades y servicios de dominio
│   │   ├── ports/              # Interfaces
│   │   └── use-cases/          # Casos de uso
│   ├── infrastructure/         # Implementaciones
│   │   ├── config/             # Configuración Airtable, AWS
│   │   ├── repositories/       # Repositorios
│   │   └── services/           # Servicios
│   ├── presentation/           # UI Layer
│   │   ├── components/         # Componentes React
│   │   ├── context/            # Context API
│   │   ├── hooks/              # Custom hooks
│   │   └── providers/          # Providers
│   └── shared/                 # Código compartido
│       ├── constants/
│       ├── types/
│       └── utils/
├── .env.example                # Plantilla de variables de entorno
├── CLAUDE.md                   # Documentación para agentes IA
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

## Módulos del Sistema

### ✅ Completados y Funcionales

- **Capacitaciones**: Catálogo de temas, programación mensual
- **Registros de Asistencia**: Con firma digital y transcripción de audio
- **Evaluaciones**: Banco de preguntas, plantillas, aplicación y reportes
- **Entregas EPP**: Control de entregas, firma digital, historial
- **Inventario EPP**: Movimientos, stock, alertas
- **Inspecciones EPP**: 9 criterios, exportación
- **Inspecciones de Áreas**: Categorías, criterios, acciones correctivas
- **Inspecciones de Equipos**: Equipos de emergencia
- **Plan Anual**: Programación de capacitaciones

### 🚧 En Desarrollo

- **Inspecciones Específicas** (API lista, UI pendiente):
  - Botiquines
  - Extintores
  - Camillas
  - Kits de derrames
- **Hub de Inspecciones de Emergencia**

### 📋 Planificados

- Gestión de Riesgos
- Incidentes y Accidentes
- Exámenes Médicos
- PVE Osteomuscular
- Gestión Documental

## Comandos Disponibles

```bash
# Desarrollo
npm run dev                    # Servidor de desarrollo

# Producción
npm run build                  # Build para producción
npm start                      # Servidor de producción

# Calidad de código
npm run lint                   # Ejecutar ESLint
npx tsc --noEmit               # Type-check sin emitir

# Testing (experimental)
npm run test:inspecciones-areas # Test específico
```

## Configuración de Airtable

El proyecto utiliza **Field IDs** en lugar de nombres de campos para garantizar la independencia del esquema. Esto significa que:

1. Los campos en Airtable pueden renombrarse sin romper el código
2. Cada campo debe tener su Field ID configurado en `.env.local`
3. Hay más de 300 Field IDs configurados en el sistema

### Obtener Field IDs de Airtable

1. Ir a la tabla en Airtable
2. Hacer clic en un campo
3. En la URL aparecerá el Field ID (ej: `fld1234567890abcd`)
4. Copiar y pegar en `.env.local`
 
Ver `src/infrastructure/config/airtableSGSST.ts` para la lista completa de campos configurados.

## Seguridad

- **Autenticación**: Sistema de 3 pasos (verificar → password → sesión)
- **Passwords**: Hash con bcryptjs (12 rounds)
- **Tokens**: JWT HMAC-SHA256 custom
- **Firma Digital**: Tokens firmados con expiración
- **S3**: URLs firmadas con tiempo de expiración
- **Validación**: Validación de inputs en todos los endpoints
- **Control de Acceso**: Por roles de usuario

## Contribuir

Este es un proyecto privado. Para contribuir:

1. Crear una rama desde `main`
2. Hacer cambios y verificar con `npm run build`
3. Crear Pull Request con descripción clara
4. Esperar revisión del equipo

### Convenciones de Código

- **Idioma**: Español colombiano en UI y comentarios
- **TypeScript**: Strict mode, tipado completo
- **Clean Architecture**: Respetar separación de capas
- **Field IDs**: Nunca hardcodear nombres de campos Airtable
- **Airtable Queries**: Siempre usar `FIND(...) > 0` para comparaciones booleanas

Ver `CLAUDE.md` para reglas completas de desarrollo.

## Documentación Adicional

- **CLAUDE.md**: Documentación completa para agentes de desarrollo IA
- **DIAGNOSTICO_INSPECCIONES_AREAS.md**: Análisis y corrección de reportes vacíos
- **DIAGNOSTICO_EVALUACIONES.md**: Problemas y soluciones del módulo de evaluaciones
- **.env.example**: Plantilla de todas las variables de entorno requeridas

## Problemas Conocidos

Ver sección "Deuda Técnica Conocida" en `CLAUDE.md` para lista completa. Resumen:

- **ALTA**: Optimización de queries en exportación Excel
- **MEDIA**: Falta suite de tests automatizados
- **BAJA**: UI pendiente para inspecciones específicas

## Estado del Proyecto

**Completitud General**: 75%

- ✅ Sistema core funcional y en producción
- 🚧 Módulos de inspecciones específicas en desarrollo
- 📋 Módulos avanzados planificados

Última actualización: 2026-03-24

## Licencia

Propietario - Todos los derechos reservados

## Soporte

Para preguntas o soporte, contactar al equipo de desarrollo.

---

**Desarrollado con ❤️ para la gestión de Seguridad y Salud en el Trabajo en Sirius Regenerative Solutions S.A.S **
