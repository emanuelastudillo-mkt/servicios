# Contrataciones y campeonato: contrato para el servidor futuro

Esta entrega continúa siendo single player. `src/worker.js` es un Web Worker del navegador, no un Cloudflare Worker desplegado. No hay cuentas reales, autenticación ni contratos compartidos entre navegadores.

`management.js` contiene reglas puras, sin DOM: ofertas, reservas de dinero, cierre, devolución, titularidad, límites de plantel, stock y puntuación. `dispatch()` admite `bid`, `cancel-bid`, `release`, `buy-vehicle` además de los comandos de etapa. Una oferta identifica a una persona, sueldo, equipo, secuencia y hora de cierre. El catálogo se fija al comenzar cada campeonato.

## Adjudicación

La oferta reserva el primer sueldo. El cierre usa el tiempo común de la carrera: mayor sueldo gana, empate por primera secuencia de oferta. Antes de adjudicar se comprueban titularidad, cupo y fondos. Ganador: la reserva paga el primer sueldo y se crea un contrato. Perdedor o cancelación: devolución completa. Las siguientes carreras cobran el sueldo acordado; un saldo insuficiente se registra como deuda de asistencia/sueldos y se descuenta de premios. No hay un segundo cobro al iniciar una etapa.

Los equipos tienen como máximo 3 pilotos y 5 mecánicos. Las ofertas del jugador también reservan cupo. No se puede liberar al último piloto, ni cambiar contratos mientras su equipo está conduciendo o en asistencia. Las piezas de emergencia se conservan durante todo el campeonato.

## Autoridad online pendiente

Al agregar Cloudflare, un Durable Object por campeonato puede serializar compras, ofertas y cierres para unos 20 jugadores. D1 puede persistir catálogos y resultados. El servidor debe ser dueño del reloj, la aleatoriedad, el saldo y el stock; el navegador sólo envía intenciones. Validar la sesión y autorización de equipo en cada comando.

La transacción de adjudicación debe incluir: cerrar subasta sólo si sigue abierta; seleccionar ganador; comprobar cupos; insertar contrato con una clave única `(championship_id, person_id)`; liquidar depósitos; registrar un movimiento por `(request_id, operation)`. Un reintento debe devolver el resultado previo sin volver a cobrar. Una restricción única debe impedir dos subastas abiertas para la misma persona. La comprobación y la escritura de stock deben ser una sola operación condicionada a `stock > 0`.

No aceptar `advance`, precios, titulares, salarios adjudicados ni cambios de presupuesto enviados por el cliente. El login futuro necesita almacenamiento de contraseñas mediante hashing adaptativo y sesiones seguras; nunca Sheets o el repositorio público. Este documento describe preparación y requisitos, no una implementación online terminada.

## Contrato del visor

`publicSnapshot()` expone carrera, fecha común, posiciones y avance. Para el futuro HUD público añadir únicamente campos permitidos: piloto, escudo, vehículo, etapa y estado visible. Finanzas, estrategia, inventario y semilla continúan privados. Cada ronda conserva su fecha programada; el tiempo de llegada incluye esperas, descansos y reparaciones de cada participante.

Si en el futuro se permiten campeonatos simultáneos, la exclusividad debe ampliarse a un índice único global por persona para contratos activos, liberado al terminar el contrato. No basta con comprobar sólo el campeonato en ese escenario.
