/*
 * TaxTrail — receipt text parsing & small-business tax classification.
 * Pure JS, no dependencies. Runs in browser and Node (for tests).
 * Categories align with IRS Schedule C expense lines where practical.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.ReceiptClassifier = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- Category definitions (keyword → Schedule C-friendly category) ----
  var CATEGORIES = [
    {
      name: 'Meals & Entertainment', group: 'Everyday Operations',
      scheduleC: 'Line 24b — Meals (50% deductible)',
      keywords: ['restaurant', 'cafe', 'caffe', 'coffee', 'espresso', 'grill', 'diner', 'bistro',
        'pizza', 'pizzeria', 'sushi', 'taco', 'burger', 'bbq', 'steakhouse', 'bakery', 'deli',
        'starbucks', 'mcdonald', 'chipotle', 'subway', 'wendy', 'chick-fil-a', 'chickfila',
        'panera', 'dunkin', 'domino', 'kfc', 'taqueria', 'brewery', 'pub ', 'bar & ', 'cantina',
        'catering', 'doordash', 'grubhub', 'ubereats', 'uber eats', 'server:', 'table ', 'gratuity', 'dine in', 'takeout']
    },
    {
      name: 'Car & Truck / Fuel', group: 'Vehicle & Travel',
      scheduleC: 'Line 9 — Car and truck expenses',
      keywords: ['shell', 'chevron', 'exxon', 'mobil', 'texaco', 'sunoco', 'arco', 'marathon',
        'speedway', 'circle k', 'pilot', 'wawa fuel', 'fuel', 'gasoline', 'unleaded', 'diesel',
        'gallons', 'pump #', 'pump#', 'car wash', 'jiffy lube', 'valvoline', 'autozone',
        'o\'reilly', 'oreilly', 'napa auto', 'pep boys', 'firestone', 'goodyear', 'tire',
        'oil change', 'parking', 'toll', 'garage']
    },
    {
      name: 'Office Supplies', group: 'Everyday Operations',
      scheduleC: 'Line 18 — Office expense',
      keywords: ['staples', 'office depot', 'officemax', 'office max', 'toner', 'ink cartridge',
        'copy paper', 'notebook', 'binder', 'stationery', 'pens', 'printer paper', 'envelopes', 'paper clips']
    },
    {
      name: 'Supplies & Materials', group: 'Everyday Operations',
      scheduleC: 'Line 22 — Supplies',
      keywords: ['home depot', 'lowe\'s', 'lowes', 'ace hardware', 'harbor freight', 'menards',
        'tractor supply', 'grainger', 'fastenal', 'lumber', 'hardware', 'paint', 'drywall',
        'plumbing', 'electrical supply', 'tools', 'fasteners', 'materials']
    },
    {
      name: 'Travel & Lodging', group: 'Vehicle & Travel',
      scheduleC: 'Line 24a — Travel',
      keywords: ['hotel', 'motel', ' inn ', 'inn\n', 'marriott', 'hilton', 'hyatt', 'holiday inn',
        'best western', 'airbnb', 'vrbo', 'delta air', 'united air', 'american airlines',
        'southwest', 'alaska air', 'jetblue', 'airline', 'airfare', 'flight', 'baggage',
        'amtrak', 'rental car', 'hertz', 'avis', 'enterprise rent', 'budget rent',
        'uber', 'lyft', 'taxi', 'checkin', 'check-in', 'check out date', 'nights', 'room rate', 'lodging']
    },
    {
      name: 'Utilities & Phone', group: 'Facilities',
      scheduleC: 'Line 25 — Utilities',
      keywords: ['verizon', 'at&t', 'att ', 't-mobile', 'tmobile', 'comcast', 'xfinity', 'spectrum',
        'centurylink', 'electric', 'utility', 'utilities', 'water bill', 'internet service',
        'wireless bill', 'power co', 'energy', 'kwh']
    },
    {
      name: 'Advertising & Marketing', group: 'Everyday Operations',
      scheduleC: 'Line 8 — Advertising',
      keywords: ['facebook ads', 'meta ads', 'google ads', 'adwords', 'instagram ads', 'tiktok ads',
        'vistaprint', 'mailchimp', 'constant contact', 'billboard', 'flyer', 'business cards',
        'signage', 'promo', 'advertising', 'marketing', 'sponsorship', 'yelp ads']
    },
    {
      name: 'Software & Subscriptions', group: 'Everyday Operations',
      scheduleC: 'Line 27a — Other expenses (software)',
      keywords: ['adobe', 'microsoft 365', 'office 365', 'quickbooks', 'intuit', 'dropbox',
        'google workspace', 'gsuite', 'zoom.us', 'zoom video', 'slack', 'github', 'godaddy',
        'namecheap', 'squarespace', 'wix', 'shopify', 'canva', 'subscription', 'saas',
        'software license', 'app store', 'aws', 'amazon web services', 'openai', 'anthropic']
    },
    {
      name: 'Shipping & Postage', group: 'Everyday Operations',
      scheduleC: 'Line 27a — Other expenses (postage)',
      keywords: ['usps', 'postal service', 'fedex', 'ups store', 'ups ground', 'dhl', 'postage',
        'stamps', 'shipping label', 'priority mail', 'first-class', 'parcel']
    },
    {
      name: 'Professional Services', group: 'People & Services',
      scheduleC: 'Line 17 — Legal and professional services',
      keywords: ['attorney', 'law office', 'legal', 'cpa', 'accounting', 'accountant', 'bookkeeping',
        'consulting', 'notary', 'tax prep', 'h&r block', 'payroll service']
    },
    {
      name: 'Insurance', group: 'Financial & Admin',
      scheduleC: 'Line 15 — Insurance',
      keywords: ['insurance', 'geico', 'progressive', 'state farm', 'allstate', 'liberty mutual',
        'premium due', 'policy no', 'policy number', 'coverage']
    },
    {
      name: 'Rent & Lease', group: 'Facilities',
      scheduleC: 'Line 20 — Rent or lease',
      keywords: ['rent due', 'monthly rent', 'lease payment', 'storage unit', 'self storage',
        'public storage', 'coworking', 'wework', 'regus', 'office rent', 'booth rent']
    },
    {
      name: 'Repairs & Maintenance', group: 'Facilities',
      scheduleC: 'Line 21 — Repairs and maintenance',
      keywords: ['repair', 'maintenance', 'hvac', 'plumber', 'electrician', 'handyman',
        'service call', 'labor charge', 'parts and labor']
    },
    {
      name: 'Inventory / COGS', group: 'Goods & Inventory',
      scheduleC: 'Part III — Cost of goods sold',
      keywords: ['wholesale', 'costco business', 'restaurant depot', 'inventory', 'resale',
        'merchandise', 'sku count', 'case qty', 'distributor']
    },
    {
      name: 'General Merchandise', group: 'Everyday Operations',
      scheduleC: 'Review — could be Supplies (L22) or Office (L18)',
      keywords: ['walmart', 'target', 'costco', 'sam\'s club', 'sams club', 'kroger', 'safeway',
        'walgreens', 'cvs', 'dollar general', 'dollar tree', 'best buy', 'amazon.com', 'amzn']
    },
    {
      name: 'Contract Labor', group: 'People & Services',
      scheduleC: 'Line 11 — Contract labor (1099-NEC)',
      keywords: ['contract labor', 'subcontractor', 'freelance', 'upwork', 'fiverr', 'taskrabbit', '1099']
    },
    {
      name: 'Commissions & Fees', group: 'People & Services',
      scheduleC: 'Line 10 — Commissions and fees',
      keywords: ['commission', 'referral fee', 'finder\'s fee', 'listing fee', 'platform fee']
    },
    {
      name: 'Wages & Payroll', group: 'People & Services',
      scheduleC: 'Line 26 — Wages',
      keywords: ['payroll', 'gusto', 'adp ', 'paychex', 'wages', 'direct deposit run']
    },
    {
      name: 'Employee Benefits', group: 'People & Services',
      scheduleC: 'Line 14 — Employee benefit programs',
      keywords: ['benefits premium', 'health plan', 'dental plan', '401k', 'simple ira']
    },
    {
      name: 'Bank & Merchant Fees', group: 'Financial & Admin',
      scheduleC: 'Line 27a — Other expenses (bank/merchant fees)',
      keywords: ['bank fee', 'service charge', 'overdraft', 'wire fee', 'merchant fee', 'processing fee',
        'stripe fee', 'square fee', 'paypal fee', 'monthly maintenance fee', 'atm fee']
    },
    {
      name: 'Interest Paid', group: 'Financial & Admin',
      scheduleC: 'Line 16 — Interest (mortgage/other)',
      keywords: ['interest charged', 'finance charge', 'loan interest', 'interest payment', 'apr']
    },
    {
      name: 'Taxes & Licenses', group: 'Financial & Admin',
      scheduleC: 'Line 23 — Taxes and licenses',
      keywords: ['business license', 'license fee', 'permit', 'registration fee', 'dmv', 'state tax payment',
        'excise', 'franchise tax']
    },
    {
      name: 'Education & Training', group: 'Financial & Admin',
      scheduleC: 'Line 27a — Other expenses (education)',
      keywords: ['udemy', 'coursera', 'linkedin learning', 'training', 'seminar', 'workshop', 'conference',
        'tuition', 'certification', 'course fee', 'webinar']
    },
    {
      name: 'Dues & Memberships', group: 'Financial & Admin',
      scheduleC: 'Line 27a — Other expenses (dues)',
      keywords: ['membership dues', 'chamber of commerce', 'association dues', 'trade association',
        'annual dues', 'union dues']
    },
    {
      name: 'Home Office', group: 'Facilities',
      scheduleC: 'Line 30 — Home office (Form 8829)',
      keywords: []
    },
    {
      name: 'Depreciation / Equipment', group: 'Goods & Inventory',
      scheduleC: 'Line 13 — Depreciation & Section 179',
      keywords: []
    },
    // -------- Not Schedule C (kept separate so business totals stay clean) --------
    {
      name: 'Charitable Donation', group: 'Not Schedule C',
      scheduleC: 'Schedule A (personal itemized) — generally NOT a business expense',
      keywords: ['donation', 'donate', 'charity', 'charitable', 'church', 'ministry', 'youth group',
        'nonprofit', 'non-profit', '501(c)', 'tithe', 'offering', 'goodwill donation', 'fundraiser']
    },
    {
      name: 'Personal (non-deductible)', group: 'Not Schedule C',
      scheduleC: 'Personal — not deductible',
      keywords: []
    }
  ];

  // Cents separator tolerates OCR misreads of the decimal point: a small "." next to
  // digits is frequently scanned as { } [ ] | (e.g. "$172.37" → "$172{37"). We accept
  // those variants for the LAST separator only (thousands stay strict [.,]) and normalize
  // them back to "." in normalizeAmount, so the real total isn't lost to a garbled dot.
  //
  // The integer part is EITHER properly grouped ("1,205.55") OR a plain run of
  // digits ("1124.06"). It used to be `[0-9]{1,3}(?:[.,][0-9]{3})*`, which on an
  // ungrouped four-figure amount matched only the last three digits before the
  // decimal: $1,124.06 printed as "1124.06" was read as **124.06**, and
  // "12345.67" as 345.67. Plenty of receipts print amounts unformatted, so any
  // purchase over $999 could silently lose its leading digits — on a tax record.
  // Greedy `[0-9]+` now consumes the whole run, so a match cannot begin midway
  // through a number. Deliberately no lookbehind: Hermes support is not worth
  // betting the parser on.
  var MONEY = /\$?\s*((?:[0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]+)[.,{}\[\]|][0-9]{2})(?!\d)/;
  var TOTAL_HINTS = [
    /(?:grand\s*total|total\s*due|amount\s*due|balance\s*due|total\s*payment|payment\s*due|total\s*sale|purchase\s*total|to\s*pay|amount\s*charged)/i,
    /(?:^|\s)total(?!\s*(?:items?|qty|savings|discount|tax))/i,
    /amount(?:\s*charged|\s*paid)?/i,
    /balance/i
  ];
  // "FSA" = Flexible/Health Spending Account footer lines on warehouse receipts
  // (FSA N/TAX AMT, FSA TAX, FSA TOTAL). These are NOT the grand total or sales tax —
  // they must never win, or a "$16.99" FSA line gets picked as the whole purchase.
  var NOT_TOTAL = /(sub\s*-?\s*total|subtotal|\bfsa\b|tax|tip|gratuity|change|cash\s*back|savings|instant|discount|items?\s*(count|sold)|number|\bnum\b|\bsold\b|count|auth|account|member|points|balance\s*fwd)/i;

  // A printed tax rate is not an amount. MONEY happily matches "8.25" out of
  // "TAX 8.25%   3.71", so a receipt printing the rate and the tax on one line
  // had its RATE read as the tax — 10.00% became $10.00 of tax. US receipts
  // print this way constantly. Skip any match immediately followed by "%".
  //
  // Deliberately does NOT skip "$13.98 @ 6.0%": there the money comes first and
  // the percent belongs to the "@" clause, which the caller handles separately.
  var MONEY_G = new RegExp(MONEY.source, 'g');
  function matchMoney(line) {
    if (!line) return null;
    MONEY_G.lastIndex = 0;
    var m;
    while ((m = MONEY_G.exec(line)) !== null) {
      if (!/^\s*%/.test(line.slice(m.index + m[0].length))) return m;
    }
    return null;
  }

  function normalizeAmount(s) {
    s = s.replace(/\s/g, '');
    // OCR misreads the decimal point as a bracket/brace/pipe — restore it to "."
    s = s.replace(/[{}\[\]|]/g, '.');
    // Handle European "1.234,56" vs US "1,234.56"
    if (/,\d{2}$/.test(s)) { s = s.replace(/\./g, '').replace(',', '.'); }
    else { s = s.replace(/,/g, ''); }
    var v = parseFloat(s);
    return isNaN(v) ? null : v;
  }

  function extractTotal(lines) {
    var candidates = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = line.match(MONEY);
      for (var h = 0; h < TOTAL_HINTS.length; h++) {
        if (TOTAL_HINTS[h].test(line) && !NOT_TOTAL.test(line)) {
          // amount may be on this line or the next
          var amtLine = m ? line : (lines[i + 1] || '');
          var m2 = amtLine.match(MONEY);
          // Ignore credits/discounts printed as "6.30-" or "6.30-A"
          var isCredit = m2 && /-/.test(amtLine.slice(m2.index + m2[0].length, m2.index + m2[0].length + 2));
          if (m2 && !isCredit) {
            var v = normalizeAmount(m2[1]);
            if (v !== null && v > 0 && v < 1000000) {
              candidates.push({ value: v, priority: h, index: i });
            }
          }
          break;
        }
      }
    }
    if (candidates.length) {
      // Best hint priority wins; among equal priority, prefer the LARGEST value —
      // the grand total is the biggest total-ish number (beats stray "total items" counts).
      candidates.sort(function (a, b) { return a.priority - b.priority || b.value - a.value; });
      return candidates[0].value;
    }
    // Fallback: largest money amount on the receipt (skipping credit/discount lines)
    var max = null;
    lines.forEach(function (line) {
      var re = new RegExp(MONEY.source, 'g'); var m;
      while ((m = re.exec(line)) !== null) {
        if (/-/.test(line.slice(m.index + m[0].length, m.index + m[0].length + 2))) continue;
        var v = normalizeAmount(m[1]);
        if (v !== null && v > 0 && v < 1000000 && (max === null || v > max)) max = v;
      }
    });
    return max;
  }

  // A tip is part of what the meal cost, so it belongs in the deductible total.
  // Card slips print the pre-tip figure as "TOTAL" (or "AMOUNT CHARGED", which
  // wins on hint priority) and the real amount lower down, so extractTotal lands
  // on the smaller number and the meal is under-deducted every time.
  //
  // The rule is deliberately conservative: add the tip ONLY when the receipt
  // itself prints the post-tip figure on a total-ish line. Without that
  // confirmation there is no way to tell a pre-tip total from one that already
  // includes the tip, and guessing wrong inflates a tax deduction — a worse
  // failure than the one being fixed. A handwritten tip prints no number at all,
  // so it is correctly out of scope.
  function applyTip(lines, base) {
    if (base === null) return base;

    var tip = null;
    for (var i = 0; i < lines.length; i++) {
      if (!/\b(tip|gratuity)\b/i.test(lines[i])) continue;
      // "SUGGESTED TIP 18%" and friends are a guide, not a charge.
      if (/%/.test(lines[i]) || /suggest|guide/i.test(lines[i])) continue;
      var m = matchMoney(lines[i]) || matchMoney(lines[i + 1] || '');
      if (!m) continue;
      var v = normalizeAmount(m[1]);
      if (v !== null && v > 0) tip = tip === null ? v : Math.max(tip, v);
    }
    if (tip === null) return base;

    var target = Math.round((base + tip) * 100) / 100;
    for (var j = 0; j < lines.length; j++) {
      if (!/(total|paid|amount|balance|charge)/i.test(lines[j])) continue;
      var mm = matchMoney(lines[j]);
      if (!mm) continue;
      var mv = normalizeAmount(mm[1]);
      if (mv !== null && Math.abs(mv - target) < 0.005) return target;
    }
    return base;
  }

  var MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

  function extractDate(text) {
    var m, y, mo, d;
    // MM/DD/YYYY or MM-DD-YY etc.
    m = text.match(/\b(0?[1-9]|1[0-2])[\/\-.](0?[1-9]|[12][0-9]|3[01])[\/\-.](20[0-9]{2}|[0-9]{2})\b/);
    if (m) {
      mo = +m[1]; d = +m[2]; y = +m[3]; if (y < 100) y += 2000;
      return isoDate(y, mo, d);
    }
    // YYYY-MM-DD
    m = text.match(/\b(20[0-9]{2})[\/\-.](0?[1-9]|1[0-2])[\/\-.](0?[1-9]|[12][0-9]|3[01])\b/);
    if (m) return isoDate(+m[1], +m[2], +m[3]);
    // Jan 5, 2026 / 5 Jan 2026
    m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(0?[1-9]|[12][0-9]|3[01])(?:st|nd|rd|th)?,?\s+(20[0-9]{2})\b/i);
    if (m) return isoDate(+m[3], MONTHS[m[1].toLowerCase().slice(0,3)], +m[2]);
    m = text.match(/\b(0?[1-9]|[12][0-9]|3[01])\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(20[0-9]{2})\b/i);
    if (m) return isoDate(+m[3], MONTHS[m[2].toLowerCase().slice(0,3)], +m[1]);
    return null;
  }

  function isoDate(y, mo, d) {
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  var MERCHANT_SKIP = /^[\d\s\W]*$|^\s*(receipt|invoice|welcome|thank|order|tel|phone|fax|www\.|http|store\s*#|reg(ister)?\s*#|cashier|date|time|customer copy|duplicate|merchant|terminal|survey|www|http)/i;
  // Generic header words that are never the store name, wherever they appear on the line
  // (e.g. "SALE RECEIPT", "Sales Receipt", "TAX INVOICE", "GUEST CHECK", "Customer Copy").
  // Matches "receipt"/"invoice" anywhere, plus specific multi-word headers — but NOT bare
  // "check"/"copy" alone, which could be a real store name (e.g. "Copy Center").
  var NON_MERCHANT = /\b(receipt|invoice)\b|\b(guest\s+check|tax\s+invoice|(customer|merchant)\s+copy|itemized|subtotal)\b/i;
  var ADDRESSY = /\b(street|st\.|ave|avenue|blvd|suite|ste\.?|drive|dr\.|road|rd\.|hwy|highway|\d{5}(-\d{4})?)\b/i;
  var TIMEY = /\b\d{1,2}[:h]\d{2}\b/;

  // Gibberish detector: OCR of a logo/graphic yields strings with no real words,
  // odd vowel ratios, or heavy punctuation. Reject those as merchant candidates.
  function looksLikeGarbage(line) {
    var letters = line.replace(/[^A-Za-z]/g, '');
    if (letters.length < 3) return true;
    var vowels = (letters.match(/[aeiouAEIOU]/g) || []).length;
    var vr = vowels / letters.length;
    if (vr < 0.12 || vr > 0.8) return true;               // consonant soup or vowel soup
    var hasWord = line.split(/[^A-Za-z]+/).some(function (w) {
      return w.length >= 3 && /[aeiou]/i.test(w);          // at least one plausible word
    });
    if (!hasWord) return true;
    var nonStd = (line.match(/[^A-Za-z0-9\s&'.,\-\/]/g) || []).length;
    if (nonStd > Math.max(2, line.length * 0.3)) return true; // too many stray symbols
    return false;
  }

  // The merchant is the FIRST line near the top that reads like a real name —
  // i.e. it survives every "this isn't a name" filter (garbage logo text, a price,
  // a time, a date, an address). First survivor wins; the store name prints above
  // the address/city, so earliest-valid is the right pick.
  function extractMerchant(lines) {
    for (var i = 0; i < Math.min(lines.length, 8); i++) {
      var line = lines[i].trim();
      if (line.length < 3 || line.length > 42) continue;
      if (MERCHANT_SKIP.test(line)) continue;
      if (NON_MERCHANT.test(line)) continue;        // "Sale Receipt", "Tax Invoice", etc.
      if (MONEY.test(line)) continue;               // has a price → not the name
      if (TIMEY.test(line)) continue;               // a time stamp
      if (extractDate(line)) continue;              // a date line
      if (ADDRESSY.test(line) && i > 0) continue;
      if (looksLikeGarbage(line)) continue;
      var letters = (line.match(/[A-Za-z]/g) || []).length;
      var compact = line.replace(/\s/g, '').length;
      if (!compact || letters / compact < 0.55) continue; // mostly non-letters → skip
      return titleCase(line.replace(/[*#=_~|]+/g, ' ').replace(/\s{2,}/g, ' ').trim());
    }
    return null;
  }

  function titleCase(s) {
    if (s === s.toUpperCase()) {
      // Capitalize the first letter of each whitespace-separated word only, so
      // "JOE'S" → "Joe's" (not "Joe'S") and "H&R" → "H&r"→ keep as-is-ish.
      return s.toLowerCase().replace(/(^|\s)([a-z])/g, function (_, pre, c) { return pre + c.toUpperCase(); });
    }
    return s;
  }

  function classify(text, merchant) {
    var haystack = ((merchant || '') + '\n' + text).toLowerCase();
    var best = null;
    CATEGORIES.forEach(function (cat) {
      var score = 0, hits = [];
      cat.keywords.forEach(function (kw) {
        var idx = haystack.indexOf(kw);
        if (idx !== -1) {
          // Keyword in the merchant name is worth more than in the body
          var inMerchant = merchant && merchant.toLowerCase().indexOf(kw) !== -1;
          score += (inMerchant ? 3 : 1) * Math.min(kw.length, 12);
          hits.push(kw.trim());
        }
      });
      if (score > 0 && (!best || score > best.score)) {
        best = { name: cat.name, scheduleC: cat.scheduleC, score: score, hits: hits };
      }
    });
    if (!best) return { name: 'Uncategorized', scheduleC: 'Review manually', score: 0, hits: [], confidence: 'low' };
    best.confidence = best.score >= 24 ? 'high' : best.score >= 10 ? 'medium' : 'low';
    return best;
  }

  // Known store names — used to backfill the merchant when the top of the receipt
  // is a logo/graphic that OCR turned to garbage. Longer/more-specific names first.
  var BRANDS = [
    'Home Depot', "Lowe's", 'Ace Hardware', 'Harbor Freight', 'Tractor Supply',
    'Office Depot', 'OfficeMax', 'Best Buy', 'Circle K', 'Dollar General', 'Dollar Tree',
    'Sam\'s Club', 'Whole Foods', 'Trader Joe', 'Jiffy Lube', 'Pep Boys', 'Napa Auto',
    'H&R Block', 'Best Western', 'Holiday Inn', 'State Farm', 'Liberty Mutual',
    'Uber Eats', 'Chick-fil-A', 'Panera', 'Starbucks', 'McDonald', 'Chipotle', 'Subway',
    'Dunkin', 'Wendy', 'Chevron', 'Shell', 'Exxon', 'Mobil', 'Texaco', 'Sunoco', 'Arco',
    'Marathon', 'Speedway', 'Costco', 'Walmart', 'Target', 'Kroger', 'Safeway', 'Publix',
    'Walgreens', 'CVS', 'Menards', 'Staples', 'FedEx', 'USPS', 'Marriott', 'Hilton',
    'Hyatt', 'Amazon', 'Adobe', 'QuickBooks', 'GoDaddy', 'Verizon', 'AT&T', 'T-Mobile',
    'Comcast', 'Xfinity', 'Spectrum', 'AutoZone', 'Valvoline', 'Firestone', 'Goodyear',
    'Geico', 'Progressive', 'Allstate', 'Lyft', 'Uber', 'Wawa', 'Sheetz', 'Kwik Trip'
  ];

  function brandFromText(text) {
    var lower = text.toLowerCase();
    for (var i = 0; i < BRANDS.length; i++) {
      if (lower.indexOf(BRANDS[i].toLowerCase()) !== -1) return BRANDS[i];
    }
    return null;
  }

  // ---- Line items & tax ----
  var NOT_ITEM = /(sub\s*-?\s*total|subtotal|total|\bfsa\b|tax|\bget\b|\bhst\b|\bgst\b|tip|gratuity|change|cash|visa|master|amex|discover|debit|credit|card|balance|amount|approved|auth|member|account|savings|instant|items?\s+sold|number|payment|tender|refund|due|purchase|transaction|trm|trn|whse|op\s*[#:$]|reg(ister)?\s*#|invoice|receipt)/i;
  var ITEM_LINE = /^(.{2,48}?)\s+\$?([0-9]{1,4}[.,][0-9]{2})\s*(-)?\s*[A-Za-z]{0,2}[*#]?\s*$/;
  var AMOUNT_ONLY = /^\$?([0-9]{1,4}[.,][0-9]{2})\s*(-)?\s*[A-Za-z]{0,2}[*#]?\s*$/;

  function cleanItemDesc(s) {
    return s
      .replace(/^[A-Z]{1,2}[\s.\-:]+/, '')        // leading dept/tax flag ("E ", "F. ")
      .replace(/\b\d{5,}\b/g, ' ')                // long SKU numbers
      .replace(/[*#=_~|]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function extractLineItems(lines) {
    var items = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (NOT_ITEM.test(line)) continue;
      if (/%/.test(line)) continue;                // "4.712% GET/GAR ..." tax lines, even when misread
      var m = line.match(ITEM_LINE);
      var amount = null, descRaw = null;
      if (m && !m[3]) {
        amount = normalizeAmount(m[2]);
        descRaw = m[1];
      } else if (!m) {
        // Price + "You Pay" double columns: "DESC  4.88 4.968" (flag often glued to
        // the 2nd number by OCR). Take the description + FIRST amount.
        var multi = line.match(/^(.{2,48}?)\s+\$?([0-9]{1,4}[.,][0-9]{2})\s+\$?[0-9]{1,4}[.,][0-9]{2,3}\s*[A-Za-z]{0,2}\s*$/);
        if (multi) {
          amount = normalizeAmount(multi[2]);
          descRaw = multi[1];
        } else {
          // Two-column OCR split: a description-only line followed by an amount-only line.
          var next = lines[i + 1] || '';
          var am = next.match(AMOUNT_ONLY);
          if (am && !am[2] && !NOT_ITEM.test(next) &&
              !/[0-9][.,][0-9]{2}/.test(line) && /[A-Za-z]{3}/.test(line) && line.length <= 40) {
            amount = normalizeAmount(am[1]);
            descRaw = line;
            i++;                                   // consume the amount line
          }
        }
      }
      if (amount === null || amount <= 0 || amount > 100000 || descRaw === null) continue;
      var desc = cleanItemDesc(descRaw);
      if (desc.length < 2 || !/[A-Za-z]{2}/.test(desc)) continue;
      items.push({ desc: desc, amount: amount });
    }
    return items;
  }

  // Tax rate: an explicitly printed percentage (e.g. "A 4.712% GET") is the most
  // reliable source — survives even when the tax-name word is misread by OCR.
  // Falls back to taxTotal/subtotal, then tax/(total-tax).
  function extractTaxInfo(lines) {
    var subtotal = null, tax = null, printedRate = null;
    var moneyRe = MONEY;
    for (var p = 0; p < lines.length; p++) {
      var pm = lines[p].match(/(\d{1,2}(?:[.,]\d{1,4})?)\s*%/);
      if (pm) {
        var pr = parseFloat(pm[1].replace(',', '.')) / 100;
        if (pr > 0 && pr < 0.25) { printedRate = pr; break; }   // sane sales-tax range
      }
    }
    // Sales tax is a small fraction of the bill. Anything above a quarter of the
    // grand total is something else that happened to sit near a "TAX" label —
    // an item price, or the taxable base. Without this the largest-wins rule
    // below happily picks the wrong number.
    var grandTotal = extractTotal(lines);
    function plausibleTax(v) {
      if (v === null || v <= 0) return false;
      return grandTotal ? v <= grandTotal * 0.25 : true;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = matchMoney(line);
      var v = m ? normalizeAmount(m[1]) : null;
      var vLine = m ? line : null;
      if (v === null) {
        // OCR often scrambles order — amount may sit on the next OR previous line
        var nm = matchMoney(lines[i + 1] || '');
        if (nm && !NOT_ITEM.test(lines[i + 1] || '')) { v = normalizeAmount(nm[1]); vLine = lines[i + 1]; }
        if (v === null) {
          var pm = matchMoney(lines[i - 1] || '');
          if (pm && !/[a-z]{3}/i.test((lines[i - 1] || '').replace(pm[0], ''))) { v = normalizeAmount(pm[1]); vLine = lines[i - 1]; }
        }
      }
      if (v === null || v < 0) continue;
      if (/sub\s*-?\s*total|subtotal/i.test(line) && subtotal === null) subtotal = v;
      else if (/(total\s*tax|sales\s*tax|\btax\b|\bget\b|\bgst\b|\bhst\b|\bvat\b)/i.test(line) &&
               !/taxable/i.test(line) && !/\bfsa\b/i.test(line)) {   // FSA N/TAX AMT is not sales tax
        var cand = v;
        // "$13.98 @ 6.0%" — the amount is the TAXABLE BASE, not the tax. Bass Pro
        // prints it this way and the tax itself is often OCR-mangled ("$0. 8-"),
        // so compute it instead of trying to read it.
        var atRate = vLine && vLine.match(/@\s*(\d{1,2}(?:[.,]\d{1,4})?)\s*%/);
        if (atRate) {
          var r = parseFloat(atRate[1].replace(',', '.')) / 100;
          if (r > 0 && r < 0.25) cand = Math.round(cand * r * 100) / 100;
        }
        // Column layouts (Safeway) separate the "TAX" label from its value by
        // several header lines, so the adjacent amount is an item price. When
        // the neighbour is implausible, scan ahead for the first amount that
        // could actually be a tax.
        if (!plausibleTax(cand)) {
          for (var k = i + 1; k < Math.min(lines.length, i + 7); k++) {
            var fm = matchMoney(lines[k]);
            if (!fm) continue;
            var fv = normalizeAmount(fm[1]);
            if (plausibleTax(fv)) { cand = fv; break; }
          }
        }
        if (!plausibleTax(cand)) continue;
        if (tax === null || cand > tax) tax = cand;   // "TOTAL TAX" usually prints last/largest
      }
    }
    var rate = printedRate;
    if (rate === null) rate = (subtotal && tax && tax < subtotal * 0.25) ? tax / subtotal : null;
    if (rate === null && tax) {
      // fallback: derive from grand total (rate = tax / (total - tax))
      var grand = extractTotal(lines);
      if (grand && grand > tax * 2 && tax / (grand - tax) < 0.25) rate = tax / (grand - tax);
    }
    return { subtotal: subtotal, tax: tax, rate: rate, printedRate: printedRate };
  }

  // City from the receipt's address block (line with a ZIP code, or "City ST" pattern).
  function extractCity(lines) {
    for (var i = 0; i < Math.min(lines.length, 14); i++) {
      var m = lines[i].match(/^([A-Za-z .'-]{3,24})[,.]?\s+([A-Z]{2})\s+\d{5}/);
      if (m) return (m[1].trim() + ' ' + m[2]).toLowerCase();
      var m2 = lines[i].match(/^([A-Za-z .'-]{3,24})[,.]?\s+([A-Z]{2})\s*$/);
      if (m2 && !MERCHANT_SKIP.test(lines[i])) return (m2[1].trim() + ' ' + m2[2]).toLowerCase();
    }
    return null;
  }

  // Dice coefficient on character bigrams — tolerant of OCR noise
  // ("keahole street" vs "keahnle strogt" still score well above random).
  function diceSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    var map = {}, inter = 0;
    for (var i = 0; i < a.length - 1; i++) { var bg = a.substr(i, 2); map[bg] = (map[bg] || 0) + 1; }
    for (var j = 0; j < b.length - 1; j++) { var bg2 = b.substr(j, 2); if (map[bg2] > 0) { map[bg2]--; inter++; } }
    return (2 * inter) / (a.length - 1 + b.length - 1);
  }

  // ---- TXF (Tax Exchange Format v042) Schedule C expense codes ----
  // Verified against the TXF v042 specification (taxdataexchange.org).
  var TXF_CODES = {
    'Advertising & Marketing': 304,
    'Car & Truck / Fuel': 306,
    'Commissions & Fees': 307,
    'Contract Labor': 685,
    'Insurance': 310,
    'Interest Paid': 312,
    'Professional Services': 298,
    'Office Supplies': 313,
    'Rent & Lease': 300,
    'Repairs & Maintenance': 315,
    'Supplies & Materials': 301,
    'Taxes & Licenses': 316,
    'Travel & Lodging': 317,
    'Meals & Entertainment': 294,
    'Utilities & Phone': 318,
    'Wages & Payroll': 297,
    // The rest of the business categories flow to "Other business expense"
    'Software & Subscriptions': 302,
    'Shipping & Postage': 302,
    'Bank & Merchant Fees': 302,
    'Education & Training': 302,
    'Dues & Memberships': 302,
    'Employee Benefits': 302,
    'General Merchandise': 302,
    'Home Office': null,             // Form 8829 — not a plain Sch C expense code
    'Depreciation / Equipment': null, // Form 4562 — needs asset entry, not a TXF expense
    'Inventory / COGS': null          // Part III COGS — excluded from expense TXF
  };

  // Which IRS form each category's amounts belong on — the organizing principle
  // for exports (CPAs and DIY software both work form-by-form).
  var FORM_OF_SPECIAL = {
    'Inventory / COGS': 'Schedule C Part III (COGS)',
    'Home Office': 'Form 8829 (Home Office)',
    'Depreciation / Equipment': 'Form 4562 (Depreciation)',
    'Charitable Donation': 'Schedule A (Itemized)',
    'Personal (non-deductible)': 'None (personal)',
    'Uncategorized': 'Review needed'
  };
  function taxFormOf(cat) {
    if (FORM_OF_SPECIAL[cat] !== undefined) return FORM_OF_SPECIAL[cat];
    return 'Schedule C';
  }
  // Sort key: Schedule C first (by line number), then other forms, then personal
  function formSortKey(cat, scheduleC) {
    var form = taxFormOf(cat);
    if (form === 'Schedule C') {
      var m = (scheduleC || '').match(/Line\s+(\d+)/i);
      return [0, m ? +m[1] : 99];
    }
    if (form.indexOf('Part III') !== -1) return [1, 0];
    if (form.indexOf('8829') !== -1) return [2, 0];
    if (form.indexOf('4562') !== -1) return [3, 0];
    if (form.indexOf('Schedule A') !== -1) return [4, 0];
    if (form.indexOf('Review') !== -1) return [5, 0];
    return [6, 0];
  }

  function parseReceipt(rawText) {
    var text = (rawText || '').replace(/\r/g, '');
    var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var merchant = extractMerchant(lines);
    if (!merchant) merchant = brandFromText(text);   // fallback: recognized brand anywhere
    var total = applyTip(lines, extractTotal(lines));
    var date = extractDate(text);
    var category = classify(text, merchant);
    var items = extractLineItems(lines);
    var taxInfo = extractTaxInfo(lines);
    return {
      items: items,
      taxRate: taxInfo.rate,
      taxRatePrinted: taxInfo.printedRate,
      taxTotal: taxInfo.tax,
      subtotal: taxInfo.subtotal,
      city: extractCity(lines),
      merchant: merchant,
      total: total,
      date: date,
      category: category.name,
      scheduleC: category.scheduleC,
      confidence: category.confidence,
      matchedKeywords: category.hits
    };
  }

  return {
    parseReceipt: parseReceipt,
    classify: classify,
    extractTotal: extractTotal,
    extractDate: extractDate,
    extractMerchant: extractMerchant,
    extractLineItems: extractLineItems,
    extractTaxInfo: extractTaxInfo,
    extractCity: extractCity,
    diceSimilarity: diceSimilarity,
    taxFormOf: taxFormOf,
    formSortKey: formSortKey,
    TXF_CODES: TXF_CODES,
    CATEGORIES: CATEGORIES.map(function (c) { return { name: c.name, scheduleC: c.scheduleC, group: c.group || 'Other' }; })
      .concat([{ name: 'Uncategorized', scheduleC: 'Review manually', group: 'Not Schedule C' }]),
    GROUP_ORDER: ['Everyday Operations', 'Vehicle & Travel', 'Facilities', 'People & Services',
      'Financial & Admin', 'Goods & Inventory', 'Not Schedule C']
  };
}));

