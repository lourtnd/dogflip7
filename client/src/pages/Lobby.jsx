import { useParams, useNavigate } from "react-router-dom";
import { useRoom } from "../context/RoomContext";
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";
import socket from "../services/socket";
import { useState } from "react";
import GameSettings from "../components/GameSettings";

function Lobby() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { room, setRoom, setGame, clearRoom } = useRoom();

  const [showGameSettings, setShowGameSettings] =
  useState(false);

  useEffect(() => {
    socket.on("roomUpdated", ({ room }) => {
        setRoom(room);
    });

    return () => {
        socket.off("roomUpdated");
    };
    }, [setRoom]);

  useEffect(() => {
    socket.on("gameStarted", ({ room, game, gameId }) => {
      setRoom(room);
      setGame(game);
      navigate(`/game/${gameId}`);
    });

    return () => {
      socket.off("gameStarted");
    };
  }, [setRoom, setGame, navigate]);

  if (!room) {
    return (
      <main>
        <h1>Lobby {code}</h1>
        <p>Room introuvable ou page rechargée.</p>
        <button onClick={() => navigate("/home")}>Retour accueil</button>
      </main>
    );
  }

  const isHost = room.hostId === user.id;

  function startGame() {
  console.log(
    "CONFIG ROOM JUSTE AVANT START :",
    JSON.stringify(room.deckConfig, null, 2)
  );

  socket.emit("startGame", {
    roomCode: room.code,
  });
}

  function leaveLobby() {
    socket.emit("leaveRoom", {
        roomCode: room.code,
    });

    clearRoom();
    navigate("/home");
    }

  function startGame() {
    socket.emit("startGame", {
        roomCode: room.code,
    });
    }

  return (
    <main>
      <h1>Lobby DogFlip 🐶</h1>
      <h2>Code : {room.code}</h2>

      <h3>Joueurs</h3>

      <ul>
        {room.players.map((player) => (
          <li key={player.id}>
            {player.id === room.hostId ? "👑 " : "👤 "}
            {player.username}
            {player.id === user.id ? " (toi)" : ""}
          </li>
        ))}
      </ul>

      {isHost && (
        <button
          type="button"
          onClick={() => setShowGameSettings(true)}
        >
          Paramètres de jeu
        </button>
      )}

      {showGameSettings && room.deckConfig && (
        <GameSettings
          roomCode={room.code}
          initialDeckConfig={room.deckConfig}
          onClose={() => setShowGameSettings(false)}
        />
      )}

      {isHost && <button onClick={startGame}>Démarrer la partie</button>}

      <button onClick={leaveLobby}>Quitter le lobby</button>
    </main>
  );
}

export default Lobby;