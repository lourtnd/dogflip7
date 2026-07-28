import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Profile.css";

function Profile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(
    user?.displayName ?? ""
  );

  const cardDesigns = [
  { name: "Carte 0", image: "/cards/0.jpeg" },
  { name: "Carte 1", image: "/cards/1.jpeg" },
  { name: "Carte 2", image: "/cards/2.jpeg" },
  { name: "Carte 3", image: "/cards/3.jpeg" },
  { name: "Carte 4", image: "/cards/4.jpeg" },
  { name: "Carte 5", image: "/cards/5.jpeg" },
  { name: "Carte 6", image: "/cards/6.jpeg" },
  { name: "Carte 7", image: "/cards/7.jpeg" },
  { name: "Carte 8", image: "/cards/8.jpeg" },
  { name: "Carte 9", image: "/cards/9.jpeg" },
  { name: "Carte 10", image: "/cards/10.jpeg" },
  { name: "Carte 11", image: "/cards/11.jpeg" },
  { name: "Carte 12", image: "/cards/12.jpeg" },
  { name: "Carte +2", image: "/cards/plus-2.jpeg" },
  { name: "Carte +6", image: "/cards/plus-6.jpeg" },
  { name: "Carte +10", image: "/cards/plus-10.jpeg" },
  { name: "Carte -2", image: "/cards/minus-2.jpeg" },
  { name: "Carte -6", image: "/cards/minus-6.jpeg" },
  { name: "Carte -10", image: "/cards/minus-10.jpeg" },
  { name: "Carte /2", image: "/cards/divide-2.jpeg" },
  { name: "Carte x3,30033", image: "/cards/multiply-3.jpeg" },
  { name: "Carte Flip 3", image: "/cards/flip-3.jpeg" },
  { name: "Carte Unflip 3", image: "/cards/unflip-3.jpeg" },
  { name: "Carte Freeze", image: "/cards/freeze.jpeg" },
  { name: "Carte Swap", image: "/cards/swap.jpeg" },
  { name: "Carte Steal", image: "/cards/steal.jpeg" },
  { name: "Carte Seconde Chance", image: "/cards/second-chance.jpeg" },
  { name: "Carte Discard", image: "/cards/discard.jpeg" },
  { name: "Carte One More", image: "/cards/one-more.jpeg" },
];

  if (!user) {
    return <p>Chargement du profil...</p>;
  }

  async function handleSaveDisplayName() {
    const token = localStorage.getItem("token");

    const API_URL =
      import.meta.env.VITE_API_URL ||
      "http://localhost:3000";

    const response = await fetch(
      `${API_URL}/api/auth/profile`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Erreur lors de la modification"
      );
    }

    setUser(data.user);
    setIsEditing(false);
  }

  return (
    <main className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar">👤</div>

        <h1>{user.displayName || user.username}</h1>
        <p className="profile-username">@{user.username}</p>

        <div className="profile-stat">
          <span>Elo</span>
          <strong>🏆 {user.elo ?? 1000}</strong>
        </div>

        {!isEditing ? (
          <button
            type="button"
            className="profile-button"
            onClick={() => setIsEditing(true)}
          >
            Modifier
          </button>
        ) : (
          <div className="profile-edit-form">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={!isEditing}
            />

            <button
              type="button"
              className="profile-button"
              onClick={handleSaveDisplayName}
              disabled={!isEditing}
            >
              Enregistrer
            </button>

            <button
              type="button"
              onClick={() => {
                setUsername(user.username);
                setIsEditing(false);
              }}
            >
              Annuler
            </button>
          </div>
        )}

        <button
          className="profile-back"
          onClick={() => navigate("/")}
        >
          ← Retour
        </button>
      </div>

      <section className="card-gallery">
        <div className="card-gallery-header">
          <h2>Galerie des cartes</h2>
          <p>Merci Antonin le goat</p>
        </div>

        <div className="card-gallery-grid">
          {cardDesigns.map((card) => (
            <article
              key={card.image}
              className="card-gallery-item"
            >
              <img
                src={card.image}
                alt={card.name}
                loading="lazy"
              />

              <span>{card.name}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default Profile;