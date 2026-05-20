function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function text(value) {
  return String(value || '').trim();
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

  const [zapier, email] = await Promise.allSettled([notifyZapier(lead), notifyEmail(lead)]);
  const results = [zapier, email]
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  const configured = results.some((result) => result.configured);
  const delivered = results.some((result) => result.ok);

  if (!configured) return sendJson(res, 503, { ok: false, error: 'Lead delivery is not configured' });
  if (!delivered) return sendJson(res, 502, { ok: false, error: 'Lead delivery failed' });

  return sendJson(res, 200, { ok: true });
};
