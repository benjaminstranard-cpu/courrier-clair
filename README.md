# Courrier Clair

Photographie une lettre officielle (mutuelle, INAMI, SPF Finances, commune, CPAS, propriétaire…). Courrier Clair te dit en mots simples de quoi elle parle, ce que tu dois faire, et met les dates dans ton agenda.

## Ce que fait l'application

- **Scan de la lettre** : une photo par page, jusqu'à 4 pages, ou le texte collé.
- **Lecture gratuite sur le téléphone** : le texte est lu sur l'appareil (Tesseract.js). La photo n'est envoyée nulle part.
- **Explication simple** : qui écrit, le genre de courrier (convocation, facture, rappel, décision, demande de documents, impôts, huissier…), l'urgence, les étapes, ce qui arrive si on ne fait rien, qui peut aider.
- **Agenda intégré** : vue du mois, liste « À venir », rappel 3 jours avant, ajout à la main.
- **Google Agenda** : un lien par date pour l'y copier, et l'export de tout l'agenda en fichier `.ics`.
- **Rappels** : une notification la veille et le jour même, quand on ouvre l'application.
- **Option payante** : une explication détaillée par Claude avec ta propre clé API Anthropic.
- **Installable** sur l'écran d'accueil du téléphone, et utilisable sans internet après le premier lancement.

## Mettre l'application en ligne avec GitHub Pages (gratuit)

1. Crée un dépôt public sur github.com, par exemple `courrier-clair`.
2. Envoie tous les fichiers de ce dossier dans le dépôt.
3. Dans le dépôt : **Settings › Pages › Build and deployment** : Source « Deploy from a branch », branche `main`, dossier `/ (root)`, puis **Save**.
4. Après une minute, l'application est en ligne à l'adresse `https://<ton-nom>.github.io/courrier-clair/`.

## Installer sur le téléphone

- **Android (Chrome)** : ouvre l'adresse, puis menu ⋮ › « Ajouter à l'écran d'accueil ».
- **iPhone (Safari)** : ouvre l'adresse, puis bouton Partager › « Sur l'écran d'accueil ».

## Limites

- La lecture gratuite reconnaît les courriers les plus courants. Pour une lettre inhabituelle, lis le texte trouvé ou utilise l'option Claude.
- L'agenda est gardé sur l'appareil : il n'est pas partagé entre ton téléphone et ton ordinateur.
- Courrier Clair explique, il ne décide pas. Vérifie toujours auprès de l'organisme qui t'écrit.
