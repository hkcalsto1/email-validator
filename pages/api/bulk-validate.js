const { validateBatch } = require('../../lib/validate');

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { emails } = req.body || {};
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'emails array required' });
  }
  if (emails.length > 5000) {
    return res.status(400).json({ error: 'Maximum 5,000 emails per batch' });
  }

  const results = await validateBatch(emails, 20);

  const summary = { valid: 0, invalid: 0, disposable: 0, role: 0, 'no-mx': 0 };
  for (const r of results) {
    summary[r.status] = (summary[r.status] || 0) + 1;
  }

  res.json({ total: results.length, summary, results });
}
