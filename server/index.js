require("dotenv").config();
const authRoutes = require("./routes/auth");

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

const {
  DEFAULT_DECK_CONFIG,
} = require("./game/defaultDeckConfig");
const { createDeck } = require("./game/core/deck");
const Game = require("./game/core/Game");

const { getMe } = require("./services/authService");

console.log(
  "DEFAULT_DECK_CONFIG SERVEUR :",
  JSON.stringify(DEFAULT_DECK_CONFIG, null, 2)
);

const pool = require("./db/pool");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const rooms = {};
const games = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

async function saveEloResults(eloResults) {
  if (!Array.isArray(eloResults) || eloResults.length === 0) {
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const result of eloResults) {
      await client.query(
        `
          UPDATE users
          SET elo = $1
          WHERE id = $2
        `,
        [result.newElo, result.playerId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function saveGameElo(game) {
  if (
    !game ||
    game.status !== "finished" ||
    game.eloSaved
  ) {
    return;
  }

  await saveEloResults(game.eloResults);
  game.eloSaved = true;

  console.log("Elo sauvegardés");
}

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Token manquant"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await getMe(decoded.id);

    if (!user) {
      return next(new Error("Utilisateur introuvable"));
    }

    socket.user = user;

    next();
  } catch (err) {
    next(new Error("Token invalide"));
  }
});

function validateQuantities(receivedConfig, defaultConfig) {
  const validatedConfig = {};

  for (const key of Object.keys(defaultConfig)) {
    const quantity = Number(receivedConfig?.[key] ?? 0);

    if (!Number.isInteger(quantity)) {
      throw new Error(`Quantité invalide pour ${key}`);
    }

    if (quantity < 0 || quantity > 10) {
      throw new Error(
        `La quantité de ${key} doit être comprise entre 0 et 10`
      );
    }

    validatedConfig[key] = quantity;
  }

  return validatedConfig;
}

function validateDeckConfig(deckConfig) {
  if (!deckConfig || typeof deckConfig !== "object") {
    throw new Error("Configuration du paquet invalide");
  }

  return {
    actions: validateQuantities(
      deckConfig.actions,
      DEFAULT_DECK_CONFIG.actions
    ),

    modifiers: validateQuantities(
      deckConfig.modifiers,
      DEFAULT_DECK_CONFIG.modifiers
    ),
  };
}

function continueForcedDraw(game) {
    if (
        !game ||
        !game.forcedDraw ||
        game.status !== "playing"
    ) {
        return;
    }

    game.drawForcedCard();

    io.to(game.roomCode).emit("gameUpdated", {
        game
    });

    setTimeout(() => {
        if (
            !game.revealedCard ||
            game.status !== "playing"
        ) {
            return;
        }

        try {
            const result = game.resolveRevealedCard();

            io.to(game.roomCode).emit("gameUpdated", {
                game
            });

            if (
                result?.type === "CONTINUE_FORCED_DRAW"
            ) {
                setTimeout(() => {
                    continueForcedDraw(game);
                }, 500);

                return;
            }

            /*
             * Une carte spéciale a été tirée.
             * Le forcedDraw reste actif, mais il faut
             * d'abord résoudre pendingAction.
             */
            if (
                result?.type === "ACTION_REQUIRED"
            ) {
                return;
            }

            if (
                game.status === "round_finished"
            ) {
                setTimeout(() => {
                    game.startNextRound();

                    io.to(game.roomCode).emit(
                        "gameUpdated",
                        { game }
                    );
                }, 5000);
            }
        } catch (error) {
            console.error(
                "Erreur forced draw :",
                error.message
            );

            io.to(game.roomCode).emit(
                "gameError",
                error.message
            );
        }
    }, 1000);
}

function startNextForcedDraw(gameId) {
  const game = games[gameId];

  if (!game || !game.forcedDraw) {
    return;
  }

  const drawnCard = game.drawForcedCard();

  if (!drawnCard) {
    io.to(game.roomCode).emit("gameUpdated", {
      game,
    });

    return;
  }

  io.to(game.roomCode).emit("gameUpdated", {
    game,
  });

  setTimeout(() => {
    if (!games[gameId]) {
      return;
    }

    if (
      !game.revealedCard ||
      game.revealedCard.card.id !== drawnCard.id
    ) {
      return;
    }

    try {
      const result = game.resolveRevealedCard();

      io.to(game.roomCode).emit("gameUpdated", {
        game,
      });

      if (result?.type === "CONTINUE_FORCED_DRAW") {
        startNextForcedDraw(gameId);
        return;
      }

      if (game.status === "round_finished") {
        scheduleNextRound(gameId);
      }
    } catch (error) {
      game.drawLocked = false;

      io.to(game.roomCode).emit(
        "gameError",
        error.message
      );
    }
  }, 1000);
}

function scheduleNextRound(gameId) {
  setTimeout(() => {
    const game = games[gameId];

    if (!game || game.status !== "round_finished") {
      return;
    }

    game.startNextRound();

    io.to(game.roomCode).emit("gameUpdated", {
      game,
    });
  }, 5000);
}

io.on("connection", (socket) => {
  console.log("Joueur connecté :", socket.user.username, socket.id);

  socket.on("updateDeckConfig", ({ roomCode, deckConfig }) => {
    const code = roomCode.trim().toUpperCase();
    const room = rooms[code];

    if (!room) {
      return socket.emit("roomError", "Room introuvable");
    }

    if (room.hostId !== socket.user.id) {
      return socket.emit(
        "roomError",
        "Seul l'hôte peut modifier les paramètres"
      );
    }

    if (room.status === "playing") {
      return socket.emit(
        "roomError",
        "Impossible de modifier le paquet pendant la partie"
      );
    }

    try {
      room.deckConfig = validateDeckConfig(deckConfig);

      io.to(code).emit("roomUpdated", {
        room,
      });

      console.log(
        "Configuration du paquet mise à jour :",
        room.deckConfig
      );
    } catch (error) {
      socket.emit("roomError", error.message);
    }
  });

  socket.on("createRoom", () => {
    const roomCode = generateRoomCode();

    rooms[roomCode] = {
      code: roomCode,
      hostId: socket.user.id,
      status: "lobby",

      players: [
        {
          id: socket.user.id,
          username: socket.user.username,
        },
      ],

      deckConfig: {
        actions: {
          ...DEFAULT_DECK_CONFIG.actions,
        },

        modifiers: {
          ...DEFAULT_DECK_CONFIG.modifiers,
        },
      },
    };

    socket.join(roomCode);

    socket.emit("roomCreated", {
      roomCode,
      room: rooms[roomCode],
    });

    console.log("Room créée :", roomCode);
  });

  socket.on("joinRoom", ({ roomCode }) => {
    const code = roomCode.trim().toUpperCase();
    const room = rooms[code];

    if (!room) {
      return socket.emit("roomError", "Room introuvable");
    }

    const alreadyInRoom = room.players.some(
      (player) => player.id === socket.user.id
    );

    if (!alreadyInRoom) {
      room.players.push({
        id: socket.user.id,
        username: socket.user.username,
        displayName: socket.user.displayName,
        elo: socket.user.elo,
      });
    }

    socket.join(code);

    socket.emit("roomJoined", {
      room,
    });

    io.to(code).emit("roomUpdated", {
      room,
    });

    console.log("Room après join :", room);
  });

  socket.on("startGame", ({ roomCode }) => {
    const code = roomCode.trim().toUpperCase();
    const room = rooms[code];

    if (!room) {
      return socket.emit("roomError", "Room introuvable");
    }

    if (room.hostId !== socket.user.id) {
      return socket.emit("roomError", "Seul l'hôte peut démarrer la partie");
    }

    const game = new Game(room);

    room.status = "playing";
    games[code] = game;

    io.to(code).emit("gameStarted", {
      room,
      game,
      gameId: code,
    });

    console.log("Partie démarrée :", code);
  });

  socket.on("drawCard", async ({ gameId }) => {
    const game = games[gameId];

    if (!game) {
      return socket.emit(
        "gameError",
        "Partie introuvable"
      );
    }

    try {
      const drawnCard = game.drawCard(socket.user.id);

      io.to(game.roomCode).emit("gameUpdated", {
        game,
      });

      setTimeout(async () => {
        if (!games[gameId]) {
          return;
        }

        if (
          !game.revealedCard ||
          game.revealedCard.card.id !== drawnCard.id
        ) {
          return;
        }

        try {
          const result = game.resolveRevealedCard();

          await saveGameElo(game);

          io.to(game.roomCode).emit("gameUpdated", {
            game,
          });

          if (result?.type === "CONTINUE_FORCED_DRAW") {
            startNextForcedDraw(gameId);
            return;
          }

          if (game.status === "round_finished") {
            scheduleNextRound(gameId);
          }
        } catch (error) {
          game.drawLocked = false;

          socket.emit(
            "gameError",
            error.message
          );
        }
      }, 1000);
    } catch (error) {
      socket.emit("gameError", error.message);
    }
  });

  socket.on("stay", async ({ gameId }) => {
    const game = games[gameId];

    if (!game) {
      return socket.emit("gameError", "Partie introuvable");
    }

    try {
      game.stay(socket.user.id);

      io.to(game.roomCode).emit("gameUpdated", {
        game,
      });

      await saveGameElo(game);

      if (game.status === "round_finished") {
        setTimeout(() => {
          game.startNextRound();

          io.to(game.roomCode).emit("gameUpdated", {
            game,
          });
        }, 5000);
      }
    } catch (error) {
      socket.emit("gameError", error.message);
    }
  });

  socket.on(
        "resolvePendingAction",
        async ({
            gameId,
            targetPlayerId,
            cardIndex
        }) => {
            const game = games[gameId];

            if (!game) {
                return socket.emit(
                    "gameError",
                    "Partie introuvable"
                );
            }

            try {
                const pendingAction =
                    game.pendingAction;

                if (!pendingAction) {
                    throw new Error(
                        "NO_PENDING_ACTION"
                    );
                }

                let result;

                /*
                 * DISCARD :
                 * la cible a déjà été choisie,
                 * on choisit maintenant sa carte.
                 */
                if (
                    pendingAction.card.effect ===
                        "DISCARD" &&
                    pendingAction.step ===
                        "CHOOSE_CARD"
                ) {
                    result =
                        game.applyDiscard(cardIndex);
                }

                /*
                 * STEAL :
                 * la cible a déjà été choisie,
                 * on choisit maintenant la carte à voler.
                 */
                else if (
                    pendingAction.card.effect ===
                        "STEAL" &&
                    pendingAction.step ===
                        "CHOOSE_CARD"
                ) {
                    result =
                        game.applySteal(cardIndex);
                }

                /*
                 * SWAP :
                 * choix de la première carte.
                 */
                else if (
                    pendingAction.card.effect ===
                        "SWAP" &&
                    pendingAction.step ===
                        "CHOOSE_FIRST_CARD"
                ) {
                    result =
                        game.selectSwapFirstCard(
                            cardIndex
                        );
                }

                /*
                 * SWAP :
                 * choix de la deuxième carte
                 * et application de l'échange.
                 */
                else if (
                    pendingAction.card.effect ===
                        "SWAP" &&
                    pendingAction.step ===
                        "CHOOSE_SECOND_CARD"
                ) {
                    result =
                        game.applySwap(cardIndex);
                }

                /*
                 * Tous les choix de joueur :
                 *
                 * - modificateur
                 * - Flip 3
                 * - Unflip 3
                 * - One More
                 * - Freeze
                 * - Second Chance
                 * - première cible de Discard
                 * - première cible de Steal
                 * - première/deuxième cible de Swap
                 */
                else {
                    result =
                        game.resolvePendingAction(
                            socket.user.id,
                            targetPlayerId
                        );
                }

                io.to(game.roomCode).emit(
                    "gameUpdated",
                    { game }
                );

                await saveGameElo(game);

                /*
                 * Démarrage d'une pioche forcée :
                 *
                 * Flip 3  → jusqu'à 3 cartes
                 * One More → exactement 1 carte
                 */
                if (
                    result?.type ===
                        "FLIP_3_STARTED" ||
                    result?.type ===
                        "ONE_MORE_STARTED"
                ) {
                    setTimeout(() => {
                        continueForcedDraw(game);
                    }, 300);

                    return;
                }

                /*
                 * Une action spéciale a été tirée
                 * pendant Flip 3 ou One More.
                 *
                 * Une fois cette action résolue,
                 * on reprend la pioche forcée.
                 */
                if (
                    game.forcedDraw &&
                    !game.pendingAction &&
                    !game.revealedCard &&
                    game.status === "playing"
                ) {
                    setTimeout(() => {
                        continueForcedDraw(game);
                    }, 300);

                    return;
                }

                if (
                    game.status ===
                    "round_finished"
                ) {
                    setTimeout(() => {
                        game.startNextRound();

                        io.to(game.roomCode).emit(
                            "gameUpdated",
                            { game }
                        );
                    }, 5000);
                }
            } catch (error) {
                console.error(
                    "Erreur resolvePendingAction :",
                    error.message
                );

                socket.emit(
                    "gameError",
                    error.message
                );
            }
        }
    );

  socket.on("leaveRoom", ({ roomCode }) => {
    const code = roomCode.trim().toUpperCase();
    const room = rooms[code];

    if (!room) return;

    room.players = room.players.filter(
      (player) => player.id !== socket.user.id
    );

    socket.leave(code);

    if (room.players.length === 0) {
      delete rooms[code];
      console.log("Room supprimée :", code);
      return;
    }

    if (room.hostId === socket.user.id) {
      room.hostId = room.players[0].id;
    }

    io.to(code).emit("roomUpdated", {
      room,
    });

    console.log(`${socket.user.username} a quitté ${code}`);
  });

  socket.on("disconnect", () => {
    console.log("Joueur déconnecté :", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("Serveur dogflip7 OK");
});

server.listen(3000, () => {
  console.log("Serveur lancé sur http://localhost:3000");
});