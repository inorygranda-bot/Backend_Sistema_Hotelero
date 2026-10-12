const { GoogleGenerativeAI } = require('@google/generative-ai');
const conexion = require('../config/conexion');

// Usamos el SDK clásico @google/generative-ai que mantiene la cuota de 1,500 req/día
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelo = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const procesarMensajeChavoo = async (peticion, respuesta) => {
    const { mensaje } = peticion.body;

    if (!mensaje || !mensaje.trim()) {
        return respuesta.status(400).json({ mensaje: 'El mensaje es obligatorio.' });
    }

    try {
        // 1. Extraemos todo el estado real de PostgreSQL en paralelo
        const [habsRes, reservasRes, tarifasRes, ocuRes] = await Promise.all([
            conexion.query(`
                SELECT h.codigo_habitacion, th.nombre_tipo, th.descripcion AS desc_tipo, h.piso, h.capacidad, h.estado, h.amenidades 
                FROM habitacion h 
                JOIN tipo_habitacion th ON h.id_tipo_habitacion = th.id_tipo_habitacion
                ORDER BY h.codigo_habitacion ASC;
            `),
            conexion.query(`
                SELECT r.codigo_reserva, h.nombre as huesped, r.codigo_habitacion, r.fecha_checkin, r.fecha_checkout, r.estado, r.cantidad_huespedes 
                FROM reserva r 
                JOIN huesped h ON r.id_huesped = h.id_huesped
                ORDER BY r.codigo_reserva DESC;
            `),
            conexion.query(`
                SELECT t.nombre_tarifa, t.precio_base, t.iva, th.nombre_tipo 
                FROM tarifa t 
                LEFT JOIN tarifa_hab thab ON t.id_tarifa = thab.id_tarifa 
                LEFT JOIN tipo_habitacion th ON thab.id_tipo_hab = th.id_tipo_habitacion 
                WHERE t.estado = 'Activa';
            `),
            conexion.query(`SELECT estado, COUNT(*) as total FROM habitacion GROUP BY estado;`)
        ]);

        const estadoHotel = {
            habitaciones: habsRes.rows,
            reservas: reservasRes.rows,
            tarifas_activas: tarifasRes.rows,
            resumen_ocupacion: ocuRes.rows
        };

        // 2. Preparamos el prompt inyectando todo el JSON del hotel
        const promptSistema = `
            Eres Chavoo, un asistente virtual experto, analítico y servicial del sistema de gestión hotelera de IUJO.
            Hoy es ${new Date().toISOString().slice(0, 10)}.
            
            ESTADO ACTUAL DE LA BASE DE DATOS DEL HOTEL:
            ${JSON.stringify(estadoHotel, null, 2)}

            INSTRUCCIONES DE RAZONAMIENTO:
            - Lee y analiza cuidadosamente la información JSON de la base de datos para responder a la inquietud del usuario.
            - Interpreta la intención real de la consulta: realiza filtros (por ejemplo, habitaciones sucias, disponibles o cancelaciones), búsquedas y comparaciones de fechas directamente sobre los datos reales.
            - No utilices respuestas prearmadas ni palabras clave estáticas. Razona con total libertad sobre los datos.
            - Responde siempre en español de manera profesional, clara y organizada utilizando formato Markdown (negritas y viñetas).
        `;

        // 3. Generamos la respuesta con el SDK clásico
        const resultado = await modelo.generateContent(promptSistema + '\n\nPregunta del usuario: ' + mensaje);
        const respuestaIA = resultado.response.text();

        if (respuestaIA) {
            return respuesta.status(200).json({ respuesta: respuestaIA });
        }

        return respuesta.status(200).json({ respuesta: 'Entendido. ¿En qué más te puedo colaborar?' });

    } catch (error) {
        console.error('❌ Error al procesar con Gemini:', error);
        return respuesta.status(500).json({
            respuesta: 'Ocurrió un inconveniente al procesar la consulta con la inteligencia artificial. Por favor, reintenta.'
        });
    }
};

module.exports = {
    procesarMensajeChavoo
};