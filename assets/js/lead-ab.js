(function () {
  const LEAD_EMAIL = 'info@pilatesnathaliecadotte.com';
  const VARIANTS = {
    A: {
      label: 'Apprendre a voir',
      html: 'Apprendre à voir.<br>Apprendre à guider.<span class="accent">Une formation classique complète.</span>',
    },
    B: {
      label: 'Devenir instructrice',
      html: 'Deviens instructrice Pilates.<br><span class="accent">Une formation reconnue sur tous les appareils.</span>',
    },
  };

  function getVariantKey() {
    const params = new URLSearchParams(window.location.search);
    const forced = (params.get('headline') || '').toUpperCase();
    if (VARIANTS[forced]) return forced;

    const stored = window.localStorage.getItem('pnc_headline_variant');
    if (VARIANTS[stored]) return stored;

    const selected = Math.random() < 0.5 ? 'A' : 'B';
    window.localStorage.setItem('pnc_headline_variant', selected);
    return selected;
  }

  const variantKey = getVariantKey();
  const variant = VARIANTS[variantKey];
  let viewedTracked = false;

  function cookieValue(name) {
    return document.cookie
      .split('; ')
      .find((part) => part.startsWith(`${name}=`))
      ?.split('=')
      .slice(1)
      .join('=') || '';
  }

  function metaEventId(prefix) {
    if (window.crypto && window.crypto.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  function metaFbc() {
    const existing = cookieValue('_fbc');
    if (existing) return existing;

    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    if (!fbclid) return '';
    return `fb.1.${Date.now()}.${fbclid}`;
  }

  function track(eventName, data) {
    const payload = Object.assign({
      variant: variantKey,
      headline: variant.label,
      page: window.location.pathname || '/',
    }, data || {});

    if (window.va) window.va('event', eventName, payload);
    if (window.fbq && eventName === 'Lead Form Initiated') {
      window.fbq('track', 'LeadFormInitiated', {
        content_name: 'PPC-1 formation inquiry',
        currency: 'CAD',
        value: 3850,
        variant: variantKey,
        headline: variant.label,
      });
    }
    if (window.fbq && eventName === 'Lead Captured') {
      const leadPayload = {
        content_name: 'PPC-1 formation inquiry',
        currency: 'CAD',
        value: 3850,
        variant: variantKey,
        headline: variant.label,
      };
      if (data && data.meta_event_id) window.fbq('track', 'Lead', leadPayload, { eventID: data.meta_event_id });
      else window.fbq('track', 'Lead', leadPayload);
    }

    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ eventName, payload })], { type: 'application/json' });
      navigator.sendBeacon('/api/ab-event', blob);
    } else {
      fetch('/api/ab-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName, payload }),
        keepalive: true,
      }).catch(() => {});
    }
  }

  function applyHeadline() {
    const headlines = document.querySelectorAll('[data-ab-headline]');
    headlines.forEach((headline) => {
      if (headline.dataset.abApplied === variantKey) return;
      headline.innerHTML = variant.html;
      headline.dataset.abApplied = variantKey;
    });

    document.querySelectorAll('[data-ab-variant-field]').forEach((field) => { field.value = variantKey; });
    document.querySelectorAll('[data-ab-headline-field]').forEach((field) => { field.value = variant.label; });

    if (headlines.length && !viewedTracked) {
      viewedTracked = true;
      track('Headline Viewed');
    }
  }

  function formPayload(form) {
    const formData = new FormData(form);
    formData.set('meta_event_id', metaEventId('lead'));
    formData.set('fbp', cookieValue('_fbp'));
    formData.set('fbc', metaFbc());
    formData.set('headline_variant', variantKey);
    formData.set('headline_text', variant.label);
    formData.set('page_url', window.location.href);
    formData.set('submitted_at', new Date().toISOString());

    const payload = {};
    formData.forEach((value, key) => {
      if (!key.startsWith('_')) payload[key] = value;
    });
    return { formData, payload };
  }

  async function fetchWithTimeout(url, options) {
    if (!window.AbortController) return fetch(url, options);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function submitToVercel(payload) {
    const endpoint = window.location.hostname.endsWith('vercel.app')
      ? '/api/lead'
      : 'https://pilates-nathalie.vercel.app/api/lead';
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('vercel lead endpoint unavailable');
    return response.json();
  }

  async function submitToFormSubmit(formData, form) {
    const endpoint = form.action.replace('https://formsubmit.co/', 'https://formsubmit.co/ajax/');
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    });
    if (!response.ok) throw new Error('fallback form endpoint unavailable');
    return response.json();
  }

  function showSuccess(form) {
    const card = form.closest('.form-card') || form;
    card.innerHTML = '<div class="form-success"><div class="check-big">✓</div><h4>Demande envoyée !</h4><p>On te recontacte sous 24-48h. Surveille tes courriels et tes indésirables.</p></div>';
  }

  function showError(form) {
    const existing = form.querySelector('[data-form-error]');
    if (existing) existing.remove();
    const error = document.createElement('p');
    error.dataset.formError = 'true';
    error.className = 'form-footnote';
    error.style.color = '#B94A3A';
    error.textContent = "La demande n'a pas pu être envoyée. Réessaie dans quelques secondes ou écris à info@pilatesnathaliecadotte.com.";
    form.appendChild(error);
  }

  function setupForms() {
    document.querySelectorAll('[data-lead-form]').forEach((form) => {
      if (form.dataset.leadBound) return;
      form.dataset.leadBound = 'true';
      form.addEventListener('focusin', () => {
        if (form.dataset.metaLeadInitiated) return;
        form.dataset.metaLeadInitiated = 'true';
        track('Lead Form Initiated');
      });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        applyHeadline();

        const submitButton = form.querySelector('[type="submit"]');
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.dataset.originalText = submitButton.textContent;
          submitButton.textContent = 'Envoi en cours...';
        }

        const { formData, payload } = formPayload(form);
        track('Lead Form Submitted', { intent: payload.paiement || 'unknown' });

        try {
          await submitToVercel(payload);
        } catch (vercelError) {
          try {
            await submitToFormSubmit(formData, form);
          } catch (fallbackError) {
            showError(form);
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = submitButton.dataset.originalText || 'Envoyer ma demande →';
            }
            return;
          }
        }

        track('Lead Captured', {
          intent: payload.paiement || 'unknown',
          meta_event_id: payload.meta_event_id,
        });
        showSuccess(form);
      });
    });
  }

  function init() {
    applyHeadline();
    setupForms();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 500);
  setTimeout(init, 1500);
})();
