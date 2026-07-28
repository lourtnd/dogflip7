const express = require("express");
const authService = require("../services/authService");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const data = await authService.login(req.body);
    res.json(data);
  } catch (error) {
    if (error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        message: "Identifiants invalides",
      });
    }

    console.error("Erreur login :", error);

    res.status(500).json({
      message: "Erreur serveur",
    });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await authService.getMe(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "Utilisateur introuvable",
      });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName:
          user.displayName ?? user.display_name,
        avatar: user.avatar,
        elo: user.elo ?? 1000,
      },
    });
  } catch (error) {
    console.error("Erreur /me :", error);

    res.status(500).json({
      message: "Erreur serveur",
    });
  }
});

router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const displayName = req.body.displayName?.trim();

    if (!displayName || displayName.length < 3) {
      return res.status(400).json({
        message: "Le pseudo doit contenir au moins 3 caractères.",
      });
    }

    if (displayName.length > 30) {
      return res.status(400).json({
        message: "Le pseudo ne peut pas dépasser 30 caractères.",
      });
    }

    const user = await authService.updateDisplayName(
      req.user.id,
      displayName
    );

    res.json({
      user,
    });
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        message: "Utilisateur introuvable.",
      });
    }

    console.error(
      "Erreur modification du pseudo :",
      error
    );

    res.status(500).json({
      message: "Erreur serveur",
    });
  }
});

module.exports = router;