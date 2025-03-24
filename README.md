# Serveur MCP Airbnb
[![smithery badge](https://smithery.ai/badge/@openbnb-org/mcp-server-airbnb)](https://smithery.ai/server/@openbnb-org/mcp-server-airbnb)

Serveur MCP pour rechercher des annonces Airbnb et obtenir les détails des logements. Fournit des liens directs vers les annonces Airbnb dans les résultats de recherche.

## Outils

1. `airbnb_search`
   - Recherche d'annonces Airbnb
   - Entrée requise : `location` (chaîne de caractères)
   - Entrées optionnelles :
     - `placeId` (chaîne de caractères)
     - `checkin` (chaîne de caractères, AAAA-MM-JJ)
     - `checkout` (chaîne de caractères, AAAA-MM-JJ)
     - `adults` (nombre)
     - `children` (nombre)
     - `infants` (nombre)
     - `pets` (nombre)
     - `minPrice` (nombre)
     - `maxPrice` (nombre)
     - `cursor` (chaîne de caractères)
     - `ignoreRobotsText` (booléen)
   - Retourne : Tableau d'annonces avec des détails comme le nom, le prix, l'emplacement, etc. Chaque annonce inclut une `url` directe vers la page Airbnb.

2. `airbnb_listing_details`
   - Obtenir des informations détaillées sur une annonce Airbnb spécifique
   - Entrée requise : `id` (chaîne de caractères)
   - Entrées optionnelles :
     - `checkin` (chaîne de caractères, AAAA-MM-JJ)
     - `checkout` (chaîne de caractères, AAAA-MM-JJ)
     - `adults` (nombre)
     - `children` (nombre)
     - `infants` (nombre)
     - `pets` (nombre)
     - `ignoreRobotsText` (booléen)
   - Retourne : Informations détaillées sur l'annonce, y compris la description, les détails de l'hôte, les équipements, les tarifs, etc. La réponse inclut une `url` directe vers la page de l'annonce Airbnb.

## Fonctionnalités

- Respecte les règles du fichier robots.txt d'Airbnb
- Utilise cheerio pour l'analyse HTML
- Aucune clé API requise
- Retourne des données JSON structurées
- Réduit la charge de contexte en aplatissant et en sélectionnant les données
- Fournit des URL directes vers les annonces Airbnb

## Installation

### Installation sur Claude Desktop
Avant de commencer, assurez-vous que [Node.js](https://nodejs.org/) est installé sur votre ordinateur pour que `npx` fonctionne.

1. Allez dans : Paramètres > Développeur > Modifier la configuration

2. Ajoutez ce qui suit à votre fichier `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "airbnb": {
      "command": "npx",
      "args": [
        "-y",
        "@openbnb/mcp-server-airbnb"
      ]
    }
  }
}
```

Pour ignorer le fichier robots.txt pour toutes les requêtes, utilisez cette version avec l'argument `--ignore-robots-txt` :

```json
{
  "mcpServers": {
    "airbnb": {
      "command": "npx",
      "args": [
        "-y",
        "@openbnb/mcp-server-airbnb",
        "--ignore-robots-txt"
      ]
    }
  }
}
```
3. Redémarrez Claude Desktop et planifiez votre prochain voyage incluant des Airbnbs !

### Autre option : Installation via Smithery

Pour installer mcp-server-airbnb pour Claude Desktop automatiquement via [Smithery](https://smithery.ai/server/@openbnb-org/mcp-server-airbnb) :

```bash
npx -y @smithery/cli install @openbnb-org/mcp-server-airbnb --client claude
```

## Compilation (pour les développeurs)

```bash
npm install
npm run build
```

## Licence

Ce serveur MCP est sous licence MIT.

## Avertissement

Airbnb est une marque déposée d'Airbnb, Inc.
OpenBnB n'est pas lié à Airbnb, Inc. ou à ses filiales
