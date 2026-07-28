const { createDeck } = require("./deck");
const { calculateEloChanges } = require("../../utils/elo");

class Game {
  constructor(room, modes = []) {
    this.id = room.code;

    this.roomCode = room.code;

    this.status = "playing";

    this.targetScore = 200;

    this.drawLocked = false;

    this.roundNumber = 1;

    this.eloResults = [];
    this.eloSaved = false;

    this.deckConfig = {
        actions: {
            ...room.deckConfig.actions,
        },

        modifiers: {
            ...room.deckConfig.modifiers,
        },
        };

    this.deck = createDeck({
        deckConfig: this.deckConfig,
        });

    this.discardPile = [];

    this.players = room.players.map((player) => ({
      id: player.id,
      username: player.username,
      displayName: player.displayName,
      elo: player.elo ?? 1000,

      score: 0,

      roundCards: [],

      roundScore: 0,

      busted: false,

      stayed: false,

      flip7: false,

      modifierCards: [],

      roundEffects: {
        secondChance: false
        }
    }));

    this.currentPlayerIndex = 0;

    this.pendingAction = null;

    this.revealedCard = null;

    this.forcedDraw = null;

    this.nextStartingPlayerId = null;
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
    }

    findPlayer(playerId) {
    return this.players.find((player) => player.id === playerId);
    }

    drawCard(playerId) {
        if (this.drawLocked) {
            throw new Error("DRAW_ALREADY_IN_PROGRESS");
        }

        if (this.pendingAction) {
            throw new Error("MODIFIER_TARGET_REQUIRED");
        }

        const currentPlayer = this.getCurrentPlayer();

        if (!currentPlayer || currentPlayer.id !== playerId) {
            throw new Error("NOT_YOUR_TURN");
        }

        if (this.revealedCard) {
            throw new Error("CARD_ALREADY_REVEALED");
        }

        if (this.deck.length === 0) {
            this.resetDeck();
        }

        this.drawLocked = true;

        const card = this.deck.shift();

        this.revealedCard = {
            card,
            playerId,
        };

        return card;
    }

    refreshPlayerRoundState(player) {
        if (!player) {
            throw new Error("PLAYER_NOT_FOUND");
        }

        const values = player.roundCards.map((card) => card.value);
        const uniqueValues = new Set(values);

        player.busted = uniqueValues.size !== values.length;

        if (player.busted) {
            player.roundScore = 0;
            player.stayed = false;
            player.flip7 = false;

            return {
                type: "PLAYER_BUSTED"
            };
        }

        this.calculatePlayerRoundScore(player);

        return {
            type: "PLAYER_STATE_REFRESHED"
        };
    }

    resolveRevealedCard() {
        if (!this.revealedCard) {
            return;
        }

        const { card, playerId, forced = false } = this.revealedCard;
        const player = this.findPlayer(playerId);

        this.revealedCard = null;
        this.drawLocked = false;

        if (!player) {
            throw new Error("PLAYER_NOT_FOUND");
        }

        if (forced && this.forcedDraw) {
            this.forcedDraw.remaining -= 1;
        }

        if (card.type === "NUMBER") {
            player.roundCards.push(card);

            const roundStateResult =
                this.updatePlayerRoundState(player);

            if (forced) {
                if (
                    player.busted ||
                    !this.forcedDraw ||
                    this.forcedDraw.remaining <= 0
                ) {
                    this.finishForcedDraw();

                    return {
                        type: "FORCED_DRAW_FINISHED",
                        roundStateResult
                    };
                }

                return {
                    type: "CONTINUE_FORCED_DRAW",
                    roundStateResult
                };
            }

            if (this.isRoundFinished()) {
            this.finishRound();
            } else {
            this.nextPlayer();
            }

            return {
            type: "NUMBER_RESOLVED",
            };
        }

        const actionCanBeUsed =
            this.canUseActionCard(card, playerId);

        if (!actionCanBeUsed) {
            this.discardPile.push(card);

            if (forced) {
                if (
                    player.busted ||
                    player.flip7 ||
                    this.isRoundFinished() ||
                    !this.forcedDraw ||
                    this.forcedDraw.remaining <= 0
                ) {
                    this.finishForcedDraw();

                    return {
                        type: "FORCED_DRAW_FINISHED",
                        roundStateResult
                    };
                }

                return {
                    type: "CONTINUE_FORCED_DRAW",
                    roundStateResult
                };
            }

            if (this.isRoundFinished()) {
                this.finishRound();
            } else {
                this.nextPlayer();
            }

            return {
                type: "ACTION_IGNORED",
                card
            };
        }

        this.pendingAction = {
            card,
            sourcePlayerId: playerId,
            step: this.getPendingActionStep(card),
            payload: {
                resumeForcedDraw: forced,
            },
        };

        return {
            type: "ACTION_REQUIRED",
        };
        }

