/**
 * api.mjs — respuestas de ejemplo de /api/*, sin servidor ni servicios externos.
 * La usan el servidor local (dev/servidor.mjs) y la página de demostración
 * (dev/demo.mjs), que la incrusta tal cual: por eso no depende de nada de fuera.
 *
 * crearApi(datos) → responder(ruta, cuerpo, token) → [estado, respuesta]
 *   ruta: "POST /api/orden", etc.
 */

export function crearApi({ USUARIOS, CODIGO_VALIDO, ORDENES, COPIA }) {
  const pendientes = new Map();
  const sesiones = new Map();
  let consecutivo = 0;
  const ficha = (prefijo) => `${prefijo}-${++consecutivo}-${Math.random().toString(36).slice(2, 10)}`;

  const vencido = { pendingExpired: true, error: "El tiempo para escribir el código terminó. Vuelve a entrar." };

  function publico(orden) {
    const { originadorCorreo: _correo, ...resto } = orden;
    return resto;
  }

  function cierre(orden, usuario) {
    return {
      ok: true,
      usuario: usuario.usuario,
      fecha: new Date().toISOString(),
      correo: { enviado: true, para: orden.originadorCorreo, copia: COPIA },
    };
  }

  return function responder(ruta, cuerpo, token) {
    if (ruta === "POST /api/validausuario") {
      const usuario = USUARIOS[String(cuerpo.usuario || "").trim().toUpperCase()];
      if (!usuario) return [200, { valid: false, error: "Usuario no válido en JD Edwards" }];
      if (usuario.correo !== String(cuerpo.correo || "").trim().toLowerCase()) {
        return [200, { valid: false, error: "El correo no coincide con el registrado en JD Edwards para este usuario." }];
      }
      const pendingToken = ficha("pendiente");
      pendientes.set(pendingToken, usuario);
      return [200, { valid: false, mfaRequired: true, pendingToken, user: usuario }];
    }

    if (ruta === "POST /api/mfa/configurar") {
      const usuario = pendientes.get(cuerpo.pendingToken);
      if (!usuario) return [401, { sent: false, ...vencido }];
      return [200, { sent: true, sentTo: usuario.correo }];
    }

    if (ruta === "POST /api/mfa/verify") {
      const usuario = pendientes.get(cuerpo.pendingToken);
      if (!usuario) return [401, { valid: false, ...vencido }];
      if (cuerpo.code !== CODIGO_VALIDO) return [200, { valid: false, error: "Código incorrecto. Revisa la app e inténtalo de nuevo." }];
      const nuevo = ficha("sesion");
      sesiones.set(nuevo, usuario);
      return [200, { valid: true, token: nuevo, user: usuario }];
    }

    const usuario = sesiones.get(token);
    if (!usuario) return [401, { sessionExpired: true, error: "Tu sesión expiró o no es válida. Vuelve a iniciar sesión." }];

    if (ruta === "GET /api/session") return [200, { valid: true, user: usuario }];

    const orden = ORDENES[`${cuerpo.tipo || ""} ${cuerpo.orden}`.trim()];
    if (ruta === "POST /api/orden") {
      return [200, orden ? { encontrada: true, orden: publico(orden) } : { encontrada: false }];
    }
    if (ruta === "POST /api/liberar") {
      return orden ? [200, cierre(orden, usuario)] : [404, { ok: false, error: "No se encontró la orden." }];
    }
    if (ruta === "POST /api/rechazar") {
      if (!orden) return [404, { ok: false, error: "No se encontró la orden." }];
      if (!String(cuerpo.observacion || "").trim()) return [400, { ok: false, error: "Escribe la observación del rechazo." }];
      return [200, cierre(orden, usuario)];
    }
    return [404, { error: `Ruta no encontrada: ${ruta}` }];
  };
}
