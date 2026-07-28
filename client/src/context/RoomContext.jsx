import { createContext, useContext, useState } from "react";

const RoomContext = createContext(null);

export function RoomProvider({ children }) {
  const [room, setRoom] = useState(null);
  const [game, setGame] = useState(null);

  function clearRoom() {
    setRoom(null);
    setGame(null);
  }

  return (
    <RoomContext.Provider
      value={{
        room,
        setRoom,
        game,
        setGame,
        clearRoom,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  return useContext(RoomContext);
}