    resetDeck() {
        this.deck = createDeck({
            deckConfig: this.deckConfig,
        });
    }

    updatePlayerRoundState(player) {
        const lastCard =
            player.roundCards[player.roundCards.length - 1];

        if (!lastCard) {
            return this.refreshPlayerRoundState(player);
        }

        const duplicateCount = player.roundCards.filter(
            (card) => card.value === lastCard.value
        ).length;

        if (duplicateCount >= 2) {
            if (player.roundEffects?.secondChance) {
                player.roundEffects.secondChance = false;

                const removedCard = player.roundCards.pop();

                this.discardPile.push(removedCard);

                const secondChanceIndex =
                    player.modifierCards.findIndex(
                        (card) =>
                            card.effect === "SECOND_CHANCE"
                    );

                if (secondChanceIndex !== -1) {
                    const [secondChanceCard] =
                        player.modifierCards.splice(
                            secondChanceIndex,
                            1
                        );

                    this.discardPile.push(secondChanceCard);
                }

                player.busted = false;
                player.flip7 = false;

                this.calculatePlayerRoundScore(player);

                return {
                    type: "SECOND_CHANCE_USED",
                    removedCard
                };
            }

            player.busted = true;
            player.stayed = false;
            player.flip7 = false;
            player.roundScore = 0;

            return {
                type: "PLAYER_BUSTED",
                card: lastCard
            };
        }

        player.busted = false;

        this.calculatePlayerRoundScore(player);

        const uniqueNumberValues = new Set(
            player.roundCards
                .filter((card) => card.type === "NUMBER")
                .map((card) => card.value)
        );

        if (uniqueNumberValues.size >= 7) {
            player.flip7 = true;

            // Tous les joueurs encore en jeu sont arrêtés
            this.players.forEach((currentPlayer) => {
                if (!currentPlayer.busted) {
                    currentPlayer.stayed = true;
                }
            });

            this.calculatePlayerRoundScore(player);

            return {
                type: "FLIP_7",
                playerId: player.id,
                card: lastCard
            };
        }

        player.flip7 = false;
        this.calculatePlayerRoundScore(player);

        return {
            type: "CARD_ACCEPTED",
            card: lastCard
        };
    }

    nextPlayer() {
        if (this.isRoundFinished()) {
            this.finishRound();
            return;
        }

        let attempts = 0;

        while (attempts < this.players.length) {
            this.currentPlayerIndex =
                (this.currentPlayerIndex + 1) %
                this.players.length;

            const player =
                this.players[this.currentPlayerIndex];

            if (!player.busted && !player.stayed) {
                return;
            }

            attempts += 1;
        }

        this.finishRound();
    }

    validateActionTarget(targetPlayerId) {
        const targetPlayer = this.findPlayer(targetPlayerId);

        if (!targetPlayer) {
            throw new Error("TARGET_NOT_FOUND");
        }

        if (targetPlayer.busted) {
            throw new Error("CANNOT_TARGET_BUSTED_PLAYER");
        }

        return targetPlayer;
    }

    stay(playerId) {
        const currentPlayer = this.getCurrentPlayer();

        if (!currentPlayer || currentPlayer.id !== playerId) {
            throw new Error("NOT_YOUR_TURN");
        }

        if (currentPlayer.busted || currentPlayer.stayed) {
            throw new Error("PLAYER_CANNOT_PLAY");
        }

        currentPlayer.stayed = true;

        if (this.isRoundFinished()) {
            this.finishRound();
        } else {
            this.nextPlayer();
        }
        }

