import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRoom } from "../context/RoomContext";
import socket from "../services/socket";
import "./Home.css";

function Home() {
  const { user, logout } = useAuth();
  const { setRoom } = useRoom();
  const navigate = useNavigate();

  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [error, setError] = useState("");

  function createRoom() {
    setError("");

    socket.emit("createRoom");

    socket.once("roomCreated", ({ roomCode, room }) => {
        setRoom(room);
        navigate(`/lobby/${roomCode}`);
    });
  }

  function joinRoom(e) {
    e.preventDefault();
    setError("");

    if (!roomCodeInput.trim()) return;

    socket.emit("joinRoom", {
      roomCode: roomCodeInput.trim(),
    });

    socket.once("roomJoined", ({ room }) => {
      setRoom(room);
      navigate(`/lobby/${room.code}`);
    });

    socket.once("roomError", (message) => {
      setError(message);
    });
  }

  return (
    <main className="home-page">
      <div className="top-buttons">
        <button onClick={() => navigate("/profile")}>
          👤 {user.displayName}
        </button>

        <button onClick={logout}>
          Déconnexion
        </button>
      </div>

      <img
        src="/logo-dogflip7.png"
        alt="DogFlip7"
        className="home-logo"
      />

      <h2 className="welcome-title">
        Bienvenue {user.displayName} 
      </h2>

      <div className="home-card">
        <button
          className="primary-button"
          onClick={createRoom}
        >
          🎮 Créer une partie
        </button>

        <div className="separator">
          <span>OU</span>
        </div>

        <form
          className="join-form"
          onSubmit={joinRoom}
        >
          <input
            type="text"
            placeholder="Code de la partie"
            value={roomCodeInput}
            onChange={(e) =>
              setRoomCodeInput(e.target.value)
            }
          />

          <button type="submit">
            Rejoindre
          </button>
        </form>

        {error && (
          <p className="error-message">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

export default Home;