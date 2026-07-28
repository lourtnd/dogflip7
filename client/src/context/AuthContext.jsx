import { createContext, useContext, useEffect, useState } from "react";
import { getMe, login as loginApi } from "../services/api";
import socket from "../services/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function login(username, password) {
    const data = await loginApi(username, password);

    localStorage.setItem("token", data.token);
    socket.auth = { token: data.token };
    socket.connect();
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("token");
    socket.disconnect();
    setUser(null);
  }

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await getMe(token);
        setUser(data.user);
        socket.auth = { token };
        socket.connect();
      } catch {
        localStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}