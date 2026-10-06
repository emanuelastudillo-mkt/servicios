# Contrataciones: contrato para el servidor futuro

Esta entrega sigue siendo single player. Once rivales son simulados. No hay login ni mercado compartido desplegado. Ver [economía, contratos y especialidades](ECONOMIA-PERSONAL.md) y [arquitectura futura](ONLINE.md).

`management.js` gestiona ofertas, reservas, adjudicación, cupos, stock y titularidad. `employment.js` administra contratos, nómina mensual, vencimientos y devolución al mercado. `dispatch()` admite `renew-contract`, `bid`, `cancel-bid`, `release` y comandos de carrera. `next-payroll` es sólo Admin del prototipo. Los sueldos se pagan el día 1 a las 00:00 ART; no dependen de la inscripción ni del tipo de carrera.

Una oferta identifica persona, equipo, sueldo mensual, secuencia y cierre. Gana el sueldo mayor; empate por primera secuencia. Se comprueba disponibilidad, cupo y reserva. Todos los depósitos se devuelven al cerrar o cancelar, incluido el del ganador. La firma inicia doce meses calendario y el devengamiento del sueldo; no se cobra una prima adicional.

La renovación agrega doce meses al vencimiento, guarda el nivel del nuevo acuerdo y un sueldo pendiente para después de la siguiente liquidación. Si el contrato vence durante una carrera, conserva la titularidad hasta su cierre; luego vuelve al mercado si no renovó. Un equipo sin personal permanece en la base. Se permite contratarlo de nuevo mediante otra oferta.

El servidor debe serializar la adjudicación, el vencimiento y las renovaciones de cada persona. Una restricción única global por persona impide contratos activos duplicados, incluyendo prórrogas en carrera. Otra restricción impide dos subastas abiertas para la misma persona. Reintentos de solicitudes deben devolver el resultado anterior mediante un request_id idempotente. Cada liquidación debe tener una clave única (team_id, calendar_month); pago, deuda, ledger y cambio de sueldo forman una transacción.

No aceptar precios, titulares, niveles, salarios adjudicados, fecha o presupuestos del cliente. El stock se actualiza con una operación condicionada a stock > 0. Sheets publica parámetros iniciales; los contratos y la propiedad se guardan exclusivamente en el servidor. El snapshot público sólo expone posición y fecha de juego, sin nóminas privadas.
