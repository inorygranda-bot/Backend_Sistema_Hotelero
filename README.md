# Backend - Sistema Hotelero

API REST para el sistema de gestión hotelera, construida con Node.js, Express y PostgreSQL para la base de datos.

Integrantes:
* Vicleydy Granda C.I: 32.570826
* Emily Heredia C.I: 32.934.300
* Santiago Arrieche C.I: 31.535.546
* Aarón Piña C.I: 31.026.016

---

## Tecnologías Utilizadas

* **Entorno de ejecución:** Node.js
* **Framework Web:** Express.js
* **Base de Datos:** PostgreSQL 
* **Gestión de variables de entorno:** `dotenv`
* **Conector de BD:** `pg` (node-postgres)
* **Docker Desktop** (para la base de datos PostgreSQL)

---

## Requisitos Previos

* **Node.js** (versión 18 o superior)
* **Git**

---

## Instalación y Puesta en Marcha

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone https://github.com/inorygranda-bot/Backend_Sistema_Hotelero.git
cd Backend
npm install
```

### 2. Configurar el archivo de entorno (`.env`)
Crea un archivo `.env` en la raíz de la carpeta `Backend` con las siguientes variables (siguiendo el ejemplo.env):

```env
PORT=3000
DB_USER=tu usuario
DB_PASSWORD=tu clave
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=hotel_proyecto
```

### 3. Iniciar el contenedor de PostgreSQL con Docker
Asegúrate de que Docker Desktop esté abierto y ejecuta:

```powershell
docker run --name postgres-docker -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=mi_clave -e POSTGRES_DB=hotel_proyecto -p 5432:5432 -d postgres:15-alpine
```

### 4. Cargar la estructura de la Base de Datos (`schema.sql`)
Desde la carpeta del Backend, ejecuta en PowerShell:

```powershell
Get-Content base_de_datos/schema.sql | docker exec -i postgres-docker psql -U postgres -d hotel_proyecto
```

### 5. Iniciar el servidor
```bash
npm run dev
```
El servidor quedará corriendo en `http://localhost:3000`.
