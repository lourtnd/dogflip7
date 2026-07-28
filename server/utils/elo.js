function calculateEloChanges(players, kFactor = 32) {
  if (!Array.isArray(players) || players.length < 2) {
    return [];
  }

  const changes = new Map();

  for (const player of players) {
    changes.set(player.id, 0);
  }

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const playerA = players[i];
      const playerB = players[j];

      const eloA = playerA.elo ?? 1000;
      const eloB = playerB.elo ?? 1000;

      const expectedA =
        1 / (1 + Math.pow(10, (eloB - eloA) / 400));

      const expectedB = 1 - expectedA;

      let resultA;
      let resultB;

      if (playerA.score > playerB.score) {
        resultA = 1;
        resultB = 0;
      } else if (playerA.score < playerB.score) {
        resultA = 0;
        resultB = 1;
      } else {
        resultA = 0.5;
        resultB = 0.5;
      }

      changes.set(
        playerA.id,
        changes.get(playerA.id) +
          kFactor * (resultA - expectedA)
      );

      changes.set(
        playerB.id,
        changes.get(playerB.id) +
          kFactor * (resultB - expectedB)
      );
    }
  }

  const opponentCount = players.length - 1;

  return players.map((player) => {
    const previousElo = player.elo ?? 1000;

    const eloChange = Math.round(
      changes.get(player.id) / opponentCount
    );

    return {
      playerId: player.id,
      username: player.username,
      previousElo,
      eloChange,
      newElo: Math.max(0, previousElo + eloChange),
    };
  });
}

module.exports = {
  calculateEloChanges,
};