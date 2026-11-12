/**
 * api.js — llamadas a la API propia (/api/*).
 *
 * El acceso es en dos pasos: /api/validausuario revisa usuario y correo, y
 * /api/mfa/verify revisa el código de 6 dígitos y devuelve el token de sesión
 * que exigen las demás rutas, en el encabezado X-Session-Token.
 */

const CLAVE_TOKEN = "libToken";
const CLAVE_USUARIO = "libUsuario";

// sessionStorage puede no estar disponible (navegación privada); la sesión vive
// entonces solo en memoria, hasta recargar la página.
const memoria = {};
const guardado = {
  leer(clave) {
    try { return sessionStorage.getItem(clave); } catch { return memoria[clave] ?? null; }
  },
  poner(clave, valor) {
    memoria[clave] = valor;
    try { sessionStorage.setItem(clave, valor); } catch { /* queda en memoria */ }
  },
  quitar(clave) {
    delete memoria[clave];
    try { sessionStorage.removeItem(clave); } catch { /* ya no está en memoria */ }
  },
};

const sesion = {
  token: () => guardado.leer(CLAVE_TOKEN) || "",
  usuario: () => {
    try { return JSON.parse(guardado.leer(CLAVE_USUARIO)) || null; } catch { return null; }
  },
  guardar(token, usuario) {
    guardado.poner(CLAVE_TOKEN, token);
    guardado.poner(CLAVE_USUARIO, JSON.stringify(usuario));
  },
  cerrar() {
    guardado.quitar(CLAVE_TOKEN);
    guardado.quitar(CLAVE_USUARIO);
  },
};

// Resuelve { ok, status, data }. Nunca lanza: los fallos de red llegan como data.error.
async function llamar(ruta, cuerpo, metodo = "POST") {
  let res;
  try {
    res = await fetch(ruta, {
      method: metodo,
      headers: { "Content-Type": "application/json", "X-Session-Token": sesion.token() },
      body: metodo === "GET" ? undefined : JSON.stringify(cuerpo || {}),
    });
  } catch {
    return { ok: false, status: 0, data: { error: "Sin conexión. Revisa tu red e inténtalo de nuevo." } };
  }
  const data = await res.json().catch(() => ({ error: `El servidor respondió HTTP ${res.status}` }));
  if (res.status === 401 && data.sessionExpired && typeof alExpirarSesion === "function") alExpirarSesion();
  return { ok: res.ok, status: res.status, data };
}

const api = {
  validarUsuario: (usuario, correo) => llamar("/api/validausuario", { usuario, correo }),
  configurarCodigo: (pendingToken) => llamar("/api/mfa/configurar", { pendingToken }),
  verificarCodigo: (pendingToken, code) => llamar("/api/mfa/verify", { pendingToken, code }),
  revisarSesion: () => llamar("/api/session", null, "GET"),
  buscarOrden: (tipo, orden) => llamar("/api/orden", { tipo, orden }),
  liberar: (tipo, orden) => llamar("/api/liberar", { tipo, orden }),
  rechazar: (tipo, orden, observacion) => llamar("/api/rechazar", { tipo, orden, observacion }),
};
