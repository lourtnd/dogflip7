import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRoom } from "../context/RoomContext";
import { useAuth } from "../context/AuthContext";
import socket from "../services/socket";
import "./Game.css";

function Game() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, clearRoom } = useRoom();
  const [showFlip7, setShowFlip7] = useState(false);
  const [flip7Player, setFlip7Player] = useState(null);
  const lastAnimatedRound = useRef(null);
  const [showVictory, setShowVictory] = useState(false);
  const lastAnimatedWinner = useRef(null);

  const getSortedCardsWithOriginalIndex = (player) => {
    if (!player) {
      return [];
    }

    return player.roundCards
      .map((card, originalIndex) => ({
        card,
        originalIndex,
      }))
      .sort((a, b) => a.card.value - b.card.value);
  };

  useEffect(() => {
    socket.on("gameUpdated", ({ game }) => {
      setGame(game);
    });

    return () => {
      socket.off("gameUpdated");
    };
  }, [setGame]);



  useEffect(() => {
    const playerWithFlip7 = game?.players?.find(
      (player) => player.flip7
    );

    if (!playerWithFlip7) {
      return;
    }

    if (lastAnimatedRound.current === game.roundNumber) {
      return;
    }

    lastAnimatedRound.current = game.roundNumber;

    setFlip7Player(playerWithFlip7);
    setShowFlip7(true);

    const timeout = setTimeout(() => {
      setShowFlip7(false);
    }, 2500);

    return () => clearTimeout(timeout);
  }, [game]);

  useEffect(() => {
    if (
      game?.status !== "finished" ||
      !game?.winner
    ) {
      return;
    }

    const winnerAnimationId =
      `${game.id}-${game.winner.id}-${game.winner.score}`;

    if (
      lastAnimatedWinner.current === winnerAnimationId
    ) {
      return;
    }

    lastAnimatedWinner.current = winnerAnimationId;
    setShowVictory(true);
  }, [
    game?.status,
    game?.winner,
    game?.id
  ]);

  if (!game) {
    return (
      <main>
        <h1>Partie {id}</h1>
        <p>Partie introuvable ou page rechargée.</p>
        <button onClick={() => navigate("/home")}>Retour accueil</button>
      </main>
    );
  }

  const pendingAction = game.pendingAction;

  const isPendingActionOwner =
      pendingAction?.sourcePlayerId === user.id;

  const selectedPlayerId =
      pendingAction?.payload?.targetPlayerId ||
      pendingAction?.payload?.firstPlayerId ||
      pendingAction?.payload?.secondPlayerId;

  const selectedPlayer = game.players.find(
      (player) => player.id === selectedPlayerId
  );

  const currentPlayer = game.players[game.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === user.id;
  const me = game.players.find((player) => player.id === user.id);

  const resolvePendingAction = ({
      targetPlayerId = null,
      cardIndex = null
  }) => {
      socket.emit("resolvePendingAction", {
          gameId: game.id,
          targetPlayerId,
          cardIndex
      });
  };

  const drawDisabled =
    !isMyTurn ||
    Boolean(game.revealedCard) ||
    Boolean(game.drawLocked) ||
    Boolean(game.pendingAction) ||
    game.status !== "playing";

  function drawCard() {
    if (drawDisabled) {
      return;
    }

    socket.emit("drawCard", {
      gameId: game.id,
    });
  }

  function stay() {
    socket.emit("stay", {
      gameId: game.id,
    });
  }

  function leaveGame() {
    clearRoom();
    navigate("/home");
  }

  return (
    <main className="game-page">

      {showVictory && game.winner && (
        <div className="victory-overlay">
          <div className="victory-flash" />

          <div className="victory-confetti">
            {Array.from({ length: 40 }).map(
              (_, index) => (
                <span
                  key={index}
                  className="victory-confetti-piece"
                  style={{
                    "--confetti-index": index,
                    "--confetti-x": `${
                      (index * 37) % 100
                    }vw`,
                    "--confetti-delay": `${
                      (index % 10) * 0.08
                    }s`,
                    "--confetti-duration": `${
                      2.2 + (index % 5) * 0.25
                    }s`,
                    "--confetti-rotation": `${
                      180 + (index % 6) * 90
                    }deg`,
                  }}
                />
              )
            )}
          </div>

          <div className="victory-content">
            <span className="victory-crown">
              👑
            </span>

            <span className="victory-title">
              VICTOIRE DE
            </span>

            <span className="victory-player">
              {game.winner.username}
            </span>

            <span className="victory-message">
              Félicitations !
            </span>

            <span className="victory-score">
              {game.winner.score} points
            </span>

            <div className="victory-ranking">
              <h3>Classement final</h3>

              {game.players
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((player, index) => {
                const eloResult = game.eloResults?.find(
                  (result) => result.playerId === player.id
                );

                const eloChange = eloResult?.eloChange ?? 0;
                const newElo = eloResult?.newElo ?? player.elo ?? 1000;

                return (
                  <div
                    key={player.id}
                    className={`victory-ranking-row ${
                      index === 0 ? "winner-row" : ""
                    }`}
                  >
                    <span className="victory-rank">
                      {index === 0
                        ? "🥇"
                        : index === 1
                          ? "🥈"
                          : index === 2
                            ? "🥉"
                            : `${index + 1}.`}
                    </span>

                    <span className="victory-player-name">
                      {player.displayName || player.username}
                    </span>

                    <span className="victory-score">
                      {player.score} points
                    </span>

                    <span
                      className={`victory-elo-change ${
                        eloChange > 0
                          ? "positive"
                          : eloChange < 0
                            ? "negative"
                            : "neutral"
                      }`}
                    >
                      {newElo} Elo{" "}
                      {eloChange > 0
                        ? `(+${eloChange})`
                        : eloChange < 0
                          ? `(${eloChange})`
                          : "(0)"}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="victory-button"
              onClick={leaveGame}
            >
              Retour à l’accueil
            </button>
          </div>
        </div>
      )}

      {showFlip7 && flip7Player && (
        <div className="flip7-overlay">
          <div className="flip7-flash" />

          <div className="flip7-explosion">
            {Array.from({ length: 40 }).map((_, index) => (
              <span
                key={index}
                className="flip7-particle"
                style={{
                  "--particle-index": index,
                  "--particle-angle": `${index * 15}deg`,
                  "--particle-distance": `${180 + (index % 5) * 35}px`,
                  "--particle-delay": `${(index % 4) * 0.03}s`,
                }}
              />
            ))}
          </div>

          <div className="flip7-animation">
            <span className="flip7-player">
              {flip7Player.username}
            </span>

            <span className="flip7-title">
              FLIP 7
            </span>

            <span className="flip7-subtitle">
              BOOM ! +15 POINTS
            </span>
          </div>
        </div>
      )}
      
       <div className="game-left">
      <section className="top-bar">
        <img src="/logo-dogflip7.png" className="game-logo" alt="DogFlip7" />

        <div className="deck-zone">
          <div className="deck-stack">
            <div className="deck-card back3"></div>
            <div className="deck-card back2"></div>
            <div className="deck-card back1"></div>

            <div className="deck-card front">
              <span className="deck-count">{game.deck.length}</span>
            </div>
          </div>
        </div>

        <div className="draw-zone">
          {game.revealedCard && (
            <img
              className="playing-card revealed-card"
              src={`/cards/${game.revealedCard.card.image}`}
              alt={game.revealedCard.card.label ?? game.revealedCard.card.value}
            />
          )}
        </div>

        <div className="action-zone">
          {pendingAction && isPendingActionOwner && (
            <>
              <img
                className="modifier-card pending-card"
                src={`/cards/${pendingAction.card.image}`}
                alt={pendingAction.card.label || pendingAction.card.effect}
              />

              {/* CHOIX D'UN JOUEUR */}
              {(pendingAction.step === "CHOOSE_TARGET" ||
                pendingAction.step === "CHOOSE_SECOND_TARGET") && (
                <div className="target-list">
                  <p>
                    {pendingAction.step === "CHOOSE_SECOND_TARGET"
                      ? "Choisis le deuxième joueur"
                      : "Choisis un joueur"}
                  </p>

                  {game.players
                    .filter((player) => {
                      if (player.busted) {
                        return false;
                      }

                      if (pendingAction.card.effect === "STEAL") {
                        return player.id !== pendingAction.sourcePlayerId;
                      }

                      return true;
                    })
                    .map((player) => (
                      <button
                        key={player.id}
                        className="target-player"
                        onClick={() =>
                          resolvePendingAction({
                            targetPlayerId: player.id,
                          })
                        }
                      >
                        {player.username}
                        {player.stayed ? " (arrêté)" : ""}
                      </button>
                    ))}
                </div>
              )}
              {(pendingAction.step === "CHOOSE_CARD" ||
                pendingAction.step === "CHOOSE_FIRST_CARD" ||
                pendingAction.step === "CHOOSE_SECOND_CARD") &&
                selectedPlayer && (
                  <p className="action-instruction">
                    Clique sur une carte de {selectedPlayer.username}
                  </p>
                )}
            </>
          )}
        </div>

        <div className="turn-zone">
          <h3>
            Tour de : {currentPlayer?.username}
            {isMyTurn ? " (toi)" : ""}
          </h3>

          {game.status === "playing" &&
            !game.pendingAction &&
            isMyTurn &&
            me &&
            !me.busted &&
            !me.stayed && (
              <div className="turn-buttons">
                <button
                  type="button"
                  onClick={drawCard}
                  disabled={drawDisabled}
                >
                  {game.revealedCard || game.drawLocked
                    ? "Piocher"
                    : "Piocher"}
                </button>
                <button onClick={stay}>S’arrêter</button>
              </div>
            )}
        </div>
      </section>

        <section className="game-main">
          <section className="players-grid">
            {game.players.map((player) => {
              const isCurrentPlayer = player.id === currentPlayer?.id;
              const isMe = player.id === user.id;

              const sortedCards = getSortedCardsWithOriginalIndex(player);

              const isCardSelectionStep =
                pendingAction &&
                isPendingActionOwner &&
                (
                  pendingAction.step === "CHOOSE_CARD" ||
                  pendingAction.step === "CHOOSE_FIRST_CARD" ||
                  pendingAction.step === "CHOOSE_SECOND_CARD"
                );

              const canSelectCards =
                isCardSelectionStep &&
                player.id === selectedPlayerId;

              return (
                <article
                  key={player.id}
                  className={`player-card ${isCurrentPlayer ? "active-player" : ""}`}
                >
                  <div className="player-header">
                    <h3>
                      {player.displayName}
                      {isMe ? " (toi)" : ""}
                    </h3>

                    <div className="player-score">
                      <strong>
                        {player.flip7
                          ? (
                            <>
                              {player.roundScore - 15} <span className="flip7-bonus">(+15)</span> pts
                            </>
                          )
                          : `${player.roundScore} pts`}
                      </strong>

                      {player.busted && (
                        <span className="player-state busted">(Busted)</span>
                      )}

                      {!player.busted && player.stayed && (
                        <span className="player-state stayed">
                          {player.flip7 ? "(Flip 7)" : "(Arrêté)"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="modifier-row">
                    {player.modifierCards.map((card) => (
                      <img
                        key={card.id}
                        className={`modifier-card ${
                          player.busted ? "busted-card" : ""
                        }`}
                        src={
                          player.busted
                            ? "/cards/back.jpeg"
                            : `/cards/${card.image}`
                        }
                        alt={
                          player.busted
                            ? "Carte retournée"
                            : card.label
                        }
                      />
                    ))}
                  </div>

                  <div
                    className={`cards-row ${
                      canSelectCards ? "selectable-cards-row" : ""
                    }`}
                  >
                    {sortedCards.length === 0 ? (
                      <p>Aucune carte</p>
                    ) : (
                      sortedCards.map(({ card, originalIndex }) => (
                        <button
                          key={`${card.id}-${originalIndex}`}
                          type="button"
                          className={`table-card-button ${
                            canSelectCards ? "selectable-card" : ""
                          }`}
                          disabled={!canSelectCards}
                          onClick={() => {
                            if (!canSelectCards) {
                              return;
                            }

                            resolvePendingAction({
                              cardIndex: originalIndex,
                            });
                          }}
                        >
                          <img
                            className={`playing-card ${
                              player.busted ? "busted-card" : ""
                            }`}
                            src={
                              player.busted
                                ? "/cards/back.jpeg"
                                : `/cards/${card.image}`
                            }
                            alt={
                              player.busted
                                ? "Carte retournée"
                                : card.label ?? card.value
                            }
                          />
                        </button>
                      ))
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        </section>
        </div>

        <aside className="scoreboard">
          <h2>Scores</h2>

          {game.players
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((player) => (
              <div className="score-row" key={player.id}>
                <span>{player.username}</span>

                <span>
                  {player.score}
                  {player.busted ? " (💥)" : ` (+${player.roundScore})`}
                </span>
              </div>
            ))}

          <hr />

          <p>Objectif : {game.targetScore}</p>
          <p>Round : {game.roundNumber}</p>
        </aside>
    </main>
  );
}

export default Game;