    isRoundFinished() {
        return this.players.every((player) => player.busted || player.stayed);
    }

    finishRound() {
        if (
            this.status === "round_finished" ||
            this.status === "finished"
        ) {
            return;
        }

        this.players.forEach((player) => {
            if (!player.busted) {
            player.score += player.roundScore;
            }
        });

        const nextStartingPlayer = [...this.players].sort((playerA, playerB) => {
            // Priorité au meilleur score du round
            if (playerB.roundScore !== playerA.roundScore) {
                return playerB.roundScore - playerA.roundScore;
            }

            // En cas d'égalité, priorité au meilleur score total
            if (playerB.score !== playerA.score) {
                return playerB.score - playerA.score;
            }

            // Égalité complète : conserve l'ordre actuel des joueurs
            return (
                this.players.indexOf(playerA) -
                this.players.indexOf(playerB)
            );
        })[0];

        this.nextStartingPlayerId =
            nextStartingPlayer?.id ?? this.players[0]?.id;

        const winner = this.players.find(
            (player) => !player.busted && player.score >= this.targetScore
        );

        if (winner) {
            this.status = "finished";

            this.winner = {
                id: winner.id,
                username: winner.username,
                score: winner.score,
            };

            if (this.eloResults.length === 0) {
                this.eloResults = calculateEloChanges(
                this.players,
                32
                );

                for (const result of this.eloResults) {
                const player = this.players.find(
                    (currentPlayer) =>
                    currentPlayer.id === result.playerId
                );

                if (player) {
                    player.elo = result.newElo;
                }
                }
            }

            return;
        }

        this.status = "round_finished";
        }

    startNextRound() {
        this.status = "playing";
        this.startNewRound();
        }

    startNewRound() {
    this.roundNumber += 1;

    this.pendingAction = null;

    this.players.forEach((player) => {
        player.roundCards = [];
        player.roundScore = 0;
        player.busted = false;
        player.stayed = false;
        player.flip7 = false;
        player.modifierCards = [];
        player.roundEffects = {
            secondChance: false
        };
    });

    const nextStartingPlayerIndex =
        this.players.findIndex(
            (player) =>
                player.id === this.nextStartingPlayerId
        );

    this.currentPlayerIndex =
        nextStartingPlayerIndex !== -1
            ? nextStartingPlayerIndex
            : 0;

    this.nextStartingPlayerId = null;

    this.revealedCard = null;

    this.forcedDraw = null;
    }

    calculatePlayerRoundScore(player) {
        if (player.busted) {
            player.roundScore = 0;
            return;
        }

        const numberCards = player.roundCards.filter(
            (card) => card.type === "NUMBER"
        );

        let score = numberCards.reduce((sum, card) => sum + card.value, 0);

        const addModifiers = player.modifierCards.filter(
            (card) => card.operation === "ADD"
        );

        addModifiers.forEach((card) => {
            score += card.value;
        });

        const multiplyModifiers = player.modifierCards.filter(
            (card) => card.operation === "MULTIPLY"
        );

        multiplyModifiers.forEach((card) => {
            score *= card.value;
        });

        const divideModifiers = player.modifierCards.filter(
            (card) => card.operation === "DIVIDE"
        );

        divideModifiers.forEach((card) => {
            score = Math.floor(score / card.value);
        });

        if (player.flip7) {
            score += 15;
        }

        player.roundScore = score;
        }

