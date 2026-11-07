import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';

export interface User {
  locationId: number;
  locationName: string;
  username: string;
  access: 'Area Manager' | 'Executive';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: (reason?: string) => void;
  sessionMessage: string | null;
  clearSessionMessage: () => void;
  isExpiringSoon: boolean;
  remainingSeconds: number;
  stayLoggedIn: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'oracle_reporting_jwt';
const LAST_ACTIVITY_KEY = 'oracle_reporting_last_activity';

// Default idle timeout: 15 minutes (configurable via VITE_SESSION_TIMEOUT_MINUTES)
const TIMEOUT_MINUTES = Number(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES) || 15;
const TIMEOUT_SECONDS = TIMEOUT_MINUTES * 60;
const WARNING_SECONDS = 120; // Show warning modal 2 minutes before logout

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(TIMEOUT_SECONDS);

  const lastActivityRef = useRef<number>(Date.now());
  const lastSavedStorageRef = useRef<number>(Date.now());

  const clearSessionMessage = useCallback(() => {
    setSessionMessage(null);
  }, []);

  const logout = useCallback((reason?: string) => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem('oracle-reporting-active-page');
    sessionStorage.removeItem('oracle-session-bom');
    sessionStorage.removeItem('oracle-session-rof');
    sessionStorage.removeItem('oracle-session-deposit');
    sessionStorage.removeItem('oracle-session-menuitem');
    sessionStorage.removeItem('oracle-session-system-sales');
    setToken(null);
    setUser(null);
    setIsExpiringSoon(false);
    setRemainingSeconds(TIMEOUT_SECONDS);
    if (reason) {
      setSessionMessage(reason);
    } else {
      setSessionMessage(null);
    }
  }, []);

  // Validate existing token on mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session invalid');
        return res.json();
      })
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          const now = Date.now();
          lastActivityRef.current = now;
          lastSavedStorageRef.current = now;
          try {
            localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
          } catch {}
        } else {
          logout('Your session is invalid or has expired.');
        }
      })
      .catch(() => {
        logout('Your session is invalid or has expired.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token, logout]);

  // Global 401 Interceptor: auto-logout when server returns 401 Unauthorized
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
        // Skip login failures since invalid credentials naturally return 401
        if (!url.includes('/api/auth/login')) {
          logout('Your session has expired. Please sign in again.');
        }
      }
      return res;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [logout]);

  // Activity updater (throttled to avoid excessive localStorage writes)
  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (now - lastSavedStorageRef.current > 5000) {
      lastSavedStorageRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch {}
    }
  }, []);

  // Reset timer & keep session alive
  const stayLoggedIn = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastSavedStorageRef.current = now;
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    } catch {}
    setIsExpiringSoon(false);
    setRemainingSeconds(TIMEOUT_SECONDS);

    // Ping backend to confirm token validity
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }, [token]);

  // Inactivity Interval Checker (runs every 1s when logged in)
  useEffect(() => {
    if (!token || !user) {
      setIsExpiringSoon(false);
      return;
    }

    const interval = setInterval(() => {
      let latestActivity = lastActivityRef.current;
      try {
        const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (stored) {
          const storedTime = Number(stored);
          if (storedTime > latestActivity) {
            latestActivity = storedTime;
            lastActivityRef.current = storedTime;
          }
        }
      } catch {}

      const elapsed = Math.floor((Date.now() - latestActivity) / 1000);
      const remaining = TIMEOUT_SECONDS - elapsed;

      if (remaining <= 0) {
        setIsExpiringSoon(false);
        logout('Your session has expired due to inactivity. Please sign in again.');
      } else if (remaining <= WARNING_SECONDS) {
        setIsExpiringSoon(true);
        setRemainingSeconds(remaining);
      } else {
        setIsExpiringSoon(false);
        setRemainingSeconds(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [token, user, logout]);

  // Track user interaction events
  useEffect(() => {
    if (!token || !user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const onUserAction = () => {
      // Don't auto-dismiss the warning modal on incidental mouse move;
      // require user to click "Stay Logged In" if warning is active.
      if (!isExpiringSoon) {
        updateActivity();
      }
    };

    events.forEach((evt) => window.addEventListener(evt, onUserAction, { passive: true }));
    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onUserAction));
    };
  }, [token, user, isExpiringSoon, updateActivity]);

  // Multi-tab synchronization via storage events
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY && !e.newValue) {
        logout('You were signed out from another tab.');
      } else if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
        const time = Number(e.newValue);
        if (time > lastActivityRef.current) {
          lastActivityRef.current = time;
          setIsExpiringSoon(false);
          setRemainingSeconds(TIMEOUT_SECONDS);
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [logout]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setSessionMessage(null);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to login' };
      }

      const now = Date.now();
      lastActivityRef.current = now;
      lastSavedStorageRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch {}

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      setIsExpiringSoon(false);
      setRemainingSeconds(TIMEOUT_SECONDS);
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error. Could not connect to API server.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        sessionMessage,
        clearSessionMessage,
        isExpiringSoon,
        remainingSeconds,
        stayLoggedIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
