module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }

  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}');
    console.log('ab-event', JSON.stringify(body));
  } catch (error) {
    console.log('ab-event-unparsed');
  }

  res.statusCode = 204;
  return res.end();
};
