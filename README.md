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

- Les demandes sont envoyées via `/api/lead` sur Vercel.
- Pour envoyer un SMS via Zapier, configurer `ZAPIER_LEAD_WEBHOOK_URL` avec l'URL Catch Hook du Zap.
- Pour envoyer aussi un courriel via Vercel, configurer `RESEND_API_KEY`, `LEAD_NOTIFY_TO` et `LEAD_FROM`.
- Pour envoyer les conversions serveur vers Meta, configurer `META_ACCESS_TOKEN`. `META_PIXEL_ID` est optionnel si le Pixel reste `903170500946037`.
- Si l'API Vercel n'est pas configurée, le formulaire retombe sur FormSubmit vers `info@pilatesnathaliecadotte.com`.
- Le headline est split-testé en A/B via `assets/js/lead-ab.js`.
- Les événements Vercel Analytics envoyés sont `Headline Viewed`, `Lead Form Submitted` et `Lead Captured`, avec la propriété `variant`.
- Le Pixel Meta envoie `LeadFormInitiated` au début du formulaire et `Lead` après soumission réussie. Le serveur envoie aussi `Lead` via Conversions API avec le même `event_id` pour la déduplication.

## Pour passer en prod

1. Activer Web Analytics dans Vercel si le site est migré sur Vercel
2. Créer le Zap: Webhooks by Zapier `Catch Hook` → Twilio ou SMS by Zapier `Send SMS`
3. Ajouter `ZAPIER_LEAD_WEBHOOK_URL` dans les variables d'environnement Vercel
4. Ajouter `META_ACCESS_TOKEN` dans Vercel pour activer Meta Conversions API
5. Configurer l'envoi courriel Vercel si désiré (`RESEND_API_KEY`, `LEAD_NOTIFY_TO`, `LEAD_FROM`)
6. Remplacer le mock Calendly de `appel.html` par le vrai embed
7. Remplacer l'image statique du hero par l'iframe YouTube/Vimeo quand la vidéo est prête