    resolvePendingAction(sourcePlayerId, targetPlayerId) {
        if (!this.pendingAction) {
            throw new Error("NO_PENDING_ACTION");
        }

        if (this.pendingAction.sourcePlayerId !== sourcePlayerId) {
            throw new Error("NOT_YOUR_ACTION");
        }

        const actionCard = this.pendingAction.card;

        if (actionCard.effect === "FLIP_3") {
            this.startFlip3(targetPlayerId);

            return {
            type: "FLIP_3_STARTED",
            };
        }

        if (actionCard.effect === "UNFLIP_3") {
            return this.applyUnflip3(targetPlayerId);
        }

        if (actionCard.effect === "DISCARD") {
            if (this.pendingAction.step === "CHOOSE_TARGET") {
                const targetPlayer = this.validateActionTarget(targetPlayerId);

                if (!targetPlayer) {
                throw new Error("TARGET_NOT_FOUND");
                }

                if (targetPlayer.roundCards.length === 0) {
                throw new Error("TARGET_HAS_NO_CARDS");
                }

                this.pendingAction.step = "CHOOSE_CARD";
                this.pendingAction.payload.targetPlayerId = targetPlayerId;

                return {
                type: "DISCARD_TARGET_SELECTED",
                };
            }
        }

        if (actionCard.effect === "STEAL") {
            if (this.pendingAction.step === "CHOOSE_TARGET") {
                const targetPlayer = this.validateActionTarget(targetPlayerId);

                if (!targetPlayer) {
                    throw new Error("TARGET_NOT_FOUND");
                }

                if (targetPlayer.id === sourcePlayerId) {
                    throw new Error("CANNOT_STEAL_FROM_YOURSELF");
                }

                if (targetPlayer.roundCards.length === 0) {
                    throw new Error("TARGET_HAS_NO_CARDS");
                }

                this.pendingAction.step = "CHOOSE_CARD";
                this.pendingAction.payload.targetPlayerId = targetPlayerId;

                return {
                    type: "STEAL_TARGET_SELECTED"
                };
            }
        }

        if (actionCard.effect === "SWAP") {
            if (this.pendingAction.step === "CHOOSE_TARGET") {
                const targetPlayer = this.validateActionTarget(targetPlayerId);

                if (!targetPlayer) {
                    throw new Error("TARGET_NOT_FOUND");
                }

                if (targetPlayer.roundCards.length === 0) {
                    throw new Error("TARGET_HAS_NO_CARDS");
                }

                this.pendingAction.step = "CHOOSE_FIRST_CARD";
                this.pendingAction.payload.firstPlayerId = targetPlayerId;

                return {
                    type: "SWAP_FIRST_PLAYER_SELECTED"
                };
            }

            if (this.pendingAction.step === "CHOOSE_SECOND_TARGET") {
                const secondPlayer = this.validateActionTarget(targetPlayerId);

                if (!secondPlayer) {
                    throw new Error("TARGET_NOT_FOUND");
                }

                if (secondPlayer.roundCards.length === 0) {
                    throw new Error("TARGET_HAS_NO_CARDS");
                }

                this.pendingAction.step = "CHOOSE_SECOND_CARD";
                this.pendingAction.payload.secondPlayerId = targetPlayerId;

                return {
                    type: "SWAP_SECOND_PLAYER_SELECTED"
                };
            }
        }

        if (actionCard.effect === "ONE_MORE") {
            const targetPlayer = this.validateActionTarget(targetPlayerId);

            this.pendingAction = null;

            this.forcedDraw = {
                targetPlayerId: targetPlayer.id,
                remaining: 1,
                reason: "ONE_MORE",
            };

            return {
                type: "ONE_MORE_STARTED",
            };
        }

        if (actionCard.effect === "FREEZE") {
            return this.applyFreeze(targetPlayerId);
        }

        if (actionCard.effect === "SECOND_CHANCE") {
            return this.applySecondChance(targetPlayerId);
        }

        if (actionCard.type === "MODIFIER") {
            const targetPlayer =
                this.validateActionTarget(targetPlayerId);

            targetPlayer.modifierCards.push(actionCard);
            this.calculatePlayerRoundScore(targetPlayer);

            this.pendingAction = null;

            if (this.isRoundFinished()) {
                this.finishRound();
            } else {
                this.nextPlayer();
            }

            return {
                type: "MODIFIER_APPLIED"
            };
        }

        throw new Error("ACTION_NOT_IMPLEMENTED");
        }

    getPendingActionStep(card) {
        return "CHOOSE_TARGET";
    }

    completePendingAction() {
        const shouldResumeForcedDraw =
            this.pendingAction?.payload?.resumeForcedDraw === true;

        this.pendingAction = null;

        if (shouldResumeForcedDraw && this.forcedDraw) {
            if (this.forcedDraw.remaining <= 0) {
                this.finishForcedDraw();

                return {
                    type: "FORCED_DRAW_FINISHED"
                };
            }

            return {
                type: "CONTINUE_FORCED_DRAW"
            };
        }

        if (this.isRoundFinished()) {
            this.finishRound();
        } else {
            this.nextPlayer();
        }

        return {
            type: "ACTION_COMPLETED"
        };
    }

