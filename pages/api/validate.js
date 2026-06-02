const { validateEmail } = require('../../lib/validate');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email field required' });
  }

  const result = await validateEmail(email);
  res.json(result);
}
