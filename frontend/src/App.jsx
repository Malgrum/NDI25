import React, { useEffect, useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:3001/api';

const formatCurrency = (amount) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

function StatBar({ label, value, color }) {
    return (
        <div className="stat-bar">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
        </div>
    );
}

export default function App() {
    const [etablissement, setEtablissement] = useState(null);
    const [cards, setCards] = useState([]);
    const [currentCard, setCurrentCard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [history, setHistory] = useState([]);
    const [showMenu, setShowMenu] = useState(true);
    const [showCredits, setShowCredits] = useState(false);
    const [showDocs, setShowDocs] = useState(false);

    const ETAB_ID = 2; // id du joueur

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [etabRes, cardsRes] = await Promise.all([
                    fetch(`${API_URL}/etablissements`),
                    fetch(`${API_URL}/cards`)
                ]);
                const etabs = await etabRes.json();
                const my = etabs.find(e => e.id === ETAB_ID) || etabs[0] || null;
                setEtablissement(my);
                const c = await cardsRes.json();
                setCards(c || []);
                setCurrentCard(pickRandom(c || []));
                setMessage('Bienvenue au Village NIRD — prenez des décisions pour votre établissement');
            } catch (err) {
                setMessage("Erreur de connexion à l'API. Démarrez le backend (port 3001).");
            }
            setLoading(false);
        };
        load();
    }, []);

    const pickRandom = (arr) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);

    const checkGameOver = (etab) => {
        if (!etab) return false;
        // Conditions simples de fin
        if (etab.autonomie <= 0) return { reason: 'L autonomie est tombée à 0' };
        if (etab.dependance >= 100) return { reason: 'La dépendance est totale' };
        if (etab.budget_euros <= 0) return { reason: 'Le budget est épuisé' };
        if (etab.empreinte_co2 >= 100) return { reason: 'L empreinte CO2 est critique' };
        return false;
    };

    const handleChoice = async (choice) => {
        if (!currentCard || !etablissement) return;
        setMessage('Application du choix...');
        try {
            const res = await fetch(`${API_URL}/choose`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardId: currentCard.id, choice: choice === 'left' ? 'left' : 'right', etablissementId: ETAB_ID })
            });
            if (!res.ok) {
                setMessage('Erreur lors de l envoi du choix.');
                return;
            }
            const data = await res.json();
            setEtablissement(data.etablissement);
            setHistory(h => [{ card: currentCard, choice, impact: data.selected.impact }, ...h].slice(0, 10));

            const over = checkGameOver(data.etablissement);
            if (over) {
                setMessage(`Game Over — ${over.reason}`);
                setCurrentCard(null);
                return;
            }

            // nouvelle carte aléatoire
            setCurrentCard(pickRandom(cards));
            setMessage('Choix appliqué — continuez à façonner votre village');
        } catch (err) {
            setMessage('Erreur réseau lors de l envoi du choix.');
        }
    };

    if (loading) return <div className="loading">Chargement du Village NIRD...</div>;
    // Menu screen before entering the game
    if (showMenu) {
        return (
            <div className="menu-screen">
                <h1>🛡️ Village NIRD</h1>
                <p>Jeu de simulation communautaire — prenez des décisions pour votre établissement.</p>
                <div className="menu-actions">
                    <button className="btn-play" onClick={() => setShowMenu(false)}>Jouer</button>
                    <button className="btn-credits" onClick={() => setShowCredits(true)}>Crédits</button>
                    <button className="btn-link" onClick={() => setShowDocs(true)}>Documentation / Lien</button>
                </div>
                {showCredits && (
                    <div className="credits">
                        <h3>Crédits</h3>
                        <p>Conception: Équipe NIRD — Prototype Reigns-like</p>
                        <p>Backend minimal & Frontend React. Données non sauvegardées entre sessions.</p>
                        <button onClick={() => setShowCredits(false)}>Fermer</button>
                    </div>
                )}
                {showDocs && (
                    <div className="docs">
                        <h3>Documentation & Liens</h3>
                        <p>Voici quelques lignes d'information et ressources utiles :</p>
                        <ul>
                            <li><strong>Introduction:</strong> Présentation du Village NIRD et des règles du jeu.</li>
                            <li><strong>But du jeu:</strong> Augmenter l'autonomie de votre établissement en prenant des décisions.</li>
                            <li><strong>Conseils:</strong> Alternez entre actions techniques et pédagogiques pour un impact durable.</li>
                            <li><strong>Sources:</strong> Guides, tutoriels et liens de communautés (à compléter).</li>
                        </ul>
                        <button onClick={() => setShowDocs(false)}>Retour</button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="app-container reigns">
            <h1>🛡️ Village NIRD — Jeu (Reigns-like)</h1>
            <div className="top-row">
                {etablissement ? (
                    <>
                        <StatBar label="Autonomie" value={`${etablissement.autonomie}%`} color="#16a34a" />
                        <StatBar label="Dépendance" value={`${etablissement.dependance}%`} color="#dc2626" />
                        <StatBar label="Budget" value={`${formatCurrency(etablissement.budget_euros)}`} color="#f59e0b" />
                        <StatBar label="CO2" value={`${etablissement.empreinte_co2}%`} color="#374151" />
                    </>
                ) : (
                    <div>Aucun établissement trouvé.</div>
                )}
            </div>

            <div className="message-box">{message}</div>

            <main className="game-area">
                {currentCard ? (
                    <div className="card reigns-card">
                        <h2>{currentCard.titre}</h2>
                        <p className="card-text">{currentCard.texte}</p>

                        <div className="choices">
                            <button className="choice left" onClick={() => handleChoice('left')}>
                                {currentCard.choix_gauche.texte}
                            </button>
                            <button className="choice right" onClick={() => handleChoice('right')}>
                                {currentCard.choix_droite.texte}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="no-card">Plus de cartes ou fin de partie.</div>
                )}

                <aside className="history">
                    <h3>Historique (dernier choix)</h3>
                    {history.length === 0 ? (
                        <div>Aucun choix pour l'instant.</div>
                    ) : (
                        <ul>
                            {history.map((h, i) => (
                                <li key={i}>
                                    <strong>{h.card.titre}</strong> — {h.choice} — impact: autonomie {h.impact.autonomie}, budget {formatCurrency(h.impact.budget)}
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>
            </main>
        </div>
    );
}