    startFlip3(targetPlayerId) {
        const targetPlayer =
            this.validateActionTarget(targetPlayerId);

        const wasAlreadyForced =
            this.pendingAction?.payload?.resumeForcedDraw === true;

        if (wasAlreadyForced && this.forcedDraw) {
            /*
            * Le Flip 3 a déjà été compté lors de sa révélation.
            * On ne lance pas un nouveau compteur de trois cartes.
            */
            this.pendingAction = null;

            if (this.forcedDraw.remaining <= 0) {
                this.finishForcedDraw();
            }

            return;
        }

        this.forcedDraw = {
            targetPlayerId: targetPlayer.id,
            remaining: 3,
            reason: "FLIP_3",
        };

        this.pendingAction = null;
    }

    drawForcedCard() {
        if (!this.forcedDraw) {
            throw new Error("NO_FORCED_DRAW");
        }

        const targetPlayer = this.findPlayer(this.forcedDraw.targetPlayerId);

        if (!targetPlayer || targetPlayer.busted) {
            this.finishForcedDraw();
            return null;
        }

        if (this.deck.length === 0) {
            this.resetDeck();
        }

        const card = this.deck.shift();

        this.revealedCard = {
            card,
            playerId: targetPlayer.id,
            forced: true,
        };

        return card;
        }

    finishForcedDraw() {
        if (!this.forcedDraw) {
            return;
        }

        const {
            targetPlayerId,
            reason
        } = this.forcedDraw;

        const targetPlayer = this.findPlayer(targetPlayerId);

        this.forcedDraw = null;

        if (
            reason === "ONE_MORE" &&
            targetPlayer &&
            !targetPlayer.busted
        ) {
            targetPlayer.stayed = true;
        }

        if (this.isRoundFinished()) {
            this.finishRound();
        } else {
            this.nextPlayer();
        }
    }
    
    applyUnflip3(targetPlayerId) {
        const targetPlayer = this.validateActionTarget(targetPlayerId);

        const removedCards = targetPlayer.roundCards.splice(-3);

        this.discardPile.push(...removedCards);
        this.refreshPlayerRoundState(targetPlayer);

        this.pendingAction = null;

        if (this.isRoundFinished()) {
            this.finishRound();
        } else {
            this.nextPlayer();
        }

        return {
            type: "UNFLIP_3_APPLIED",
            targetPlayerId,
            removedCards,
        };
        }

    applyDiscard(cardIndex) {
        if (!this.pendingAction) {
            throw new Error("NO_PENDING_ACTION");
        }

        if (this.pendingAction.card.effect !== "DISCARD") {
            throw new Error("INVALID_PENDING_ACTION");
        }

        if (this.pendingAction.step !== "CHOOSE_CARD") {
            throw new Error("INVALID_ACTION_STEP");
        }

        const targetPlayerId =
            this.pendingAction.payload.targetPlayerId;

        const targetPlayer =
            this.validateActionTarget(targetPlayerId);

        if (targetPlayer.roundCards.length === 0) {
            throw new Error("TARGET_HAS_NO_CARDS");
        }

        if (
            !Number.isInteger(cardIndex) ||
            cardIndex < 0 ||
            cardIndex >= targetPlayer.roundCards.length
        ) {
            throw new Error("INVALID_CARD_INDEX");
        }

        const [removedCard] =
            targetPlayer.roundCards.splice(cardIndex, 1);

        this.discardPile.push(removedCard);

        this.refreshPlayerRoundState(targetPlayer);

        this.pendingAction = null;

        if (this.isRoundFinished()) {
            this.finishRound();
        } else {
            this.nextPlayer();
        }

        return {
            type: "DISCARD_APPLIED",
            targetPlayerId,
            removedCard
        };
    }

