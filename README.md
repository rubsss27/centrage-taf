# TAF · préparation de vol TB200

Version GitHub Pages : https://rubsss27.github.io/centrage-taf/

Application React entièrement statique : trois avions, préparation de 1 à 3 étapes, carburant, masse/centrage, performances, pièces jointes, export du formulaire TAF original rempli et annexes. Les fiches de référence sont publiques. Les dossiers personnels et pièces ajoutées restent dans IndexedDB sur votre appareil ; ils ne sont jamais envoyés à GitHub.

## Migration depuis le site privé
Sur le site Sites, ouvrir chaque dossier → Dossier & PDF → Sauvegarde complète. Sur GitHub Pages, utiliser Importer un dossier. Une nouvelle adresse possède un stockage distinct. Aucun transfert automatique entre les deux sites.

## Météo
Le workflow `.github/workflows/pages.yml` télécharge les caches XML officiels NOAA/NWS AWC toutes les 15 minutes et lors d’un push ou lancement manuel. Il publie les METAR/TAF mondiaux dans un snapshot JSON. Le navigateur sélectionne les terrains du vol sans appel direct à NOAA (CORS non autorisé). Les textes originaux, dates d’observation, dates de validité et heure réelle de récupération restent visibles et dans le dossier PDF. Une actualisation peut être retardée ; alerte au-delà de 30 min pour le snapshot et 2 h pour une observation. Aucun bulletin absent n’est remplacé par un terrain voisin. En cas d’échec du téléchargement, le workflow ne publie pas de nouveau site ; le précédent reste disponible avec son ancien horodatage.

Les tâches GitHub planifiées peuvent être retardées et désactivées après 60 jours sans activité sur un dépôt public. Vérifier Actions et relancer le workflow si nécessaire. Aucun service payant ni secret météo requis. TEMSI, WINTEM, fronts, NOTAM restent des imports manuels.

## Publication
Settings → Pages → Source : GitHub Actions. Le workflow construit et déploie le site à chaque push sur main. Actions doit être activé. Le chemin de base provient de configure-pages ; les PDF et assets restent accessibles sous /centrage-taf/ ou un domaine personnalisé.

## Développement
Node 24 ; pnpm 11.25.0. `pnpm install --frozen-lockfile`, `python scripts/update-weather.py`, `pnpm dev`. `PAGES_BASE=/centrage-taf/ pnpm build` pour reproduire le chemin de production. `pnpm test`, `node tests/pages-weather.test.mjs`, `python -m unittest discover -s tests -p test_weather_cache.py`.

## Limites de calcul
Roulage 5 L, procédure 3 L par décollage/atterrissage/remise de gaz, réserve route minimum 3 L, réserve finale 45 min soit 30 L à 40 L/h. Distances de performances brutes sans coefficients vent/pente/piste ni marges réglementaires. Enveloppe, capacité 204 L et bagages 65 kg conservés du site d’origine : confirmation dans le manuel exigée. CAT et panne de volets non calculées. L’outil ne décide pas GO/NO GO et ne garantit pas l’exhaustivité des briefings.
