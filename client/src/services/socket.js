import { io } from "socket.io-client";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3000";

const socket = io(API_URL, {
  autoConnect: false,
  transports: ["polling", "websocket"],
});


export default socket;