    applySteal(cardIndex) {
        if (!this.pendingAction) {
            throw new Error("NO_PENDING_ACTION");
        }

        if (this.pendingAction.card.effect !== "STEAL") {
            throw new Error("INVALID_PENDING_ACTION");
        }

        if (this.pendingAction.step !== "CHOOSE_CARD") {
            throw new Error("INVALID_ACTION_STEP");
        }

        const sourcePlayerId =
            this.pendingAction.sourcePlayerId;

        const targetPlayerId =
            this.pendingAction.payload.targetPlayerId;

        const sourcePlayer =
            this.findPlayer(sourcePlayerId);

        const targetPlayer = this.validateActionTarget(targetPlayerId);

        if (!sourcePlayer) {
            throw new Error("SOURCE_PLAYER_NOT_FOUND");
        }

        if (!targetPlayer) {
            throw new Error("TARGET_NOT_FOUND");
        }

        if (targetPlayer.roundCards.length === 0) {
            throw new Error("TARGET_HAS_NO_CARDS");
            }

        if (
            !Number.isInteger(cardIndex) ||
            cardIndex < 0 ||
            cardIndex >= targetPlayer.roundCards.length
        ) {
            throw new Error("INVALID_CARD_INDEX");
        }

        const [stolenCard] =
            targetPlayer.roundCards.splice(cardIndex, 1);

        sourcePlayer.roundCards.push(stolenCard);

        this.refreshPlayerRoundState(targetPlayer);
        this.refreshPlayerRoundState(sourcePlayer);

        this.pendingAction = null;

        if (this.isRoundFinished()) {
            this.finishRound();
        } else {
            this.nextPlayer();
        }

        return {
            type: "STEAL_APPLIED",
            sourcePlayerId,
            targetPlayerId,
            stolenCard
        };
    }

    selectSwapFirstCard(cardIndex) {
        if (!this.pendingAction) {
            throw new Error("NO_PENDING_ACTION");
        }

        if (this.pendingAction.card.effect !== "SWAP") {
            throw new Error("INVALID_PENDING_ACTION");
        }

        if (this.pendingAction.step !== "CHOOSE_FIRST_CARD") {
            throw new Error("INVALID_ACTION_STEP");
        }

        const firstPlayerId =
            this.pendingAction.payload.firstPlayerId;

        const firstPlayer = this.validateActionTarget(firstPlayerId);

        if (!firstPlayer) {
            throw new Error("FIRST_PLAYER_NOT_FOUND");
        }

        if (
            !Number.isInteger(cardIndex) ||
            cardIndex < 0 ||
            cardIndex >= firstPlayer.roundCards.length
        ) {
            throw new Error("INVALID_CARD_INDEX");
        }

        this.pendingAction.payload.firstCardIndex = cardIndex;
        this.pendingAction.step = "CHOOSE_SECOND_TARGET";

        return {
            type: "SWAP_FIRST_CARD_SELECTED"
        };
    }

    applySwap(secondCardIndex) {
        if (!this.pendingAction) {
            throw new Error("NO_PENDING_ACTION");
        }

        if (this.pendingAction.card.effect !== "SWAP") {
            throw new Error("INVALID_PENDING_ACTION");
        }

        if (this.pendingAction.step !== "CHOOSE_SECOND_CARD") {
            throw new Error("INVALID_ACTION_STEP");
        }

        const {
            firstPlayerId,
            firstCardIndex,
            secondPlayerId
        } = this.pendingAction.payload;

        const firstPlayer = this.validateActionTarget(firstPlayerId);
        const secondPlayer = this.validateActionTarget(secondPlayerId);

        if (!firstPlayer) {
            throw new Error("FIRST_PLAYER_NOT_FOUND");
        }

        if (!secondPlayer) {
            throw new Error("SECOND_PLAYER_NOT_FOUND");
        }

        if (
            !Number.isInteger(firstCardIndex) ||
            firstCardIndex < 0 ||
            firstCardIndex >= firstPlayer.roundCards.length
        ) {
            throw new Error("INVALID_FIRST_CARD_INDEX");
        }

        if (
            !Number.isInteger(secondCardIndex) ||
            secondCardIndex < 0 ||
            secondCardIndex >= secondPlayer.roundCards.length
        ) {
            throw new Error("INVALID_SECOND_CARD_INDEX");
        }

        const firstCard = firstPlayer.roundCards[firstCardIndex];
        const secondCard = secondPlayer.roundCards[secondCardIndex];

        firstPlayer.roundCards[firstCardIndex] = secondCard;
        secondPlayer.roundCards[secondCardIndex] = firstCard;

        this.refreshPlayerRoundState(firstPlayer);

        if (secondPlayer.id !== firstPlayer.id) {
            this.refreshPlayerRoundState(secondPlayer);
        }

        this.pendingAction = null;

        if (this.isRoundFinished()) {
            this.finishRound();
        } else {
            this.nextPlayer();
        }

        return {
            type: "SWAP_APPLIED",
            firstPlayerId,
            secondPlayerId,
            firstCard,
            secondCard
        };
    }

