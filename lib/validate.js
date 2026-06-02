const dns = require('dns').promises;
const net = require('net');

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
  'spam.su', 'boximail.com', 'fakemail.fr', 'jetable.fr.nf',
  'jetable.net', 'jetable.org', 'jetable.pp.ua', 'klzlk.com',
  'maileater.com', 'mailed.ro', 'mailinator.gq', 'mailme.ir',
  'mailme.lv', 'mailzilla.com', 'mega.zik.dj', 'meinspamschutz.de',
  'meltmail.com', 'mierdamail.com', 'moncourrier.fr.nf', 'monemail.fr.nf',
  'monmail.fr.nf', 'mt2009.com', 'mt2014.com', 'mytempemail.com',
  'noclickemail.com', 'nospamfor.us', 'nospammail.net', 'nowmymail.com',
  'objectmail.com', 'obobbo.com', 'odaymail.com', 'oneoffemail.com',
  'onewaymail.com', 'online.ms', 'opayq.com', 'ordinaryamerican.net',
  'owlpic.com', 'pancakemail.com', 'paplease.com', 'pepbot.com',
  'quickinbox.com', 'rcpt.at', 'reallymymail.com', 'receiveee.com',
  'recyclemail.dk', 'redirected.org', 'rtrtr.com', 's0ny.net',
  'safe-mail.gq', 'safetymail.info', 'safetypost.de', 'sandelf.de',
  'saynotospams.com', 'selfdestructingmail.com', 'sendspamhere.com',
  'shiftmail.com', 'shortmail.net', 'sibmail.com', 'skeefmail.com',
  'slaskpost.se', 'slopsbox.com', 'smellfear.com', 'sneakemail.com',
  'sneakmail.de', 'snkmail.com', 'sofimail.com', 'spamcero.com',
  'spamcon.org', 'spamcorptastic.com', 'spamcowboy.com', 'spamcowboy.net',
  'spamcowboy.org', 'spamday.com', 'spamfree.eu', 'spamfree24.de',
  'spamherelots.com', 'spamhereplease.com', 'spamify.com', 'spaminator.de',
  'spamkill.info', 'spaml.com', 'spaml.de', 'spammotel.com',
  'spamobox.com', 'spamstack.net', 'spamtrail.com', 'spamtroll.net',
]);

// MX cache: domain -> { exists: bool, exchange: string|null }
const mxCache = new Map();

async function getMx(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      const r = { exists: false, exchange: null };
      mxCache.set(domain, r);
      return r;
    }
    records.sort((a, b) => a.priority - b.priority);
    const r = { exists: true, exchange: records[0].exchange };
    mxCache.set(domain, r);
    return r;
  } catch {
    const r = { exists: false, exchange: null };
    mxCache.set(domain, r);
    return r;
  }
}

// SMTP verification: connects to port 25 and probes the mailbox
// Returns: 'valid' | 'invalid_mailbox' | 'unverifiable'
const smtpCache = new Map();

async function smtpVerify(email, exchange) {
  if (smtpCache.has(email)) return smtpCache.get(email);

  const result = await new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { socket.destroy(); } catch {}
      resolve(r);
    };

    const timer = setTimeout(() => finish('unverifiable'), 5000);
    const socket = net.createConnection({ port: 25, host: exchange });
    socket.setEncoding('utf8');

    let buf = '';
    let step = 0;

    socket.on('data', (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
        if (line.length < 3) continue;
        const code = parseInt(line.slice(0, 3), 10);
        if (isNaN(code)) continue;
        if (line[3] === '-') continue; // multi-line response, wait for last line

        if (step === 0 && code === 220) {
          step = 1;
          socket.write('EHLO mailvalidator.com\r\n');
        } else if (step === 1 && code === 250) {
          step = 2;
          socket.write('MAIL FROM:<verify@mailvalidator.com>\r\n');
        } else if (step === 2 && code === 250) {
          step = 3;
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else if (step === 3) {
          socket.write('QUIT\r\n');
          if (code === 250 || code === 251) {
            finish('valid');
          } else if ([550, 551, 552, 553, 554].includes(code)) {
            finish('invalid_mailbox');
          } else {
            finish('unverifiable');
          }
        } else if (code >= 400 && step < 3) {
          finish('unverifiable');
        }
      }
    });

    socket.on('error', () => finish('unverifiable'));
    socket.on('timeout', () => finish('unverifiable'));
    socket.on('close', () => finish('unverifiable'));
  });

  smtpCache.set(email, result);
  return result;
}

async function validateEmail(email) {
  const trimmed = (email || '').trim().toLowerCase();

  if (!EMAIL_REGEX.test(trimmed)) {
    return { email: trimmed, status: 'invalid', reason: 'Invalid format' };
  }

  const atIdx = trimmed.lastIndexOf('@');
  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { email: trimmed, status: 'disposable', reason: 'Disposable email domain' };
  }

  if (ROLE_PREFIXES.has(local)) {
    return { email: trimmed, status: 'role', reason: 'Role-based address' };
  }

  const mx = await getMx(domain);
  if (!mx.exists) {
    return { email: trimmed, status: 'no-mx', reason: 'Domain has no mail servers' };
  }

  const smtp = await smtpVerify(trimmed, mx.exchange);
  if (smtp === 'invalid_mailbox') {
    return { email: trimmed, status: 'invalid', reason: 'Mailbox does not exist' };
  }
  if (smtp === 'unverifiable') {
    return { email: trimmed, status: 'unverifiable', reason: 'Domain valid — mailbox unverifiable' };
  }

  return { email: trimmed, status: 'valid', reason: 'Deliverable' };
}

async function validateBatch(emails, concurrency = 10) {
  const results = [];
  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(validateEmail));
    results.push(...batchResults);
  }
  return results;
}

module.exports = { validateEmail, validateBatch };
