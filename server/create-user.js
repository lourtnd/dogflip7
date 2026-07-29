require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("./db/pool");

async function createUser() {
  const username = "frano";
  const password = "ratatouille";
  const displayName = "Francois";

  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `
    insert into users (username, password_hash, display_name)
    values ($1, $2, $3)
    `,
    [username, passwordHash, displayName]
  );

  console.log("Utilisateur créé :", username);
  process.exit(0);
}

createUser().catch((error) => {
  console.error(error);
  process.exit(1);
});