    applySecondChance(targetPlayerId) {
        const targetPlayer =
            this.validateActionTarget(targetPlayerId);

        const secondChanceCard =
            this.pendingAction.card;

        if (!targetPlayer.roundEffects) {
            targetPlayer.roundEffects = {};
        }

        targetPlayer.roundEffects.secondChance = true;

        // La carte reste visible jusqu'à son utilisation
        targetPlayer.modifierCards.push(
            secondChanceCard
        );

        this.pendingAction = null;

        if (this.isRoundFinished()) {
            this.finishRound();
        } else {
            this.nextPlayer();
        }

        return {
            type: "SECOND_CHANCE_APPLIED",
            targetPlayerId,
        };
    }

    applyFreeze(targetPlayerId) {
        const targetPlayer =
            this.validateActionTarget(targetPlayerId);

        const freezeCard = this.pendingAction.card;

        // On recalcule ses points au moment du Freeze
        this.calculatePlayerRoundScore(targetPlayer);

        // Le joueur est arrêté, mais pas busted
        targetPlayer.stayed = true;
        targetPlayer.busted = false;

        // La carte Freeze reste visible jusqu'à la fin du round
        targetPlayer.modifierCards.push(freezeCard);

        this.pendingAction = null;

        if (this.isRoundFinished()) {
            this.finishRound();
        } else {
            this.nextPlayer();
        }

        return {
            type: "FREEZE_APPLIED",
            targetPlayerId,
            roundScore: targetPlayer.roundScore,
        };
    }

    getPlayersStillInRound() {
        return this.players.filter((player) => !player.busted);
    }

    getCardsInPlay() {
        return this.getPlayersStillInRound().flatMap((player) =>
            player.roundCards.map((card) => ({
                card,
                playerId: player.id
            }))
        );
    }

    canUseDiscard() {
        return this.getCardsInPlay().length >= 1;
    }

    canUseSteal(sourcePlayerId) {
        const playersStillInRound = this.getPlayersStillInRound();

        // Le joueur est le dernier encore en jeu
        if (playersStillInRound.length <= 1) {
            return false;
        }

        // Il faut au moins une carte appartenant à un autre joueur
        return playersStillInRound.some(
            (player) =>
                player.id !== sourcePlayerId &&
                player.roundCards.length > 0
        );
    }

    canUseSwap(sourcePlayerId) {
        const playersStillInRound = this.getPlayersStillInRound();

        // Le joueur est le dernier encore en jeu
        if (playersStillInRound.length <= 1) {
            return false;
        }

        const cardsInPlay = this.getCardsInPlay();

        if (cardsInPlay.length < 2) {
            return false;
        }

        /*
        * Il faut au moins deux cartes différentes.
        * On utilise l'id si chaque carte possède un id unique.
        */
        const distinctCards = new Set(
            cardsInPlay.map(({ card }) =>
                `${card.type}-${card.value}-${card.effect ?? ""}`
            )
        );

        return distinctCards.size >= 2;
    }

    canUseActionCard(card, sourcePlayerId) {
        switch (card.effect) {
            case "DISCARD":
                return this.canUseDiscard();

            case "STEAL":
                return this.canUseSteal(sourcePlayerId);

            case "SWAP":
                return this.canUseSwap(sourcePlayerId);

            default:
                return true;
        }
    }
}

module.exports = Game;