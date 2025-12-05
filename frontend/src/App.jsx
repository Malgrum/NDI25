import React, { useEffect, useState, useRef } from 'react';
import './App.css';

// Use production-relative `/api` when built and served (nginx proxy),
// otherwise use the backend dev server on localhost for local development.
const API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD)
    ? '/api'
    : 'http://localhost:3001/api';

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
    const [images, setImages] = useState([]);
    const [leftImg, setLeftImg] = useState(null);
    const [rightImg, setRightImg] = useState(null);
    const [gameOverReason, setGameOverReason] = useState(null);
    const [showHistory, setShowHistory] = useState(false);

    const mainAudioRef = useRef(null);
    const loseAudioRef = useRef(null);
    const ORIGINAL_MAIN_VOLUME = 0.7;

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
                // For gameplay, start with default initial values (non-persistent)
                const initialEtab = my ? {
                    ...my,
                    autonomie: 50,
                    dependance: 50,
                    budget_euros: 100000,
                    empreinte_co2: 0,
                    progres_nird: my.progres_nird || 0
                } : null;
                setEtablissement(initialEtab);
                const c = await cardsRes.json();
                setCards(c || []);
                const first = pickRandom(c || []);
                setCurrentCard(first);
                setMessage('Bienvenue au Village NIRD — prenez des décisions pour votre établissement');
                // charger les images 
                try {
                    const imgs = await fetch('/images/images.json').then(r => r.json());
                    setImages(imgs || []);
                    if (imgs && imgs.length > 0) {
                        const i1 = imgs[Math.floor(Math.random() * imgs.length)];
                        let i2 = imgs[Math.floor(Math.random() * imgs.length)];
                        if (imgs.length > 1) {
                            let attempts = 0;
                            while (i2 === i1 && attempts < 6) { i2 = imgs[Math.floor(Math.random() * imgs.length)]; attempts++; }
                        }
                        setLeftImg(`/images/${i1}`);
                        setRightImg(`/images/${i2}`);
                    }
                } catch (e) {
                    setImages([]);
                }
            } catch (err) {
                setMessage("Erreur de connexion à l'API. Démarrez le backend (port 3001).");
            }
            setLoading(false);
        };
        load();
    }, []);

    // Audio initialization: main theme plays on first load (no loop), lose plays once on game over.
    useEffect(() => {
        const main = new Audio('/audio/Main_theme.mp3');
        main.loop = false;
        main.volume = 0.7;
        main.preload = 'auto';
        mainAudioRef.current = main;

        const lose = new Audio('/audio/lose.mp3');
        lose.loop = false;
        lose.volume = 1.0;
        lose.preload = 'auto';
        loseAudioRef.current = lose;

        const onLoseEnded = () => {
            try {
                const m = mainAudioRef.current;
                if (m) {
                    m.volume = ORIGINAL_MAIN_VOLUME;
                    if (m.paused) {
                        m.play().catch(() => {});
                    }
                }
            } catch (e) {}
        };
        lose.addEventListener('ended', onLoseEnded);

        // try to play (may be blocked by browser autoplay policies)
        (async () => {
            try { await main.play(); } catch (e) { /* autoplay blocked */ }
        })();

        return () => {
            try { lose.removeEventListener('ended', onLoseEnded); } catch (e) {}
            try { main.pause(); main.src = ''; } catch (e) {}
            try { lose.pause(); lose.src = ''; } catch (e) {}
        };
    }, []);

    // When game over occurs, lower main volume and play lose once
    useEffect(() => {
        if (!gameOverReason) return;
        const main = mainAudioRef.current;
        const lose = loseAudioRef.current;
        if (main) {
            try { main.volume = 0.15; } catch (e) {}
        }
        if (lose) {
            (async () => {
                try { await lose.play(); } catch (e) { /* blocked */ }
            })();
        }
    }, [gameOverReason]);

    const pickRandom = (arr) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);

    const applyStartDefaults = (etab) => {
        const base = etab || { id: ETAB_ID, nom: 'Mon Établissement' };
        return {
            ...base,
            autonomie: 50,
            dependance: 50,
            budget_euros: 100000,
            empreinte_co2: 0,
            progres_nird: base.progres_nird || 0
        };
    };

    const startNewGame = () => {
        const initial = applyStartDefaults(etablissement);
        setEtablissement(initial);
        setHistory([]);
        setGameOverReason(null);
        setShowMenu(false);
        setShowDocs(false);
        setShowCredits(false);
        setMessage('Nouvelle partie — bonne chance !');
        setCurrentCard(pickRandom(cards));
        // pick initial images
        if (images && images.length > 0) {
            const i1 = images[Math.floor(Math.random() * images.length)];
            let i2 = images[Math.floor(Math.random() * images.length)];
            if (images.length > 1) {
                let attempts = 0;
                while (i2 === i1 && attempts < 6) { i2 = images[Math.floor(Math.random() * images.length)]; attempts++; }
            }
            setLeftImg(`/images/${i1}`);
            setRightImg(`/images/${i2}`);
        }
        // restore main audio volume and (re)play main theme when starting a new game
        try {
            const main = mainAudioRef.current;
            const lose = loseAudioRef.current;
            if (lose) { try { lose.pause(); lose.currentTime = 0; } catch (e) {} }
            if (main) { try { main.volume = 0.7; main.currentTime = 0; main.play().catch(()=>{}); } catch (e) {} }
        } catch (e) {}
    };

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
                body: JSON.stringify({
                    cardId: currentCard.id,
                    choice: choice === 'left' ? 'left' : 'right',
                    etablissementId: ETAB_ID,
                    // send current in-memory state so backend computes from this
                    currentEtab: etablissement
                })
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
                setGameOverReason(over.reason);
                setCurrentCard(null);
                return;
            }

            // nouvelle carte aléatoire
            const next = pickRandom(cards);
            setCurrentCard(next);
            // choisir deux images différentes si possible
            if (images && images.length > 0) {
                const i1 = images[Math.floor(Math.random() * images.length)];
                let i2 = images[Math.floor(Math.random() * images.length)];
                if (images.length > 1) {
                    let attempts = 0;
                    while (i2 === i1 && attempts < 6) { i2 = images[Math.floor(Math.random() * images.length)]; attempts++; }
                }
                setLeftImg(`/images/${i1}`);
                setRightImg(`/images/${i2}`);
            } else {
                setLeftImg(null); setRightImg(null);
            }
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
                <div className="menu-frame">
                  <h1>🛡️ Village NIRD</h1>
                  <p>Jeu de simulation communautaire — prenez des décisions pour votre établissement.</p>
                  <div className="menu-actions">
                      <button className="btn-play" onClick={startNewGame}>Jouer</button>
                      <button className="btn-credits" onClick={() => setShowCredits(true)}>Crédits</button>
                      <button className="btn-link" onClick={() => setShowDocs(true)}>Documentation / Lien</button>
                  </div>
                  {showCredits && (
                      <div className="credits" style={{ marginTop: '1rem' }}>
                          <h3>Crédits</h3>
                          <p>Conception: Hideo Kojira</p>
                          <p>Musique: Jean-Michel Bruitage</p>
                          <p>Image: Gilbert Montgravé</p>
                          <p>Développement: David Goodenought</p>
                          <button onClick={() => setShowCredits(false)}>Fermer</button>
                      </div>
                  )}
                  {showDocs && (
                      <div className="docs" style={{ marginTop: '1rem' }}>
                          <h3>Documentation & Liens</h3>
                          <p>Voici quelques lien vers le contexte du projet :</p>
                              <h3>Documentation sur le projet NIRD</h3>
                              <a href = "https://www.cafepedagogique.net/2025/04/27/bruay-labuissiere-voyage-au-centre-du-libre-educatif/">Introduction à NIRD</a><br/>
                              <a href ="https://tube-numerique-educatif.apps.education.fr/w/pZCnzPKTYX2iF38Qh4ZGmq">Présentation Vidéo</a><br/><br/>

                              <h3>Contexte du projet</h3>
                              <a href ="https://www.youtube.com/watch?v=76T8oubek-c">L'état obligé de jeter des ordinateurs</a><br/>
                              <br/> 
                          <button onClick={() => setShowDocs(false)}>Retour</button>
                      </div>
                  )}
                </div>
            </div>
        );
    }

    return (
        <div className="app-container reigns">
            <h1>🛡️ Village NIRD </h1>
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
                                {leftImg && <img src={leftImg} alt="choix gauche" />}
                                {currentCard.choix_gauche.texte}
                            </button>
                            <button className="choice right" onClick={() => handleChoice('right')}>
                                {rightImg && <img src={rightImg} alt="choix droite" />}
                                {currentCard.choix_droite.texte}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="no-card">Plus de cartes ou fin de partie.</div>
                )}

                {/* history will be shown from Game Over overlay via button */}
            </main>
            {gameOverReason && (
                <div className="game-over-overlay">
                    <div className="game-over-box">
                        <h2>Game Over</h2>
                        <p>{gameOverReason}</p>
                        <div style={{ marginTop: '1rem' }}>
                            <button className="btn-return" onClick={async () => {
                                // reset to menu and reload initial
                                setShowMenu(true);
                                setShowDocs(false);
                                setShowCredits(false);
                                setHistory([]);
                                setGameOverReason(null);
                                setMessage('Retour au menu');
                                try {
                                    const etabRes = await fetch(`${API_URL}/etablissements`);
                                    const etabs = await etabRes.json();
                                    const my = etabs.find(e => e.id === ETAB_ID) || etabs[0] || null;
                                    setEtablissement(applyStartDefaults(my));
                                    const cardsRes = await fetch(`${API_URL}/cards`);
                                    const c = await cardsRes.json();
                                    setCards(c || []);
                                    setCurrentCard(pickRandom(c || []));
                                } catch (e) {
                                    setMessage('Erreur lors du reset.');
                                }
                            }}>Retour au menu</button>
                            <button className="btn-return" style={{ marginLeft: '0.6rem' }} onClick={() => setShowHistory(h => !h)}>
                                {showHistory ? 'Masquer l\'historique' : 'Voir l\'historique'}
                            </button>
                        </div>
                        {showHistory && (
                            <div style={{ marginTop: '1rem', textAlign: 'left', maxHeight: '260px', overflow: 'auto' }}>
                                <h3>Historique</h3>
                                {history.length === 0 ? (
                                    <div>Aucun choix pour l'instant.</div>
                                ) : (
                                    <ul>
                                        {history.map((h, i) => (
                                            <li key={i} style={{ marginBottom: '0.4rem' }}>
                                                <strong>{h.card.titre}</strong> — {h.choice} — impact: autonomie {h.impact.autonomie}, budget {formatCurrency(h.impact.budget)}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}