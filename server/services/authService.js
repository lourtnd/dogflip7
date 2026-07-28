const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

async function login({ username, password }) {
  const result = await pool.query(
    `
      SELECT
        id,
        username,
        password_hash,
        display_name,
        avatar,
        elo
      FROM users
      WHERE username = $1
    `,
    [username]
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const validPassword = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!validPassword) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatar: user.avatar,
      elo: user.elo,
    },
  };
}

async function getMe(userId) {
  const result = await pool.query(
    `
      SELECT
        id,
        username,
        display_name,
        avatar,
        elo
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  const user = result.rows[0];

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar,
    elo: user.elo,
  };
}

async function updateDisplayName(userId, displayName) {
  const result = await pool.query(
    `
      UPDATE users
      SET display_name = $1
      WHERE id = $2
      RETURNING
        id,
        username,
        display_name,
        avatar,
        elo
    `,
    [displayName, userId]
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar,
    elo: user.elo,
  };
}

module.exports = {
  login,
  getMe,
  updateDisplayName,
};