import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { setUnauthorizedHandler } from '../../config/apiFetch';
import { fetchCurrentUser, loginUser } from './services/authService';
import {
  clearStoredSession,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from './authStorage';

const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró. Inicia sesión de nuevo.';

const AuthContext = createContext(null);

/**
 * Texto del aviso del login cuando el servidor rechaza el token (401).
 * `USER_INACTIVE` muestra el texto del servidor; `NO_TOKEN`, `INVALID_TOKEN`, `TOKEN_EXPIRED` (o un
 * 401 sin código) muestran el aviso genérico de sesión expirada.
 */
function buildSessionNotice({ code, message } = {}) {
  if (code === 'USER_INACTIVE' && message) return message;
  return SESSION_EXPIRED_MESSAGE;
}

/**
 * Sesión guardada al montar la app. Un usuario guardado SIN token (sesión anterior al JWT) o un
 * token sin usuario no cuentan como sesión: se limpian y hay que iniciar sesión de nuevo.
 */
function readInitialUser() {
  const token = getStoredToken();
  const stored = getStoredUser();
  if (token && stored) return stored;
  if (token || stored) clearStoredSession();
  return null;
}

/**
 * Proveedor de la sesión: usuario, rol y token (este último en `authStorage`, no en el estado).
 *
 * - `login` guarda token y usuario; `logout` los borra.
 * - Al montar con una sesión guardada, valida el token con `GET /api/auth/me` y refresca el usuario
 *   (rol/estado). Un 401 cierra la sesión; si el servidor no responde (red caída u otro error) se
 *   conserva la sesión guardada. `validateOnMount={false}` omite esa petición (las pruebas de
 *   pantallas con `fetch` simulado no quieren una llamada extra).
 * - Registra el handler de 401 de `apiFetch`: ante una sesión caída pone `user = null` (el router
 *   redirige a `/login` conservando `from`) y deja el aviso en `sessionNotice`.
 */
export function AuthProvider({ children, validateOnMount = true }) {
  const [user, setUser] = useState(readInitialUser);
  const [loading, setLoading] = useState(false);
  const [sessionNotice, setSessionNotice] = useState('');

  // Un 401 de cualquier petición autenticada cierra la sesión (apiFetch ya borró el token guardado).
  useEffect(
    () =>
      setUnauthorizedHandler((info) => {
        setUser(null);
        setSessionNotice(buildSessionNotice(info));
      }),
    []
  );

  // Validación ligera de la sesión guardada (rol/estado frescos desde la BD).
  useEffect(() => {
    const tokenAtStart = getStoredToken();
    if (!validateOnMount || !tokenAtStart) return undefined;

    let cancelled = false;
    fetchCurrentUser()
      .then((freshUser) => {
        // Si mientras tanto se cerró la sesión o entró otro usuario, esta respuesta ya no aplica.
        if (cancelled || getStoredToken() !== tokenAtStart) return;
        setStoredUser(freshUser);
        setUser((current) => (JSON.stringify(current) === JSON.stringify(freshUser) ? current : freshUser));
      })
      .catch(() => {
        // 401: apiFetch ya cerró la sesión. Red caída u otro error: se mantiene la sesión guardada.
      });

    return () => {
      cancelled = true;
    };
  }, [validateOnMount]);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setSessionNotice('');
    try {
      const { user: userData, token } = await loginUser({ username, password });
      // El token se guarda ANTES de actualizar el estado: las pantallas piden datos al montarse.
      setStoredToken(token);
      setStoredUser(userData);
      setUser(userData);
      return userData;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setSessionNotice('');
    setUser(null);
  }, []);

  const isAdmin = useMemo(() => user?.role === 'ADMIN', [user]);
  const isAuthenticated = useMemo(() => Boolean(user && user.active), [user]);

  const value = useMemo(
    () => ({
      user,
      isAdmin,
      isAuthenticated,
      loading,
      sessionNotice,
      login,
      logout,
    }),
    [user, isAdmin, isAuthenticated, loading, sessionNotice, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
