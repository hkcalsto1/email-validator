const dns = require('dns').promises;

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

const ROLE_PREFIXES = new Set([
  'admin', 'administrator', 'info', 'support', 'help', 'contact',
  'noreply', 'no-reply', 'postmaster', 'webmaster', 'hostmaster',
  'abuse', 'billing', 'sales', 'marketing', 'hr', 'jobs', 'careers',
  'press', 'media', 'legal', 'privacy', 'security', 'team', 'hello',
  'office', 'mail', 'email', 'enquiries', 'enquiry', 'service',
  'services', 'feedback', 'newsletter', 'notifications', 'alerts',
  'bounce', 'donotreply', 'do-not-reply', 'mailer-daemon',
]);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org', 'tempmail.com',
  'throwam.com', 'yopmail.com', 'yopmail.fr', 'spam4.me', 'trashmail.com',
  'trashmail.me', 'trashmail.net', 'trashmail.at', 'trashmail.io', 'trashmail.xyz',
  'trashdevil.com', 'trashdevil.de', 'fakeinbox.com', 'tempinbox.com',
  'dispostable.com', 'tempr.email', 'discardmail.com', 'discardmail.de',
  'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org', 'maildrop.cc',
  'mailnesia.com', 'mailsac.com', 'throwaway.email', 'sharklasers.com', 'grr.la',
  'mytemp.email', 'temp-mail.org', 'temp-mail.de', 'temp-mail.ru',
  'fakemailgenerator.com', 'getairmail.com', 'mailnull.com', 'mailnew.com',
  'spamex.com', 'spam.la', '10minutemail.com', '10minutemail.net',
  '10minutemail.org', '10minutemail.de', 'minutemailbox.com', 'tmpmail.net',
  'tmpmail.org', 'discard.email', 'mailtemp.net', 'mailtemp.info',
  'tempmailaddress.com', 'emailfake.com', 'fake-box.com', 'tempm.com',
  'anonymousemail.me', 'thisisnotmyrealemail.com', 'mohmal.com',
  'crazymailing.com', 'mailbidon.com', 'mailmetrash.com', 'nomail.xl.cx',
  'pookmail.com', 'sogetthis.com', 'spamavert.com', 'spamfree24.org',
  'spamhole.com', 'spamoff.de', 'spamslicer.com', 'spamspot.com',
  'spamthis.co.uk', 'temporaryinbox.com', 'tempsky.com', 'tempomail.fr',
  'thanksnospam.info', 'tyldd.com', 'wh4f.org', 'whyspam.me',
  'xagloo.com', 'xtend.biz', 'yep.it', 'za.com', 'zoemail.org',
  'guerrillamailblock.com', 'mailinator2.com', 'suremail.info',
  'spambob.com', 'spambob.net', 'spambob.org', 'spamgob.com',
  'mailexpire.com', 'trashmail2.com', 'tempmail.de', 'filzmail.com',
  'spam.su', 'boximail.com', 'dispostable.com', 'fakemail.fr',
  'jetable.fr.nf', 'jetable.net', 'jetable.org', 'jetable.pp.ua',
  'klzlk.com', 'lol.ovpn.to', 'lovemeleaveme.com', 'lr78.com',
  'maileater.com', 'mailed.ro', 'mailinator.gq', 'mailme.ir',
  'mailme.lv', 'mailmetrash.com', 'mailnew.com', 'mailnull.com',
  'mailzilla.com', 'mega.zik.dj', 'meinspamschutz.de', 'meltmail.com',
  'mierdamail.com', 'moncourrier.fr.nf', 'monemail.fr.nf',
  'monmail.fr.nf', 'mt2009.com', 'mt2014.com', 'mytempemail.com',
  'noclickemail.com', 'nospamfor.us', 'nospammail.net',
  'nowmymail.com', 'objectmail.com', 'obobbo.com', 'odaymail.com',
  'oneoffemail.com', 'onewaymail.com', 'online.ms', 'opayq.com',
  'ordinaryamerican.net', 'owlpic.com', 'pancakemail.com', 'paplease.com',
  'pcusers.otherinbox.com', 'pepbot.com', 'phd-com.com', 'plexolan.de',
  'quickinbox.com', 'rcpt.at', 'reallymymail.com', 'receiveee.com',
  'recipeforum.com', 'recursor.net', 'recyclemail.dk', 'redirected.org',
  'rtrtr.com', 's0ny.net', 'safe-mail.gq', 'safetymail.info',
  'safetypost.de', 'sandelf.de', 'saynotospams.com', 'selfdestructingmail.com',
  'sendspamhere.com', 'shiftmail.com', 'shitmail.me', 'shortmail.net',
  'sibmail.com', 'skeefmail.com', 'slaskpost.se', 'slopsbox.com',
  'smellfear.com', 'snailimax.com', 'sneakemail.com', 'sneakmail.de',
  'snkmail.com', 'sofimail.com', 'sogetthis.com', 'spam.la',
  'spamavert.com', 'spamcero.com', 'spamcon.org', 'spamcorptastic.com',
  'spamcowboy.com', 'spamcowboy.net', 'spamcowboy.org', 'spamday.com',
  'spamfree.eu', 'spamfree24.de', 'spamgob.com', 'spamherelots.com',
  'spamhereplease.com', 'spamify.com', 'spaminator.de', 'spamkill.info',
  'spaml.com', 'spaml.de', 'spammotel.com', 'spamobox.com',
  'spamoff.de', 'spamslicer.com', 'spamspot.com',
  'spamstack.net', 'spamtrail.com', 'spamtroll.net',
]);

const mxCache = new Map();

async function checkMx(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  try {
    const records = await dns.resolveMx(domain);
    const result = !!(records && records.length > 0);
    mxCache.set(domain, result);
    return result;
  } catch {
    mxCache.set(domain, false);
    return false;
  }
}

async function validateEmail(email) {
  const trimmed = (email || '').trim().toLowerCase();

  if (!EMAIL_REGEX.test(trimmed)) {
    return { email: trimmed, status: 'invalid', reason: 'Invalid format' };
  }

  const atIdx = trimmed.lastIndexOf('@');
  const local = trimmed.substring(0, atIdx);
  const domain = trimmed.substring(atIdx + 1);

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { email: trimmed, status: 'disposable', reason: 'Disposable email domain' };
  }

  if (ROLE_PREFIXES.has(local)) {
    return { email: trimmed, status: 'role', reason: 'Role-based address' };
  }

  const hasMx = await checkMx(domain);
  if (!hasMx) {
    return { email: trimmed, status: 'no-mx', reason: 'Domain has no mail servers' };
  }

  return { email: trimmed, status: 'valid', reason: 'Deliverable' };
}

async function validateBatch(emails, concurrency = 20) {
  const results = [];
  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(validateEmail));
    results.push(...batchResults);
  }
  return results;
}

module.exports = { validateEmail, validateBatch };
