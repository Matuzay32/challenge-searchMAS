

<p align="center">
  <img src="http://searchmas.es/wp-content/uploads/2023/08/search-mas-astronauta-1.png" alt="SearchMAS" width="200"/>
</p>

# Challenge SearchMAS API

API construida con **Node.js + Express + TypeScript + TypeORM** que sincroniza productos desde [Fake Store API](https://fakestoreapi.com/), persiste la información en **PostgreSQL** y permite generar resúmenes, traducciones e inferencia de categorías usando **OpenAI**.

---

## 🧭 Contexto y decisiones de diseño

Para este challenge elegí usar la **API pública de FakeStore** porque ofrece un catálogo sencillo y consistente para probar operaciones CRUD y funcionalidades con IA.
Los endpoints implementados permiten:

* **Generar resúmenes automáticos**.
* **Traducir** productos.
* **Inferir categorías** cuando faltan o son incorrectas.

Decidí usar **Express** para cumplir con el requisito del challenge, pero con una **arquitectura modular inspirada en NestJS**, que utilizo habitualmente y me permite mantener un código organizado y escalable.

> ⚡️ **Decisión importante:** no usé un enfoque **Serverless (AWS Lambda)** porque quería que puedan evaluar el proyecto como un **backend completo en Node.js**, con su estructura de carpetas, decoradores, TypeORM y lógica bien organizada.

> 🔑 **Sobre la API Key de OpenAI:** este proyecto requiere una API Key para probar los endpoints con IA.
> **Si no tienen una clave propia, avísenme y puedo proporcionar una API Key temporal para que puedan testear todas las funcionalidades sin problemas.**

> ℹ️ **Nota sobre FakeStore:** la API externa devuelve 20 productos, por lo que recomiendo configurar `SUMMARY_LIMIT=20` en el `.env` para que se generen resúmenes IA para todos los elementos.

> 🧩 Dejé un archivo **`.env.example`** con todas las variables necesarias ya preparadas para que puedan usarlo directamente (`cp .env.example .env`) sin tener que adivinar configuraciones.

> 📦 Además, voy a dejar (o puedo enviar) un **CSV con productos de ejemplo** por si desean probar la importación manual.
> El proyecto implementa un **CRUD completo**: crear, leer (listar con filtros/estadísticas), actualizar y borrar productos.

---

## 🚀 Funcionalidad principal

* **Sincronización externa:** `POST /api/external-data` trae datos desde FakeStore y genera resúmenes IA.
* **CRUD de productos completo:** crear (`POST`), leer (`GET /api/data`), actualizar parcial o total (`PATCH`/`PUT`), eliminar (`DELETE`).
* **Operaciones masivas con IA:** generación de resúmenes, traducciones y normalización de categorías.
* **Importación/Exportación CSV:** importar datos con upsert e inferencia de categoría; exportar respetando filtros.
* **Swagger UI** en `/api/docs`.
* Seguridad con Helmet/CORS, validaciones con `class-validator`, logging con Morgan y manejo global de errores.

---

## 📦 Requisitos

* **Docker** y **Docker Compose** (para levantar todo fácilmente)
* **Node.js 20+** (opcional, solo si quieren correrlo sin Docker)
* **OPENAI_API_KEY** válida (si no tienen, me pueden pedir una para este proyecto)

---

## ⚙️ Configuración

1. Clonar el repositorio:

```bash
git clone <URL_DEL_REPO>
cd challengeSearchMAS
```

2. Crear el archivo de entorno (ya preparé uno de ejemplo):

```bash
cp .env.example .env
```

Editar `.env` si desean cambiar algo (recomendado: dejar `SUMMARY_LIMIT=20` porque FakeStore entrega 20 productos).
Agregar su `OPENAI_API_KEY` (o pedirme una temporal si no la tienen).

---

## 🐳 Levantar con Docker Compose

Construir y levantar:

```bash
docker compose up --build -d
```

* **db (PostgreSQL 15)**: con volumen persistente y healthcheck.
* **api (Node 20)**: compila TypeScript y arranca la API cuando la DB está lista.

Apagar y limpiar:

```bash
docker compose down -v
```

---

## 🌱 Poblar la base de datos (seed)

```bash
npm run seed
```

Este comando ejecuta internamente:

```bash
docker compose run --rm api node dist/scripts/seed.js
```

* Lanza un contenedor temporal basado en el servicio **api**.
* Usa la red interna para conectarse a **db**.
* Inserta datos iniciales desde FakeStore y aplica IA si está disponible.
* El contenedor se elimina automáticamente al terminar (`--rm`).

> No hace falta entrar manualmente al contenedor ni configurar nada extra.

---

## 🧪 Scripts disponibles

```bash
npm run dev     # Dev con tsx (fuera de Docker)
npm run build   # Compila a dist
npm start       # Ejecuta dist local
npm run lint    # ESLint
npm test        # Vitest
npm run seed    # Pobla la base dentro de Docker
```

---

## 🔌 Variables de entorno principales

| Variable                                              | Descripción                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `NODE_ENV`                                            | `development` / `production`                                                               |
| `PORT`                                                | Puerto donde se expone la API                                                              |
| `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | Credenciales de PostgreSQL                                                                 |
| `OPENAI_API_KEY`                                      | Clave de OpenAI (si no tienen, puedo facilitar una)                                        |
| `EXTERNAL_API`                                        | URL de la API externa (por defecto FakeStore)                                              |
| `SUMMARY_LIMIT`                                       | Cantidad de productos a resumir al sincronizar (recomiendo 20 porque FakeStore entrega 20) |

> Dentro de Docker la app se conecta al host `db` en el puerto `5432`.

---

## 🗂️ Endpoints de la API

| Método  | Endpoint    | Descripción                           |
| ------- | ----------- | ------------------------------------- |
| **GET** | `/health`   | Verifica que la API esté funcionando. |
| **GET** | `/api/docs` | Documentación interactiva Swagger UI. |

### 🛒 Productos

| Método     | Endpoint               | Descripción                                                                                   |
| ---------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| **POST**   | `/api/external-data`   | Sincroniza productos desde FakeStore y genera resúmenes IA para los primeros `SUMMARY_LIMIT`. |
| **GET**    | `/api/data`            | Lista productos con filtros, paginación y estadísticas por categoría.                         |
| **POST**   | `/api/products`        | Crea un nuevo producto (infiriendo categoría si falta o es inválida).                         |
| **PUT**    | `/api/products/:id`    | Reemplaza todos los datos de un producto existente.                                           |
| **PATCH**  | `/api/products/:id`    | Actualiza parcialmente un producto; si `category` va en null se vuelve a inferir.             |
| **DELETE** | `/api/products/:id`    | Elimina un producto.                                                                          |
| **POST**   | `/api/products/import` | Importa productos desde un CSV (upsert por `extId`/`id` y categoría inferida si falta).       |
| **GET**    | `/api/export-csv`      | Exporta productos filtrados a CSV.                                                            |

### 🤖 Inteligencia Artificial

| Método   | Endpoint                             | Descripción                                                                 |
| -------- | ------------------------------------ | --------------------------------------------------------------------------- |
| **POST** | `/api/products/:id/generate-summary` | Genera o regenera el resumen IA (`aiSummary`) de un producto.               |
| **POST** | `/api/products/:id/translate`        | Traduce título y descripción de un producto al idioma indicado.             |
| **POST** | `/api/products/:id/infer-category`   | Recalcula la categoría más adecuada para un producto.                       |
| **POST** | `/api/products/generate-summaries`   | Genera resúmenes IA para varios productos (opcionalmente limitar cantidad). |
| **POST** | `/api/products/translate-all`        | Traduce en lote productos al idioma indicado.                               |
| **POST** | `/api/products/generate-categories`  | Asigna categorías válidas a productos sin categoría.                        |
| **POST** | `/api/products/infer-categories`     | Recalcula categorías para varios productos aunque ya tengan una.            |
| **POST** | `/api/ai/summary`                    | Genera un resumen breve para un texto libre.                                |

---

## 🧩 Dependencias principales

* **express** — Framework para la API REST.
* **typeorm** — ORM para PostgreSQL con soporte de entidades y migraciones.
* **pg** — Driver oficial para PostgreSQL.
* **class-validator / class-transformer** — Validación y transformación de DTOs.
* **swagger-ui-express** — Documentación interactiva de la API.
* **helmet / cors / morgan** — Seguridad y logging HTTP.
* **dotenv** — Gestión de variables de entorno.
* **tsx / typescript** — Compilación y ejecución de TS.
* **vitest / supertest** — Testing unitario e integración.

---

## 🤖 Uso de IA en el desarrollo

Utilicé **OpenAI (modelo `o4-mini`)** únicamente para generar el **boilerplate inicial** del proyecto.
Todas las decisiones técnicas, la arquitectura, la configuración de Docker Compose y la integración con TypeORM fueron completamente mías.

---

## ⚡ Flujo rápido (TL;DR)

```bash
docker compose up --build -d   # Construir y levantar
npm run seed                   # Poblar la base
open http://localhost:3000/api/docs
```

> 🔑 Si no cuentan con una API Key de OpenAI para testear las funciones de IA, **avísenme y les paso una clave temporal para este proyecto**.
> 📦 También puedo proveer un **CSV de productos de ejemplo** si desean probar la importación manual además del seed automático.


