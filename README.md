# Institut — prise de rendez-vous

Site statique (HTML/CSS/JS, sans dépendance) prévu pour GitHub Pages.

| Page | Pour qui | Contenu |
|---|---|---|
| `index.html` | Les clientes | Choix du soin → esthéticienne + jour + créneau libre → coordonnées → confirmation (+ ajout à l'agenda `.ics`) |
| `institut.html` | L'équipe | Planning du jour par esthéticienne, création de RDV sur place / par téléphone, pointage (honoré, absente, annulé), encaissement, et **récap de fin de journée** |

## Récap de fin de journée
Onglet « Récap du jour » : CA, panier moyen, RDV en ligne vs sur place, détail par esthéticienne,
par mode de paiement et par prestation, absences/annulations, RDV non pointés, remarques et fond de caisse.
Envoi en un clic par e-mail, WhatsApp, copier-coller, impression/PDF ou export CSV.

## Personnaliser
Tout se règle dans `js/config.js` : nom, adresse, horaires, équipe (et jours travaillés),
prestations, tarifs, modes de paiement, e-mail de réception du récap.

## ⚠️ Avant une mise en service réelle
Les données sont enregistrées **dans le navigateur** (localStorage). C'est parfait pour tester,
mais une réservation faite par une cliente sur son téléphone n'arrive pas sur l'ordinateur de l'institut.
Pour un usage réel il faut brancher l'objet `Store` de `js/core.js` sur une base en ligne
(Firebase, Supabase…) et protéger `institut.html` par une vraie authentification.
