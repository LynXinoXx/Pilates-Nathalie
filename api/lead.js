const crypto = require('crypto');

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function text(value) {
  return String(value || '').trim();
}

function sha256(value) {
  const normalized = text(value).toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function sha256Phone(value) {
  let normalized = text(value).replace(/\D/g, '');
  if (normalized.length === 10) normalized = `1${normalized}`;
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => Boolean(field)));
}

function clientIp(req) {
  const forwarded = text(req.headers['x-forwarded-for']);
  if (forwarded) return forwarded.split(',')[0].trim();
  return text(req.headers['x-real-ip']) || undefined;
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function notifyMetaConversionsApi(lead, req) {
  const accessToken = text(process.env.META_ACCESS_TOKEN);
  const pixelId = text(process.env.META_PIXEL_ID) || '903170500946037';
  const graphVersion = text(process.env.META_GRAPH_VERSION) || 'v25.0';
  if (!accessToken || !pixelId) return { configured: false, ok: false };

  const userData = compactObject({
    em: sha256(lead.email),
    ph: sha256Phone(lead.tel),
    fn: sha256(lead.prenom),
    ln: sha256(lead.nom),
    client_ip_address: clientIp(req),
    client_user_agent: text(req.headers['user-agent']) || undefined,
    fbp: text(lead.fbp) || undefined,
    fbc: text(lead.fbc) || undefined,
  });

  const event = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    event_id: text(lead.meta_event_id) || `lead_${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    action_source: 'website',
    event_source_url: text(lead.page_url) || 'https://pilates-nathalie.vercel.app/',
    user_data: userData,
    custom_data: {
      content_name: 'PPC-1 formation inquiry',
      content_category: 'Pilates certification',
      currency: 'CAD',
      value: 3850,
      headline_variant: text(lead.headline_variant) || undefined,
      headline_text: text(lead.headline_text) || undefined,
      paiement: text(lead.paiement) || undefined,
    },
  };

  const body = { data: [event] };
  if (text(process.env.META_TEST_EVENT_CODE)) body.test_event_code = text(process.env.META_TEST_EVENT_CODE);

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const detail = await response.text();
  if (!response.ok) {
    console.error('Meta Conversions API failed', detail);
    return { configured: true, ok: false };
  }

  try {
    const parsed = JSON.parse(detail);
    return { configured: true, ok: Number(parsed.events_received || 0) > 0 };
  } catch (error) {
    return { configured: true, ok: true };
  }
}

function leadRows(lead) {
  const labels = {
    prenom: 'Prénom',
    nom: 'Nom',
    email: 'Courriel',
    tel: 'Téléphone',
    heures: 'Heures de Pilates pratiquées',
    paiement: 'Mode de paiement préféré',
    message: 'Message',
    headline_variant: 'Variante A/B',
    headline_text: 'Headline',
    page_url: 'Page',
    submitted_at: 'Soumis le',
  };

  return Object.keys(labels)
    .map((key) => `<tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #eee">${labels[key]}</th><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(lead[key]) || '-'}</td></tr>`)
    .join('');
}

async function notifyZapier(lead) {
  const webhookUrl = text(process.env.ZAPIER_LEAD_WEBHOOK_URL);
  if (!webhookUrl) return { configured: false, ok: false };

  const message = [
    'Nouvelle demande PPC-1',
    `${text(lead.prenom)} ${text(lead.nom)}`.trim(),
    `Téléphone: ${text(lead.tel)}`,
    `Courriel: ${text(lead.email)}`,
    `Heures: ${text(lead.heures) || '-'}`,
    `Paiement: ${text(lead.paiement) || '-'}`,
    `Variante: ${text(lead.headline_variant) || '-'}`,
  ].join('\n');

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'pnc_ppc1_lead',
      message,
      lead,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Zapier lead webhook failed', detail);
    return { configured: true, ok: false };
  }

  return { configured: true, ok: true };
}

async function notifyEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFY_TO;
  const from = process.env.LEAD_FROM;
  if (!apiKey || !to || !from) return { configured: false, ok: false };

  const name = `${text(lead.prenom)} ${text(lead.nom)}`.trim();
  const subject = `Nouvelle demande PPC-1 - ${name}`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.5">
      <h2>Nouvelle demande PPC-1</h2>
      <p>Une personne vient de remplir le formulaire de la formation Peak Pilates PPC-1.</p>
      <table style="border-collapse:collapse;width:100%;max-width:720px">${leadRows(lead)}</table>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: text(lead.email),
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Resend lead email failed', detail);
    return { configured: true, ok: false };
  }

  return { configured: true, ok: true };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });

  let lead;
  try {
    lead = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}');
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
  }
  const required = ['prenom', 'nom', 'email', 'tel'];
  const missing = required.filter((field) => !text(lead[field]));
  if (missing.length) return sendJson(res, 400, { ok: false, error: `Missing fields: ${missing.join(', ')}` });

  const [zapier, email, meta] = await Promise.allSettled([
    notifyZapier(lead),
    notifyEmail(lead),
    notifyMetaConversionsApi(lead, req),
  ]);
  const results = [zapier, email]
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  if (meta.status === 'rejected') console.error('Meta Conversions API threw', meta.reason);
  if (meta.status === 'fulfilled' && meta.value.configured && !meta.value.ok) console.error('Meta Conversions API did not accept the lead event');
  const configured = results.some((result) => result.configured);
  const delivered = results.some((result) => result.ok);

  if (!configured) return sendJson(res, 503, { ok: false, error: 'Lead delivery is not configured' });
  if (!delivered) return sendJson(res, 502, { ok: false, error: 'Lead delivery failed' });

  return sendJson(res, 200, { ok: true });
};
