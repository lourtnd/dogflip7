import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  getMe,
  login as loginApi,
} from "../services/api";

import socket from "../services/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  function connectSocket(token) {
    socket.auth = { token };

    if (!socket.connected) {
      socket.connect();
    }
  }

  async function login(username, password) {
    const data = await loginApi(username, password);

    localStorage.setItem("token", data.token);
    setUser(data.user);

    connectSocket(data.token);
  }

  function logout() {
    localStorage.removeItem("token");

    socket.disconnect();
    socket.auth = {};

    setUser(null);
  }

  // Récupération de l'utilisateur au chargement
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
        connectSocket(token);
      } catch (error) {
        console.error(
          "Impossible de restaurer la session :",
          error
        );

        localStorage.removeItem("token");
        socket.disconnect();
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  // Écoute des événements généraux Socket.IO
  useEffect(() => {
    function handleConnect() {
      console.log("Socket connecté :", socket.id);
      console.log(
        "Transport utilisé :",
        socket.io.engine.transport.name
      );
    }

    function handleConnectError(error) {
      console.error(
        "Erreur de connexion Socket.IO :",
        error.message
      );
    }

    function handleDisconnect(reason) {
      console.log(
        "Socket déconnecté :",
        reason
      );
    }

    function handleUpgrade(transport) {
      console.log(
        "Nouveau transport Socket.IO :",
        transport.name
      );
    }

    function handleUpgradeError(error) {
      console.error(
        "Échec de l'upgrade WebSocket :",
        error.message
      );
    }

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);

    socket.io.engine?.on("upgrade", handleUpgrade);
    socket.io.engine?.on(
      "upgradeError",
      handleUpgradeError
    );

    return () => {
      socket.off("connect", handleConnect);
      socket.off(
        "connect_error",
        handleConnectError
      );
      socket.off("disconnect", handleDisconnect);

      socket.io.engine?.off(
        "upgrade",
        handleUpgrade
      );
      socket.io.engine?.off(
        "upgradeError",
        handleUpgradeError
      );
    };
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