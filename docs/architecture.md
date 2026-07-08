# Arquitectura de Personal OS

## Idea central

Personal OS se organiza como un conjunto de mini apps independientes que comparten infraestructura común. Cada app tiene sus propias pantallas, datos y jobs, pero publica señales simples para que el dashboard pueda resumir el estado del sistema.

## Estructura inicial

- `src/app`: rutas de Next.js. El dashboard vive en `/` y cada mini app puede tener su propio segmento, por ejemplo `/blog`.
- `src/lib`: acceso a datos y lógica compartida por la UI.
- `src/components`: componentes reutilizables sin dueño de ruta.
- `scripts`: jobs ejecutables fuera del request web, como la generación diaria de artículos.
- `prisma`: schema, migraciones y DB local de desarrollo.

## Modelo para nuevas mini apps

Cada app nueva debería definir:

1. Ruta principal: por ejemplo `/habits`, `/notes` o `/finance`.
2. Modelos propios en Prisma.
3. Funciones de lectura/escritura en `src/lib/<app>.ts`.
4. Jobs opcionales en `scripts/<app>-*.ts`.
5. Señales para el dashboard: conteos, pendientes, última actividad o alertas.

## Blog diario

El blog tiene tres piezas:

- Frontend: `/blog` lista artículos y `/blog/[slug]` muestra una lectura.
- Datos: tabla `Article`.
- Job: `scripts/generate-daily-article.ts`.

El job está preparado para dos modos:

- Con `OPENAI_API_KEY`: genera contenido real usando el SDK de OpenAI.
- Sin `OPENAI_API_KEY`: genera contenido fallback para poder probar la app.

## Próximas decisiones

- Definir la lista fina de temas del blog.
- Elegir canal de notificación: Telegram, email, WhatsApp o push.
- Decidir dónde va a correr el scheduler diario.
- Agregar una tabla de `DashboardSignal` si varias apps empiezan a compartir métricas.
