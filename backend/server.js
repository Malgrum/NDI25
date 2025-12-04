const express = require('express');
const cors = require('cors'); // Pour autoriser les requêtes du frontend (même domaine)
const fs = require('fs');
const app = express();
const PORT = 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Charger les données
const dbPath = './db.json';
const dbData = JSON.parse(fs.readFileSync(dbPath));

// --- Routes API ---

// 1. Récupérer tous les établissements
app.get('/api/etablissements', (req, res) => {
    res.json(dbData.etablissements.map(e => ({
        id: e.id,
        nom: e.nom,
        autonomie: e.autonomie,
        dependance: e.dependance,
        progres_nird: e.progres_nird
    })));
});

// 2. Récupérer tous les défis
app.get('/api/defis', (req, res) => {
    res.json(dbData.defis);
});

// 3. Simuler la réalisation d'un défi (MODIFIÉ)
app.post('/api/defis/:defiId/reussite', (req, res) => {
    const defiId = parseInt(req.params.defiId);
    // Nous utiliserons l'ID 2 pour simuler les actions sur 'Mon Établissement'
    const etablissementId = 2; 

    const defi = dbData.defis.find(d => d.id === defiId);
    const etablissement = dbData.etablissements.find(e => e.id === etablissementId);

    if (defi && etablissement) {
        // Appliquer l'impact du défi
        etablissement.autonomie = Math.min(100, etablissement.autonomie + defi.impact.autonomie);
        etablissement.dependance = Math.max(0, etablissement.dependance - defi.impact.autonomie);
        etablissement.budget_euros = etablissement.budget_euros + defi.impact.budget; // Le gain est positif, c'est une économie
        etablissement.empreinte_co2 = Math.max(5, etablissement.empreinte_co2 + defi.impact.co2);
        etablissement.progres_nird = Math.min(10, etablissement.progres_nird + 1);
        
        // Simuler la consommation du défi
        defi.statut = "Réalisé"; 

        fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));

        return res.json({ message: `Le défi "${defi.titre}" a été validé !`, etablissement: etablissement });
    }
    res.status(404).json({ message: 'Ressource non trouvée.' });
});

// 6. Récupérer les cartes de jeu (Reigns-like)
app.get('/api/cards', (req, res) => {
    res.json(dbData.cards);
});

// 7. Jouer un choix sur une carte (appliquer impact à l'établissement)
app.post('/api/choose', (req, res) => {
    const { cardId, choice, etablissementId } = req.body;
    const card = dbData.cards.find(c => c.id === cardId);
    const etab = dbData.etablissements.find(e => e.id === etablissementId);

    if (!card || !etab) return res.status(404).json({ message: 'Carte ou établissement introuvable.' });

    const selected = choice === 'left' ? card.choix_gauche : card.choix_droite;

    // Calculer un nouvel état d'établissement en mémoire (NE PAS PERSISTER)
    const updatedEtab = {
        ...etab,
        autonomie: Math.max(0, Math.min(100, etab.autonomie + selected.impact.autonomie)),
        dependance: Math.max(0, Math.min(100, etab.dependance + selected.impact.dependance)),
        budget_euros: Math.max(0, etab.budget_euros + selected.impact.budget),
        empreinte_co2: Math.max(0, Math.min(100, etab.empreinte_co2 + selected.impact.co2))
    };

    // Ne pas écrire dans db.json — le jeu est éphémère par session
    // Retourner l'état calculé (côté client doit conserver en mémoire)
    return res.json({ etablissement: updatedEtab, selected });
});

// 4. Récupérer les Témoignages (NOUVEAU)
app.get('/api/temoignages', (req, res) => {
    res.json(dbData.temoignages);
});

// 5. Ajouter un Témoignage (NOUVEAU)
app.post('/api/temoignages', (req, res) => {
    const { auteur, contenu } = req.body;
    if (!auteur || !contenu) {
        return res.status(400).json({ message: "Auteur et contenu sont requis." });
    }
    const newId = Date.now(); // ID basé sur le timestamp
    const nouveauTemoignage = { id: newId, auteur, contenu };
    
    dbData.temoignages.unshift(nouveauTemoignage); // Ajout en début de liste
    fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));

    res.status(201).json(nouveauTemoignage);
});


app.listen(PORT, () => {
    console.log(`API NIRD lancée sur http://localhost:${PORT}`);
});