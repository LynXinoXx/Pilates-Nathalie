# Pilates Nathalie Cadotte — Formation Peak Pilates®

Landing page pour la Formation Peak Pilates® de Pilates Nathalie Cadotte.

## Pages

- `index.html` — Landing page principale avec formulaire de demande
- `formulaire.html` — Version formulaire de contact
- `appel.html` — Version avec réservation d'appel (Calendly mock)
- `mobile.html` — Aperçu mobile (iPhone)

## Déploiement

Site déployé via GitHub Pages depuis la branche `main`. Le formulaire fonctionne aussi sur Vercel avec `/api/lead`.

## Formulaire et A/B test

- Les demandes sont envoyées via `/api/lead` sur Vercel si `RESEND_API_KEY`, `LEAD_NOTIFY_TO` et `LEAD_FROM` sont configurés.
- Si l'API Vercel n'est pas configurée, le formulaire retombe sur FormSubmit vers `info@pilatesnathaliecadotte.com`.
- Le headline est split-testé en A/B via `assets/js/lead-ab.js`.
- Les événements Vercel Analytics envoyés sont `Headline Viewed`, `Lead Form Submitted` et `Lead Captured`, avec la propriété `variant`.

## Pour passer en prod

1. Activer Web Analytics dans Vercel si le site est migré sur Vercel
2. Configurer l'envoi courriel Vercel (`RESEND_API_KEY`, `LEAD_NOTIFY_TO`, `LEAD_FROM`)
3. Remplacer le mock Calendly de `appel.html` par le vrai embed
4. Remplacer l'image statique du hero par l'iframe YouTube/Vimeo quand la vidéo est prête
