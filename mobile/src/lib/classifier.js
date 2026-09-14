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
      // Renamed from "Meals & Entertainment" (D-050). Entertainment has been
      // nondeductible since the TCJA, and the Schedule C instructions say so
      // twice — "Do not include entertainment expenses on this line" — so the
      // old name invited filing an entertainment receipt into a 50%-deductible
      // bucket. Old data is migrated; see CATEGORY_ALIASES below.
      name: 'Business Meals', group: 'Everyday Operations',
      scheduleC: 'Line 24b — Deductible meals (50%)',
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
      scheduleC: 'Line 27b — Other expenses (software)',
      keywords: ['adobe', 'microsoft 365', 'office 365', 'quickbooks', 'intuit', 'dropbox',
        'google workspace', 'gsuite', 'zoom.us', 'zoom video', 'slack', 'github', 'godaddy',
        'namecheap', 'squarespace', 'wix', 'shopify', 'canva', 'subscription', 'saas',
        'software license', 'app store', 'aws', 'amazon web services', 'openai', 'anthropic']
    },
    {
      name: 'Shipping & Postage', group: 'Everyday Operations',
      scheduleC: 'Line 18 — Office expense (postage)',
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
      scheduleC: 'Line 20b — Rent/lease, other business property',
      keywords: ['rent due', 'monthly rent', 'lease payment', 'storage unit', 'self storage',
        'public storage', 'coworking', 'wework', 'regus', 'office rent', 'booth rent']
    },
    {
      // Line 20a was the one Schedule C expense line with no category at all,
      // and unlike the other four gaps (depletion, mortgage interest, pension
      // plans, Form 7205) it is receipt-shaped: renting a trencher or a lift
      // produces a receipt you photograph. The instructions draw the line
      // cleanly — 20a is "vehicles, machinery, or equipment", 20b is "other
      // property, such as office space in a building" — so this sits beside
      // Rent & Lease rather than replacing any of it.
      //
      // Deliberately NOT claiming rental cars: a car rented while away from
      // home on business is a travel expense (24a), and those merchants stay
      // in Travel & Lodging.
      //
      // MOVING TRUCKS DO belong here (D-068). The line the IRS draws is not
      // "car vs truck", it is what the rental is FOR: 24a covers travel away
      // from home overnight, while 20a is the plain case of the line's own
      // wording — "If you rented or leased vehicles, machinery, or equipment,
      // enter on line 20a the business portion of your rental cost." A U-Haul
      // hired to move inventory across town is not an overnight trip; it is a
      // vehicle rented to do a job. Hertz stays on 24a and U-Haul goes to 20a
      // for the same reason, not opposite ones.
      //
      // EVERY truck brand here is scoped to its rental arm, and each one has a
      // sibling business that would otherwise be misfiled:
      //
      //   budget truck  — Travel & Lodging owns "budget rent" (Budget Rent A Car)
      //   penske truck  — Penske Automotive Group is a large dealer chain, so a
      //                   bare "penske" would file an oil change on 20a
      //   ryder truck   — Ryder also sells fleet management and logistics
      //   u-haul truck / u-haul moving — U-Haul is one of the biggest US
      //                   SELF-STORAGE operators, and storage is line 20b
      //                   (Rent & Lease), not 20a. A bare "u-haul" outranks the
      //                   storage keywords on the 3x merchant weight and moves a
      //                   recurring storage bill to the wrong Schedule C line.
      //
      // The cost of scoping is that a receipt whose OCR yields only "U-HAUL"
      // lands Uncategorized. That is the right trade: the app asks, rather than
      // filing a storage unit as equipment rental and saying nothing.
      name: 'Equipment Rental', group: 'Facilities',
      scheduleC: 'Line 20a — Rent/lease: vehicles, machinery, equipment',
      keywords: ['equipment rental', 'tool rental', 'rental yard', 'sunbelt rentals',
        'united rentals', 'herc rentals', 'equipment lease', 'machinery rental',
        'scissor lift', 'boom lift', 'skid steer', 'excavator rental',
        'generator rental', 'rented equipment', 'rental return', 'day rate rental',
        'u-haul truck', 'uhaul truck', 'u-haul moving', 'uhaul moving',
        'penske truck', 'ryder truck', 'budget truck',
        'moving truck', 'box truck', 'cargo van rental']
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
      scheduleC: 'Line 27b — Other expenses (bank/merchant fees)',
      keywords: ['bank fee', 'service charge', 'overdraft', 'wire fee', 'merchant fee', 'processing fee',
        'stripe fee', 'square fee', 'paypal fee', 'monthly maintenance fee', 'atm fee']
    },
    {
      name: 'Interest Paid', group: 'Financial & Admin',
      scheduleC: 'Line 16b — Interest, other (16a is mortgage)',
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
      scheduleC: 'Line 27b — Other expenses (education)',
      keywords: ['udemy', 'coursera', 'linkedin learning', 'training', 'seminar', 'workshop', 'conference',
        'tuition', 'certification', 'course fee', 'webinar']
    },
    {
      name: 'Dues & Memberships', group: 'Financial & Admin',
      scheduleC: 'Line 27b — Other expenses (dues)',
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

  // Vision drops a space where the decimal point should be: costco-1.txt has
  // "POWER VEG      1. 49 A" and "AMOUNT: $140. 35". MONEY does not match
  // across that space, so such a line contributed NO amount at all — on the
  // synthetic corpus the total was recovered on only 12.6% of receipts with
  // this artifact.
  //
  // Tried ONLY when the strict pass finds nothing on the line, so no existing
  // match can change meaning. The separator class deliberately drops "," here:
  // "Suite 200, 50 Main St" would otherwise read as $200.50, and a comma is
  // followed by a space in ordinary text constantly. A period is not.
  var MONEY_SPACED = /\$?\s*((?:[0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]+)[.{}\[\]|] [0-9]{2})(?!\d)/;
  var MONEY_SPACED_G = new RegExp(MONEY_SPACED.source, 'g');

  // Every non-rate amount on the line, left to right. Callers that want just
  // one take the first; extractTotal's fallback needs them all, because a
  // two-column line prints two prices and the larger is the one that counts.
  function scanMoney(line) {
    if (!line) return [];
    var out = [];
    var re, m;
    for (var pass = 0; pass < 2; pass++) {
      re = pass === 0 ? MONEY_G : MONEY_SPACED_G;
      re.lastIndex = 0;
      while ((m = re.exec(line)) !== null) {
        if (!/^\s*%/.test(line.slice(m.index + m[0].length))) out.push(m);
      }
      if (out.length) break;
    }
    return out;
  }

  function matchMoney(line) {
    var all = scanMoney(line);
    return all.length ? all[0] : null;
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

  /*
   * Refunds print the amount with a TRAILING minus: "130.87-", sometimes with a
   * tender letter after it ("124.99-P"). US retail has done this for decades.
   *
   * Every amount on such a receipt is marked that way, so the credit filter
   * below rejected all of them and the total came back null. Tyler stored two
   * AutoZone returns as zero because the app would not take a negative, which
   * quietly dropped $172.75 of returned money out of his books (D-088).
   */
  function isCredit(line, m) {
    if (!m) return false;
    var after = line.slice(m.index + m[0].length, m.index + m[0].length + 2);
    return /^-/.test(after);
  }

  /*
   * A "Total" inside a savings or rewards block is not the grand total.
   *
   * Safeway prints, near the footer:
   *     YOUR SAVINGS
   *     Member Savings
   *     Total
   *     0.50
   *     0.50
   * A bare "total" is the STRONGEST hint tier there is, and candidates sort by
   * tier before value, so $0.50 of coupon savings outranked the $48.42 actually
   * charged on the line labelled PAYMENT AMOUNT. NOT_TOTAL already lists
   * "savings", but it is tested against the label line alone and the word sits
   * on the line ABOVE (D-093).
   *
   * Two things deliberately narrow it, and a probe caught the need for the
   * second one.
   *
   * Only the IMMEDIATELY preceding line, so the ordinary layout where savings
   * sit two rows above the real total is untouched:
   *     SUBTOTAL      50.00
   *     YOUR SAVINGS   5.00
   *     TAX            2.00
   *     TOTAL         47.00
   *
   * And only when the label carries NO amount of its own. That is what makes it
   * a column-layout label, whose value is on a later line. Without this second
   * gate a perfectly ordinary receipt lost its total outright:
   *     MEMBER SAVINGS  5.00
   *     TOTAL          47.00
   * read 50.00, because the veto threw the real total away and the fallback
   * found the subtotal. An inline "TOTAL 47.00" states its own amount and is
   * never the savings figure printed above it.
   */
  function savingsLabelAbove(lines, i, hasOwnAmount) {
    if (hasOwnAmount) return false;
    return i > 0 && /\bsavings\b/i.test(lines[i - 1] || '');
  }

  function extractTotal(lines) {
    var candidates = [];
    var credits = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = matchMoney(line);
      for (var h = 0; h < TOTAL_HINTS.length; h++) {
        if (TOTAL_HINTS[h].test(line) && !NOT_TOTAL.test(line) && !savingsLabelAbove(lines, i, !!m)) {
          // amount may be on this line or the next
          var amtLine = m ? line : (lines[i + 1] || '');
          var m2 = matchMoney(amtLine);
          // Credits and discounts print as "6.30-" or "6.30-A". On an ordinary
          // receipt those are savings lines and must never win. On a refund
          // they are the only amounts there are, so they are kept aside rather
          // than discarded.
          var credit = isCredit(amtLine, m2);
          if (m2) {
            var v = normalizeAmount(m2[1]);
            if (v !== null && v > 0 && v < 1000000) {
              (credit ? credits : candidates).push({ value: v, priority: h, index: i });
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
    var creditMax = null;
    lines.forEach(function (line) {
      scanMoney(line).forEach(function (m) {
        var v = normalizeAmount(m[1]);
        if (v === null || v <= 0 || v >= 1000000) return;
        if (isCredit(line, m)) {
          if (creditMax === null || v > creditMax) creditMax = v;
          return;
        }
        if (max === null || v > max) max = v;
      });
    });
    /*
     * A credit found under a TOTAL-ish label outranks any unlabelled positive.
     *
     * This used to sit below the max scan, so one stray positive figure on a
     * refund slip — a rewards balance, a restocking fee, a line item whose
     * trailing minus OCR dropped — booked $1.05 instead of a $130 credit. That
     * is the same money loss D-088 exists to stop, reintroduced one line lower
     * down. A labelled answer beats an unlabelled one regardless of sign.
     */
    if (credits.length) {
      credits.sort(function (a, b) { return a.priority - b.priority || b.value - a.value; });
      return -credits[0].value;
    }
    if (max !== null) return max;

    /*
     * Nothing labelled and nothing positive: credits everywhere. Largest
     * magnitude wins, the same rule the positive path uses, because the grand
     * total is the biggest figure on the slip.
     */
    return creditMax === null ? null : -creditMax;
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

  /*
   * A date is not a date when it is part of a longer run of digits.
   *
   * Ross prints "Tender Detail #:1-01-5-09-001360", and the MM-DD-YY pattern
   * found "1-01-5" inside it and dated the receipt 2009-01-05. The actual line
   * reads "Date: 07/25/26" (D-089). Reference numbers on receipts are full of
   * hyphenated digit groups, so a match has to be bounded by something that is
   * not another digit or separator.
   */
  function embeddedInDigits(text, m) {
    var before = text.slice(Math.max(0, m.index - 2), m.index);
    var after = text.slice(m.index + m[0].length, m.index + m[0].length + 2);
    return /[\d][\/\-.]$/.test(before) || /^[\/\-.][\d]/.test(after);
  }

  function extractDate(text) {
    var m, y, mo, d;
    /*
     * "8SEP2026", "9AUG2026" — the compact form Safeway and Food Lion print in
     * their footer, and often the only unambiguous date on the slip. Read first
     * because the numeric forms below cannot tell 08/09 from 09/08.
     *
     * Two things this must not do, both found in review:
     *
     *  - `[a-z]*` after the month let an ordinary word be swallowed. "REG 5
     *    JUNIOR 2026" parsed as 5 June 2026 and dated the whole receipt. The
     *    month abbreviation now has to end where it ends.
     *  - Reading it FIRST made it beat the receipt's own transaction date, so
     *    "RETURN POLICY EXPIRES ON 15NOV2026" and "Coupon valid thru 30SEP2026"
     *    won. Home Depot prints a policy-expiry block on every slip. A date
     *    introduced by expiry wording is a deadline, not a purchase.
     */
    var EXPIRY_CONTEXT = /(expir|valid|thru|through|policy|coupon|redeem|good\s+(until|thru)|by\s*$)/i;
    var compact = /\b(0?[1-9]|[12][0-9]|3[01])\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?![a-z])\.?\s*(20[0-9]{2})\b/gi;
    compact.lastIndex = 0;
    while ((m = compact.exec(text)) !== null) {
      if (EXPIRY_CONTEXT.test(text.slice(Math.max(0, m.index - 44), m.index))) continue;
      return isoDate(+m[3], MONTHS[m[2].toLowerCase().slice(0, 3)], +m[1]);
    }
    // MM/DD/YYYY or MM-DD-YY etc.
    var re = /\b(0?[1-9]|1[0-2])[\/\-.](0?[1-9]|[12][0-9]|3[01])[\/\-.](20[0-9]{2}|[0-9]{2})\b/g;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      if (embeddedInDigits(text, m)) continue;
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
  /*
   * Bare "dr", "rd", "ln", "parkway" were added here and taken straight back
   * out: they threw away Lane Bryant, Parkway Grill and anything else whose
   * name contains a road word. STREET_NUMBER below already covers the case
   * that prompted it ("515 PEPEEKEO DR"), without the collateral damage.
   */
  var ADDRESSY = /\b(street|st\.|ave|avenue|blvd|suite|ste\.?|drive|dr\.|road|rd\.|hwy|highway|\d{5}(-\d{4})?)\b/i;
  /*
   * A street number then words is an address, whatever it abbreviates.
   *
   * "515 PEPEEKEO DR" was picked as the merchant once header scoring started
   * preferring longer names: ADDRESSY wanted "Dr." with the period and OCR does
   * not always keep it (D-089). Only applied below the first line, so a store
   * genuinely named after a number ("99 Ranch Market") keeps its name.
   */
  var STREET_NUMBER = /^\d{2,6}[A-Za-z]?\s+[A-Za-z]/;
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
  /*
   * Accolades printed above the store name.
   *
   * A Hele gas station leads with three of them, and the first line of the
   * receipt was filed as the merchant: "Star-advertiser Hawaii's Best 2020"
   * (D-089). Hawaii prints these constantly and they are always ABOVE the name,
   * so taking the first plausible line is exactly wrong here.
   */
  // `best\s+\d{4}` rather than a (19|20) year: OCR read "HAWAII'S BEST 2020" as
  // "HAWAII'S BEST 2920", so the year gate let a newspaper award banner through
  // and it beat the actual store name (D-093). Four digits straight after the
  // word "best" is an award year however badly it scanned. It cannot catch a
  // real name: "Best Buy 1234" puts a word between them, and no US retailer is
  // called "Best" followed by a bare number.
  var ACCOLADE = /(best\s+of\b|\bbest\s+\d{4}\b|\bvoted\b|\bwinner\b|^#\s*1\b|\btop\s+\d+\b|\b(award|magazine)\w*\b[^\n]*\b(19|20)\d{2}\b)/i;

  /*
   * The header, scored rather than taken first-come.
   *
   * Returning the first plausible line is right on most receipts and wrong on
   * every receipt that prints something above the name: an award banner, a
   * slogan, or in one case Tyler's own handwriting ("House" on a City Mill
   * receipt). It also loses to OCR damage, taking "FOOD," over the "Food Lion
   * #2507" on the line below.
   *
   * So every viable line in the header becomes a candidate and the best one
   * wins. The signals are ordinary but they discriminate:
   *
   *  - a name the receipt prints TWICE is the store. Real merchants appear in
   *    the header and again in the footer address block; handwriting and
   *    banners appear once. This is what rescues City Mill.
   *  - a known brand beats an unknown string.
   *  - more words beats fewer, so "Food Lion #2507" beats "FOOD,".
   *  - a dangling comma is OCR damage, not a name.
   *
   * Ties go to the earlier line, which keeps the old behaviour wherever the
   * scores do not separate.
   */
  function extractMerchant(lines) {
    var whole = lines.join('\n').toLowerCase();
    /*
     * The city is not the merchant.
     *
     * Header scoring rewards a name the receipt prints twice, and a city is
     * printed twice on almost every receipt: once under the store name and
     * again in the footer address. On a Hele gas station that beat the actual
     * name, which is one short word (D-089). `extractCity` already knows how to
     * find it, so this only has to refuse it.
     */
    var cityWords = {};
    var city = extractCity(lines);
    if (city) {
      city.replace(/\s+[a-z]{2}$/, '').split(/\s+/).forEach(function (w) {
        if (w.length >= 3) cityWords[w] = true;
      });
    }
    var best = null;
    for (var i = 0; i < Math.min(lines.length, 8); i++) {
      var line = lines[i].trim();
      if (line.length < 3 || line.length > 42) continue;
      if (MERCHANT_SKIP.test(line)) continue;
      if (NON_MERCHANT.test(line)) continue;        // "Sale Receipt", "Tax Invoice", etc.
      if (ACCOLADE.test(line)) continue;
      if (MONEY.test(line)) continue;               // has a price → not the name
      if (TIMEY.test(line)) continue;               // a time stamp
      if (extractDate(line)) continue;              // a date line
      var cleaned = titleCase(
        line.replace(/[*#=_~|•]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
      );
      // "Food Lion #2507", "AutoZone 06390": the store number is not the name.
      // Only stripped when something is left, so a merchant whose whole name is
      // a number keeps it.
      //
      // Stripped BEFORE the letter-ratio test below, not after. "HELE 61176" is
      // four letters in nine characters, which that test rejects as mostly
      // digits, so the one line carrying the store's name was never even a
      // candidate and the accolade above it won by default (D-089).
      cleaned = cleaned.replace(/\s+#?\d{2,6}$/, '') || cleaned;

      /*
       * The address and garbage tests run on the CLEANED name, after the store
       * number is gone.
       *
       * ADDRESSY treats any five-digit run as a ZIP code, and "HELE 61176" ends
       * in one, so the gas station's own name was classified as an address and
       * the accolade above it won by default. Tested against "Hele" it passes,
       * and "515 Pepeekeo Dr" still fails as it should (D-089).
       */
      if ((ADDRESSY.test(cleaned) || STREET_NUMBER.test(cleaned)) && i > 0) continue;
      /*
       * On the RAW line, not the cleaned one. `looksLikeGarbage` counts
       * punctuation, and cleaning strips exactly the punctuation it counts:
       * "*** WELCOME TO ***" passes as "Welcome To" and was beating "KONA HUT"
       * on the line below. Only the ADDRESSY test above needed the cleaned
       * form, for the five-digit store number.
       */
      if (looksLikeGarbage(line)) continue;

      var letters = (cleaned.match(/[A-Za-z]/g) || []).length;
      var compact = cleaned.replace(/\s/g, '').length;
      if (!compact || letters / compact < 0.55) continue; // mostly non-letters → skip
      if (!cleaned || cleaned.length < 3) continue;
      if (cityWords[cleaned.toLowerCase()]) continue;
      /*
       * An address block broken across lines. Hele prints
       *
       *     HONOLULU
       *     , HI
       *     96825
       *
       * so `extractCity`, which wants "City, ST 12345" on one line, finds
       * nothing and "Honolulu" scored above the store's own name. A bare state
       * abbreviation or a ZIP on the next line or two says what this line is.
       */
      var addressNext = false;
      for (var n = 1; n <= 2 && i + n < lines.length; n++) {
        var nx = lines[i + n];
        if (/^[,.\s]*[A-Z]{2}\s*$/.test(nx) || /^\s*\d{5}(-\d{4})?\s*$/.test(nx)) addressNext = true;
      }
      if (addressNext && i > 0) continue;

      var score = 0;
      var words = cleaned.split(/\s+/).filter(Boolean);
      /*
       * One point for having more than one word, not one per word.
       *
       * Scoring per word let a slogan beat the store: "ISLAND TIRE / QUALITY
       * SERVICE SINCE 1985" named the merchant "Quality Service Since", and
       * "MAHALO CAFE / HAVE A NICE DAY" named it "Have A Nice Day". Local one-
       * and two-word merchants are exactly the long tail this scorer is for.
       * Now it only separates "Food Lion #2507" from "FOOD,", which is all it
       * was ever needed for, and everything else falls to the earlier-line
       * tie-break the old code used.
       */
      if (words.length > 1) score += 1;
      if (/[,;:]$/.test(line.trim())) score -= 2;
      for (var b = 0; b < BRANDS.length; b++) {
        if (cleaned.toLowerCase().indexOf(BRANDS[b].toLowerCase()) !== -1) { score += 3; break; }
      }
      // Printed more than once? Count the two longest words together, so a
      // footer reading "City Mill - Hawaii Kai" still counts for "CITY MILL".
      var key = words.filter(function (w) { return w.length >= 4; })
        .slice(0, 2).join(' ').toLowerCase();
      if (key.length >= 4) {
        var seen = whole.split(key).length - 1;
        if (seen > 1) score += 2;
      }
      if (!best || score > best.score) best = { name: cleaned, score: score };
    }
    return best ? best.name : null;
  }

  function titleCase(s) {
    if (s === s.toUpperCase()) {
      // Capitalize the first letter of each whitespace-separated word only, so
      // "JOE'S" → "Joe's" (not "Joe'S") and "H&R" → "H&r"→ keep as-is-ish.
      return s.toLowerCase().replace(/(^|\s)([a-z])/g, function (_, pre, c) { return pre + c.toUpperCase(); });
    }
    return s;
  }

  // Where the receipt stops describing the purchase and starts advertising.
  //
  // A real Bass Pro receipt for fishing bait ends with a coupon: "Bring your
  // Bass Pro Shops receipt ... to our Islamorada Fish Company RESTAURANT and
  // receive $5 off your food purchase". The word "restaurant" scored, and a
  // bait receipt was filed as a 50%-deductible business meal.
  //
  // Only searched in the BACK HALF of the receipt, because these phrases also
  // appear legitimately near the top — a real Cabelas receipt has "NOW HIRING"
  // on line 3, and cutting there would discard the entire purchase.
  var PROMO_MARKER = /(facebook\.com|twitter\.com|youtube\.com|instagram\.com|no purchase necessary|take our survey|tell us how we did|how was your visit|keep in touch|join the club|bring your|see website for rules|chance to win|scan the qr|sign up for|now hiring|save on gear|thank you for shopping|customer service 1-|survey)/i;

  function promoBoundary(lines) {
    for (var i = Math.floor(lines.length / 2); i < lines.length; i++) {
      if (PROMO_MARKER.test(lines[i])) return i;
    }
    return lines.length;
  }

  function classify(text, merchant) {
    var allLines = String(text || '').split('\n');
    var cut = promoBoundary(allLines);
    // The body is what the shop sold you; the tail is marketing. A keyword that
    // appears ONLY in the tail still counts, at a quarter weight, so a genuine
    // signal is not thrown away — it just cannot outvote the actual purchase.
    var body = ((merchant || '') + '\n' + allLines.slice(0, cut).join('\n')).toLowerCase();
    var tail = allLines.slice(cut).join('\n').toLowerCase();
    var haystack = ((merchant || '') + '\n' + text).toLowerCase();
    var best = null;
    CATEGORIES.forEach(function (cat) {
      var score = 0, hits = [];
      var bodyScore = 0;
      cat.keywords.forEach(function (kw) {
        var inBody = body.indexOf(kw) !== -1;
        var inTail = !inBody && tail.indexOf(kw) !== -1;
        if (inBody || inTail) {
          // Keyword in the merchant name is worth more than in the body
          var inMerchant = merchant && merchant.toLowerCase().indexOf(kw) !== -1;
          var weight = inMerchant ? 3 : (inBody ? 1 : 0.25);
          var points = weight * Math.min(kw.length, 12);
          score += points;
          if (inBody) bodyScore += points;
          hits.push(kw.trim());
        }
      });
      // Marketing copy is not evidence of what was bought. A category whose
      // entire case rests on the promotional footer does not qualify at all —
      // otherwise a coupon for a restaurant files a bait receipt as a meal.
      // Tail hits still break ties between categories that DID earn body
      // points; they just cannot win on their own.
      if (bodyScore <= 0) score = 0;
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

  // Some receipts never print the store's name at all. A real Home Depot
  // receipt opens "How doers get more done." — the merchant parsed as
  // "How doers" and nothing matched, so it landed Uncategorized.
  var SLOGANS = [
    ['how doers get more done', 'Home Depot'],
    ['save money. live better', 'Walmart'],
    ['expect more. pay less', 'Target'],
  ];

  /**
   * A slogan names the shop even when the shop's name is nowhere on the paper.
   *
   * Matched against whitespace-flattened text, because OCR wraps: the real
   * receipt reads "How doers" / "get more done." on two separate lines.
   *
   * Unlike brandFromText this OVERRIDES an extracted merchant rather than
   * merely filling in for a missing one — "How doers" is not a shop. It is
   * kept separate from the BRANDS list on purpose: brand names get mentioned
   * incidentally (one receipt in the corpus has an entire second receipt
   * appended to it), whereas a slogan at the top is the shop identifying
   * itself.
   */
  function sloganBrand(text) {
    var flat = String(text || '').toLowerCase().replace(/\s+/g, ' ');
    for (var g = 0; g < SLOGANS.length; g++) {
      if (flat.indexOf(SLOGANS[g][0]) !== -1) return SLOGANS[g][1];
    }
    return null;
  }

  /*
   * Unambiguous brand markers — a domain or a proprietary programme name that
   * only one retailer prints.
   *
   * Real receipts routinely fail to yield a usable merchant from their header.
   * From the corpus: Cabela's parsed as "All Ammo And Firearm Sales Are Final",
   * Target as "Glen Allen Broad St - 804-360-8900", Bass Pro as just "Bass".
   * All three print their own domain, which is not ambiguous the way a header
   * line is.
   *
   * Two rules make this safe:
   *
   * 1. **The EARLIEST match wins.** A shop identifies itself before anything
   *    else on the paper. This matters concretely: the Target receipt in the
   *    corpus has a whole second receipt appended, so "cabelas. com/careers"
   *    appears at line 43 — well after "target circle" at line 27. Taking the
   *    first match gives Target; taking any match could give Cabela's.
   * 2. **Dots are matched through OCR spacing.** The Cabela's receipt reads
   *    "CABELAS. COM/CAREERS", with a space after the dot.
   *
   * These override an extracted merchant, like SLOGANS and unlike BRANDS: a
   * header line that reads like a disclaimer or a street address is not a
   * merchant name, and the domain is better evidence than either.
   */
  var BRAND_MARKERS = [
    ['basspro.com', 'Bass Pro Shops'],
    ['cabelas.com', "Cabela's"],
    ['target.com', 'Target'],
    ['target circle', 'Target'],
    ['costco.com', 'Costco'],
    ['safeway.com', 'Safeway'],
    ['homedepot.com', 'Home Depot'],
    ['lowes.com', "Lowe's"],
    ['walmart.com', 'Walmart'],
    ['staples.com', 'Staples'],
    ['officedepot.com', 'Office Depot'],
    ['bestbuy.com', 'Best Buy'],
    ['autozone.com', 'AutoZone'],
    ['acehardware.com', 'Ace Hardware'],
  ];

  /** Whitespace flattened, and spacing around dots closed up, so a domain
   *  survives however OCR broke it across the line. */
  function flattenForMarkers(text) {
    return String(text || '').toLowerCase()
      .replace(/\s*\.\s*/g, '.')
      .replace(/\s+/g, ' ');
  }

  function markerBrand(text) {
    var flat = flattenForMarkers(text);
    var bestAt = -1;
    var best = null;
    for (var i = 0; i < BRAND_MARKERS.length; i++) {
      var at = flat.indexOf(BRAND_MARKERS[i][0]);
      if (at === -1) continue;
      if (bestAt === -1 || at < bestAt) { bestAt = at; best = BRAND_MARKERS[i][1]; }
    }
    return best;
  }

  /*
   * Structural fingerprints — the receipt's own vocabulary, for when the shop's
   * name is not on the paper at all.
   *
   * Costco warehouse receipts print the location ("Hawaii Kai #120"), never the
   * word Costco, so there is no name for OCR to recover and no domain to fall
   * back on. Both corpus dumps parsed to garbage: "Bw Yai Grup" and
   * "Howat Kai 1". What those receipts do print is a set of terms no other
   * chain prints together.
   *
   * TWO markers are required, and the corpus is why: Safeway also prints
   * "TOTAL NUMBER OF ITEMS SOLD", so a single hit would have renamed every
   * Safeway receipt Costco. Two independent hits is the difference between a
   * fingerprint and a coincidence.
   *
   * This ranks BELOW a slogan or a domain — those are the shop naming itself —
   * and ABOVE extractMerchant, whose best guess here is a street address.
   */
  var FINGERPRINTS = [
    {
      brand: 'Costco',
      minHits: 2,
      markers: [
        /\bwhse\s*[:#]/i,                             // "whse:120 Trm:205 Trn:201 OP:705"
        /\btrm\s*[:#]\s*\d/i,
        /total\s+num\S*(\s+of)?\s+items\s+sold/i,     // OCR gives "TOTAL NUMP  ITEMS SOLD"
        /^\s*instant\s+s/im,                          // "INSTANT SAVINGS", OCR'd "INSTANT Sf a"
        // Added after a Costco receipt was filed as "Mitco" (D-089). It scored
        // one marker: "Trm:" had been read as "in:"/"rn:", and "TOTAL NUMBER OF
        // ITEMS SOLD" as "TOTAL NUMBER CF TEMS SOLD", so both of the markers
        // written to survive OCR damage were damaged past them. These two
        // survive it because neither depends on a word being spelled right.
        /\bmember\s*#?\s*\d{9,}/i,                     // 12-digit membership number
        /^\s*\*{2,}\s*total/im,                        // Costco prints "**** TOTAL"
      ],
    },
  ];

  function fingerprintBrand(text) {
    var s = String(text || '');
    for (var i = 0; i < FINGERPRINTS.length; i++) {
      var fp = FINGERPRINTS[i];
      var hits = 0;
      for (var j = 0; j < fp.markers.length; j++) {
        if (fp.markers[j].test(s)) hits++;
      }
      if (hits >= fp.minHits) return fp.brand;
    }
    return null;
  }

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

  /*
   * The totals block when OCR splits it into a column of labels and a column
   * of values.
   *
   * This is the single biggest defect the real corpus has ever shown: sales tax
   * was wrong or missing on 12 of 18 receipts from one scanning session
   * (D-087). Apple Vision reads a two-column layout by emitting every label
   * first and every value after, so Safeway arrives as
   *
   *     TAX                      Subtotal            SUBTOTAL
   *     **** BALANCE             Tax                 TAX
   *     You Pay                  Total               **** TOTAL
   *     4.99 B                   34.05               164.61
   *     3.49 B                   1.61                7.76
   *     0.40    <- the tax       $35.66
   *     8.88                     $35.66
   *
   * The old code looked for a label and a number near each other, then scanned
   * ahead for the "first plausible" amount when that failed, which lands on an
   * item price. Looking further ahead does not help; the amounts are all
   * plausible. What is needed is to know WHICH one.
   *
   * The alignment is positional, and the arithmetic proves it: in a block of
   * `subtotal, tax, total` labels, exactly one window of consecutive values
   * satisfies `subtotal + tax = total`. That is not a heuristic that usually
   * works, it is a check the right answer passes and the wrong ones do not, so
   * this returns null rather than a guess when nothing adds up.
   *
   * Returns { subtotal, tax, total } or null.
   */
  /** The block's total, but only when the arithmetic proved it. Strategy 2
   *  anchors ON the grand total, so handing that back would be circular. */
  function sub2total(col) {
    return col.subtotal != null ? col.total : null;
  }

  function columnTotals(lines, grandTotal) {
    function valueOf(line) {
      var m = matchMoney(line);
      if (!m) return null;
      var rest = line.replace(m[0], '').replace(/[^A-Za-z]/g, '');
      return rest.length > 6 ? null : normalizeAmount(m[1]);
    }
    function isLabel(line) {
      return valueOf(line) === null && /[A-Za-z]{3}/.test(line);
    }
    var SUB = /sub\s*-?\s*total/i;
    var TAX = /(total\s*tax|sales\s*tax|\btax\b|\bget\b|\bgst\b|\bhst\b|\bvat\b)/i;
    var TOT = /\btotal\b|balance/i;

    for (var i = 0; i < lines.length; i++) {
      if (!TAX.test(lines[i]) || valueOf(lines[i]) !== null) continue;
      if (/taxable/i.test(lines[i]) || /\bfsa\b/i.test(lines[i])) continue;

      // Walk the labels from the tax line, remembering whether a subtotal came
      // just before it and whether a total follows.
      var sub = null;
      for (var b = i - 1; b >= 0 && b >= i - 4 && isLabel(lines[b]); b--) {
        if (SUB.test(lines[b])) { sub = b; break; }
      }
      /*
       * The label run ends where the values begin, not at the first line that
       * fails to look like a label. A masked card number ("************2-30")
       * has no letters and no money, so treating it as a non-label ended
       * AutoZone's run twelve lines early and the value column was never
       * reached at all. Anything that is not an amount is part of the run.
       */
      var sawTotal = false;
      var j = i;
      for (; j < lines.length && valueOf(lines[j]) === null; j++) {
        if (j > i && TOT.test(lines[j]) && !SUB.test(lines[j])) sawTotal = true;
      }
      if (!sawTotal) continue;

      // The value run. OCR drops stray lines into it (a card number, "You Pay",
      // an auth code), so a gap does not end the run as long as more amounts
      // follow. Scanning stops at the first gap once enough values are in hand.
      /*
       * The value run. OCR drops stray lines into it (a card number, "You Pay",
       * an auth code), and Safeway puts fourteen footer lines between the label
       * block and the column it belongs to, so a gap cannot end the run.
       *
       * That width is what makes the rate ceiling below necessary rather than
       * optional: the run reaches the payment tail, and strategy 1 searches
       * every triple in it.
       */
      var values = [];
      var gap = 0;
      for (var k = j; k < lines.length && gap < 20; k++) {
        var v = valueOf(lines[k]);
        if (v === null) { gap++; continue; }
        gap = 0;
        values.push(v);
        if (values.length > 24) break;
      }
      if (values.length < 2) continue;

      /*
       * The anchor is the grand total, which is known independently and
       * reliably. Whatever sits immediately before it in the value column is
       * the tax, because that is the row order every receipt prints.
       *
       * Where a subtotal label was also found, the arithmetic has to hold as
       * well. That is the part that makes this a check rather than a guess.
       */
      /*
       * Strategy 1, when a subtotal label is present: find the three values
       * that satisfy `subtotal + tax = total`, in that order, anywhere in the
       * run.
       *
       * Order plus arithmetic is a strong enough constraint to be a proof
       * rather than a heuristic, and it does not need the grand total to
       * already be right. That matters: on Costco and City Mill the total
       * itself was wrong (the parser had picked a line item), so anchoring on
       * it would have inherited the error. This finds all three and hands the
       * total back corrected.
       *
       * The values need not be adjacent. AutoZone prints three separate tax
       * lines and OCR leaves their fragments in between.
       */
      /*
       * Strategy 1a: the labels and the values line up, position for position.
       *
       * This is the strongest evidence available, and unlike the search below
       * it does not care which value is largest. A restaurant slip prints
       * `SUB-TOTAL / STATE TAX / TOTAL / TIP / AMOUNT PAID` over five values,
       * and the answer is the first three: the total is NOT the biggest number
       * on that receipt, the amount paid is. Requiring the maximum, which is
       * what stops the search below picking a discount line, is exactly wrong
       * here.
       */
      if (sub !== null) {
        // From the SUBTOTAL line itself, not from a guess at where it is.
        var labels = [];
        for (var q = sub; q < j && q < lines.length; q++) {
          if (q < 0) continue;
          if (/^(price|you\s*pay|qty|each|item)\s*$/i.test(lines[q])) continue;
          labels.push(lines[q]);
        }
        var pSub = -1, pTax = -1, pTot = -1;
        for (var a2 = 0; a2 < labels.length; a2++) {
          if (pSub < 0 && SUB.test(labels[a2])) pSub = a2;
          else if (pSub >= 0 && pTax < 0 && TAX.test(labels[a2])) pTax = a2;
          else if (pTax >= 0 && pTot < 0 && TOT.test(labels[a2]) && !SUB.test(labels[a2])) pTot = a2;
        }
        if (pSub >= 0 && pTax >= 0 && pTot >= 0) {
          for (var st = 0; st + pTot < values.length; st++) {
            var sA = values[st + pSub], tA = values[st + pTax], gA = values[st + pTot];
            if (!(sA > 0) || !(tA > 0) || !(gA > 0)) continue;
            if (tA > gA * 0.13) continue;
            if (Math.abs(sA + tA - gA) < 0.02) return { subtotal: sA, tax: tA, total: gA };
          }
        }
      }

      if (sub !== null) {
        // The grand total is the largest amount in the block, essentially
        // always. Without this the search happily finds a discount line that
        // happens to complete an equation: Costco's "5.00-" instant saving
        // satisfied one, and 5.00 was reported as the sales tax.
        var biggest = 0;
        for (var z = 0; z < values.length; z++) if (values[z] > biggest) biggest = values[z];
        for (var g = values.length - 1; g >= 2; g--) {
          var gv = values[g];
          if (!(gv > 0) || gv < biggest - 0.005) continue;
          for (var t1 = g - 1; t1 >= 1; t1--) {
            var tv = values[t1];
            /*
             * 13%, not 25%, and this is the whole defence against tips.
             *
             * `total + tip = amount paid` is as true as `subtotal + tax =
             * total`, and a restaurant slip prints both, so the search found
             * the tip triple and reported an 18.5% "sales tax" — which
             * CaptureScreen then learned as that city's rate for every future
             * split. No US jurisdiction charges sales tax above about 11.5%, so
             * a rate a tip can reach and a tax cannot is the line that separates
             * them. Hawaii GET is 4.7% and Virginia 6%, so the corpus is
             * nowhere near this ceiling.
             */
            if (!(tv > 0) || tv > gv * 0.13) continue;
            for (var s1 = t1 - 1; s1 >= 0; s1--) {
              var sv = values[s1];
              if (!(sv > 0)) continue;
              if (Math.abs(sv + tv - gv) < 0.02) {
                return { subtotal: sv, tax: tv, total: gv };
              }
            }
          }
        }
      }

      /*
       * Strategy 2, for receipts with no subtotal line at all. Safeway prints
       * only TAX and BALANCE, so there is nothing to add up. The anchor is the
       * grand total, which is known independently, and whatever sits
       * immediately before it in the value column is the tax, because that is
       * the row order every receipt prints.
       */
      if (!grandTotal) continue;
      for (var t2 = values.length - 1; t2 >= 1; t2--) {
        if (Math.abs(values[t2] - grandTotal) >= 0.02) continue;
        var tax2 = values[t2 - 1];
        if (tax2 == null || tax2 <= 0 || tax2 > grandTotal * 0.25) continue;
        return { subtotal: null, tax: tax2, total: grandTotal };
      }
    }
    return null;
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
      // Math.abs, because extractTotal returns a negative on a refund now
      // (D-088). Without it every candidate failed `v <= -32.72` and a return
      // never reversed the sales tax the purchase had added.
      return grandTotal ? v <= Math.abs(grandTotal) * 0.25 : true;
    }

    // The column block first, when it is there. It is the only source here that
    // proves itself, so nothing below is allowed to overwrite it (D-087). It
    // needs `grandTotal`, which is why it sits here and not at the top: `var`
    // hoisting made an earlier call read it as undefined and silently do
    // nothing, which looked exactly like the block not matching.
    var col = columnTotals(lines, grandTotal);
    if (col) {
      tax = col.tax;
      if (col.subtotal != null) subtotal = col.subtotal;
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
      /*
       * The column block answered, so this loop must not overwrite the tax.
       *
       * It still runs for the SUBTOTAL line above, though. Suppressing the
       * whole loop left `subtotal` null whenever strategy 2 answered, which
       * silently disabled `repairColumnTotal` on exactly the receipts that
       * needed it. And letting the tax branch run undid strategy 2's answer,
       * because its largest-wins rule picked an item price. Neither half of the
       * loop is right for both cases; they are split.
       */
      else if (col) continue;
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
    return { subtotal: subtotal, tax: tax, rate: rate, printedRate: printedRate,
             columnTotal: col && sub2total(col) };
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
  // ---- Renamed categories ----
  //
  // A category name is not just a label: it is stored as a string on every
  // saved receipt, inside every allocation, and inside every exported archive.
  // So renaming one is a data migration, and the old name keeps arriving
  // forever afterwards from archives exported before the change.
  //
  // This map is the single place a rename is recorded. The SQLite migration
  // rewrites stored rows from it, and restore rewrites imported rows through
  // it, so an archive from before the rename lands under the new name instead
  // of quietly recreating a category that no longer exists.
  var CATEGORY_ALIASES = {
    'Meals & Entertainment': 'Business Meals'
  };

  function canonicalCategory(name) {
    if (name == null) return name;
    var key = String(name).trim();
    return Object.prototype.hasOwnProperty.call(CATEGORY_ALIASES, key)
      ? CATEGORY_ALIASES[key] : name;
  }

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
    // 299 "Rent on vehicles, mach, eq" -> 2011:C:20a, per the v042 refnum table.
    'Equipment Rental': 299,
    'Repairs & Maintenance': 315,
    'Supplies & Materials': 301,
    'Taxes & Licenses': 316,
    'Travel & Lodging': 317,
    'Business Meals': 294,
    'Utilities & Phone': 318,
    'Wages & Payroll': 297,
    // Postage is line 18, not "other". The Line 18 instruction is one sentence:
    // "Include on this line your expenses for office supplies and postage."
    'Shipping & Postage': 313,
    // 308 is Schedule C line 14, which is what this category's own scheduleC
    // string already told the user. Sending it to 302 meant the TXF file
    // contradicted the app's own display of where the money would land.
    'Employee Benefits': 308,
    // The rest have no dedicated refnum and genuinely belong in Part V, which
    // is what "Other business expense" is. Each keeps its own record so the
    // itemization survives — see buildTXF and D-046.
    'Software & Subscriptions': 302,
    'Bank & Merchant Fees': 302,
    'Education & Training': 302,
    'Dues & Memberships': 302,
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

  /**
   * Repair a total that picked up the subtotal from a stacked column.
   *
   * Some receipts print every label first and every value after, so the amounts
   * line up by POSITION rather than by adjacency. Verbatim from a real Target
   * receipt (__tests__/corpus/target-column.txt):
   *
   *     SUBTOTAL
   *     T = VA TAX 6.00000 on $25.00
   *     TOTAL
   *     $25.00      <- belongs to SUBTOTAL
   *     $1.50       <- belongs to the tax line
   *     $26.50      <- belongs to TOTAL
   *
   * "The amount is on this line or the next" then hands TOTAL the subtotal, and
   * the receipt exports $1.50 light. Silently, because $25.00 is a real number
   * printed on the receipt.
   *
   * The repair is deliberately narrow. It fires only when ALL of:
   *   - a subtotal and a tax were both found,
   *   - the chosen total equals the subtotal to the cent, and
   *   - subtotal + tax appears VERBATIM as an amount somewhere on the receipt.
   *
   * That last condition is what makes this safe. A genuinely tax-inclusive
   * receipt, where the total legitimately equals the subtotal, does not also
   * print their sum — so there is nothing for this to match and it stands down.
   */
  function repairColumnTotal(lines, total, subtotal, tax) {
    if (total === null || !subtotal || !tax) return total;
    if (Math.abs(total - subtotal) >= 0.005) return total;
    var want = Math.round((subtotal + tax) * 100) / 100;
    if (Math.abs(want - total) < 0.005) return total;
    for (var i = 0; i < lines.length; i++) {
      var found = scanMoney(lines[i]);
      for (var j = 0; j < found.length; j++) {
        var v = normalizeAmount(found[j][1]);
        if (v !== null && Math.abs(v - want) < 0.005) return want;
      }
    }
    return total;
  }

  function parseReceipt(rawText) {
    var text = (rawText || '').replace(/\r/g, '');
    var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var merchant = sloganBrand(text)                 // strongest: the shop's own slogan
      || markerBrand(text)                           // then: its own domain, earliest wins
      || fingerprintBrand(text)                      // then: the receipt's own vocabulary
      || extractMerchant(lines)
      || brandFromText(text);                        // fallback: recognized brand anywhere
    var total = applyTip(lines, extractTotal(lines));
    var date = extractDate(text);
    var category = classify(text, merchant);
    var items = extractLineItems(lines);
    var taxInfo = extractTaxInfo(lines);
    /*
     * A column block that proved itself arithmetically also knows the total,
     * and it is worth more than the scan that produced `total`. On City Mill
     * and Costco the scan had picked a line item ($2.47 for an $18.29 receipt),
     * because in a column layout the first amount after the labels IS an item
     * price. `subtotal + tax = total` is not something a line item satisfies by
     * accident (D-087).
     */
    /*
     * ...but never over a tip the receipt itself confirmed.
     *
     * The block proves `subtotal + tax = total`, which on a restaurant slip is
     * the PRE-tip total and not the deductible amount. Overriding here dropped
     * a $20 tip off a meal, which is precisely the under-deduction applyTip
     * exists to prevent (D-042).
     *
     * So the override only ever RAISES the total, never lowers it. That is the
     * case it was built for: Costco reading $12.99 for a $172.37 receipt,
     * because in a column layout the first amount after the labels is an item
     * price. A total already larger than subtotal plus tax includes something
     * the block cannot see, and a tip is exactly that.
     */
    if (taxInfo.columnTotal != null && (total === null || taxInfo.columnTotal > total)) {
      total = taxInfo.columnTotal;
    }
    total = repairColumnTotal(lines, total, taxInfo.subtotal, taxInfo.tax);
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
    CATEGORY_ALIASES: CATEGORY_ALIASES,
    canonicalCategory: canonicalCategory,
    CATEGORIES: CATEGORIES.map(function (c) { return { name: c.name, scheduleC: c.scheduleC, group: c.group || 'Other' }; })
      .concat([{ name: 'Uncategorized', scheduleC: 'Review manually', group: 'Not Schedule C' }]),
    GROUP_ORDER: ['Everyday Operations', 'Vehicle & Travel', 'Facilities', 'People & Services',
      'Financial & Admin', 'Goods & Inventory', 'Not Schedule C']
  };
}));

