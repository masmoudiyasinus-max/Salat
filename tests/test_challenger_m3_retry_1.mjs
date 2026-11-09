import assert from 'node:assert/strict';
import { isValidTimeString, getPrayerTimesStatus, DATA_STATUS } from '../src/services/dataReadiness.js';
import { OBLIGATORY_PRAYER_IDS } from '../src/services/prayerConstants.js';

let passedCount = 0;
let failedCount = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passedCount++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failedCount++;
    failures.push({ name, error: err.message });
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('======================================================================');
console.log('⚡ CHALLENGER M3 RETRY 1: EMPIRICAL STRESS & ADVERSARIAL TIME STRING HARNESS');
console.log('======================================================================\n');

// --------------------------------------------------------------------------
// SUITE 1: Valid 24h Formats & Exhaustive Minute-by-Minute Generator
// --------------------------------------------------------------------------
console.log('--- SUITE 1: Valid 24h Formats & Exhaustive Combinations ---');

test('1.1 Canonical boundary times (00:00, 12:00, 23:59)', () => {
  assert.equal(isValidTimeString('00:00'), true);
  assert.equal(isValidTimeString('12:00'), true);
  assert.equal(isValidTimeString('23:59'), true);
  assert.equal(isValidTimeString('04:30'), true);
  assert.equal(isValidTimeString('05:15'), true);
  assert.equal(isValidTimeString('18:45'), true);
});

test('1.2 Single-digit hour format (H:MM)', () => {
  assert.equal(isValidTimeString('0:00'), true);
  assert.equal(isValidTimeString('1:05'), true);
  assert.equal(isValidTimeString('5:30'), true);
  assert.equal(isValidTimeString('9:59'), true);
});

test('1.3 Permissible whitespace trimming around valid times', () => {
  assert.equal(isValidTimeString(' 00:00'), true);
  assert.equal(isValidTimeString('23:59 '), true);
  assert.equal(isValidTimeString('  12:30  '), true);
  assert.equal(isValidTimeString('\t05:15\n'), true);
  assert.equal(isValidTimeString('\r\n 01:23 \t\r\n'), true);
});

test('1.4 Exhaustive generator: all 1,440 24h times from 00:00 to 23:59', () => {
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m++) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const str = `${hh}:${mm}`;
      assert.equal(
        isValidTimeString(str),
        true,
        `Expected ${str} to be valid 24h time`
      );
    }
  }
});

test('1.5 Exhaustive generator: all 600 single-digit hour times from 0:00 to 9:59', () => {
  for (let h = 0; h < 10; h++) {
    for (let m = 0; m < 60; m++) {
      const mm = String(m).padStart(2, '0');
      const str = `${h}:${mm}`;
      assert.equal(
        isValidTimeString(str),
        true,
        `Expected single-digit ${str} to be valid 24h time`
      );
    }
  }
});

// --------------------------------------------------------------------------
// SUITE 2: Invalid Formats — Colon Placeholders & Missing Parts
// --------------------------------------------------------------------------
console.log('\n--- SUITE 2: Colon Placeholders & Missing Parts ---');

test('2.1 Standalone colons strictly rejected', () => {
  const colons = [':', '::', ':::', ' : ', '  :  ', '\t:\n', ' : : '];
  for (const c of colons) {
    assert.equal(isValidTimeString(c), false, `Expected '${c}' to be rejected`);
  }
});

test('2.2 Trailing colons (missing minutes) strictly rejected', () => {
  const trailing = ['12:', '0:', '00:', '23:', '5:', '12: ', '12:\t', '12:  ', ' 12: '];
  for (const t of trailing) {
    assert.equal(isValidTimeString(t), false, `Expected '${t}' to be rejected`);
  }
});

test('2.3 Leading colons (missing hours) strictly rejected', () => {
  const leading = [':30', ':00', ':59', ' :30', '\t:30', ' : 00', ' :00 '];
  for (const l of leading) {
    assert.equal(isValidTimeString(l), false, `Expected '${l}' to be rejected`);
  }
});

test('2.4 Internal whitespace around colon strictly rejected', () => {
  const spaces = ['12: 30', '12 :30', '12 : 30', ' 12 : 30 ', '0 : 00', '23 :\t59'];
  for (const s of spaces) {
    assert.equal(isValidTimeString(s), false, `Expected '${s}' with internal whitespace to be rejected`);
  }
});

test('2.5 Missing colons or alternate delimiters rejected', () => {
  const delimiters = [
    '1230', '12.30', '12-30', '12_30', '12/30', '12 30', '12;30',
    '12::30', '12:::30', '12|30', '12\\30', '12~30',
  ];
  for (const d of delimiters) {
    assert.equal(isValidTimeString(d), false, `Expected delimiter case '${d}' to be rejected`);
  }
});

test('2.6 Truncated / overflow digit counts strictly rejected', () => {
  const malformedDigits = [
    '', '   ', '\t\n',
    '1:1', '12:0', '12:1', '00:0', '0:5',
    '001:00', '012:30', '123:45',
    '12:000', '12:030', '12:345',
    '1', '12', '123', '1234',
  ];
  for (const m of malformedDigits) {
    assert.equal(isValidTimeString(m), false, `Expected digit count case '${m}' to be rejected`);
  }
});

test('2.7 Seconds included format strictly rejected (HH:MM required)', () => {
  const withSeconds = ['12:30:00', '00:00:00', '23:59:59', '12:30:00.000', '05:15:30'];
  for (const s of withSeconds) {
    assert.equal(isValidTimeString(s), false, `Expected seconds format '${s}' to be rejected`);
  }
});

// --------------------------------------------------------------------------
// SUITE 3: Out-of-Range Hours and Minutes (Range Bounds)
// --------------------------------------------------------------------------
console.log('\n--- SUITE 3: Out-of-Range Hours & Minutes ---');

test('3.1 Hour >= 24 strictly rejected', () => {
  const invalidHours = [
    '24:00', '24:01', '24:30', '24:59',
    '25:00', '25:30', '29:00', '30:00',
    '99:00', '99:59',
  ];
  for (const h of invalidHours) {
    assert.equal(isValidTimeString(h), false, `Expected out-of-range hour '${h}' to be rejected`);
  }
});

test('3.2 Minute >= 60 strictly rejected', () => {
  const invalidMinutes = [
    '00:60', '05:60', '12:60', '23:60',
    '00:61', '12:75', '12:99', '23:99',
    '0:60', '9:99',
  ];
  for (const m of invalidMinutes) {
    assert.equal(isValidTimeString(m), false, `Expected out-of-range minute '${m}' to be rejected`);
  }
});

test('3.3 Both Hour and Minute out-of-range strictly rejected', () => {
  const bothInvalid = ['24:60', '25:60', '25:99', '99:99', '99:60'];
  for (const b of bothInvalid) {
    assert.equal(isValidTimeString(b), false, `Expected '${b}' to be rejected`);
  }
});

test('3.4 Negative numbers and explicit sign prefixes rejected', () => {
  const signed = [
    '-1:00', '-01:00', '-12:30', '-23:59',
    '00:-1', '12:-05', '12:-30',
    '+0:00', '+00:00', '+12:00', '+23:59',
  ];
  for (const s of signed) {
    assert.equal(isValidTimeString(s), false, `Expected signed input '${s}' to be rejected`);
  }
});

test('3.5 Floats, scientific notation, and hex rejected', () => {
  const nonIntegers = [
    '12.5:30', '12:30.5', '1e2:00', '12:1e1',
    '0x12:00', '12:0x10', '0b10:00',
  ];
  for (const n of nonIntegers) {
    assert.equal(isValidTimeString(n), false, `Expected '${n}' to be rejected`);
  }
});

// --------------------------------------------------------------------------
// SUITE 4: Non-String, Malformed, and Adversarial Injections
// --------------------------------------------------------------------------
console.log('\n--- SUITE 4: Non-String, Malformed, & Adversarial Inputs ---');

test('4.1 Non-string primitives and falsy values rejected', () => {
  const nonStrings = [
    null, undefined, 0, 1200, 12.3, -1, NaN, Infinity, -Infinity,
    true, false, Symbol('12:00'), BigInt(1200),
  ];
  for (const ns of nonStrings) {
    assert.equal(isValidTimeString(ns), false, `Expected non-string ${String(ns)} to be rejected`);
  }
});

test('4.2 Non-string reference types rejected', () => {
  const refTypes = [
    {}, [], ['12:00'], { time: '12:00' }, { toString: () => '12:00' },
    () => '12:00', new Date(), /12:00/,
  ];
  for (const ref of refTypes) {
    assert.equal(isValidTimeString(ref), false, `Expected reference type to be rejected`);
  }
});

test('4.3 Alphanumeric text, 12-hour AM/PM markers, and textual placeholders rejected', () => {
  const texts = [
    'ab:cd', '12:cd', 'ab:30', 'noon', 'midnight', 'now',
    '12:00 PM', '12:00 AM', '05:30 pm', '05:30am',
    '--:--', '??:??', '**:**', 'xx:xx',
    'undefined:undefined', 'NaN:NaN', 'null:null', 'true:false',
  ];
  for (const t of texts) {
    assert.equal(isValidTimeString(t), false, `Expected text '${t}' to be rejected`);
  }
});

test('4.4 Null bytes and control character injections rejected', () => {
  const injection = ['12:30\x00', '\x0012:30', '12\x00:30', '12:\x0030', '<script>:00', '12:00<script>'];
  for (const inj of injection) {
    assert.equal(isValidTimeString(inj), false, `Expected injection '${inj}' to be rejected`);
  }
});

test('4.5 Unicode numerals rejected (ASCII digits 0-9 required)', () => {
  // Eastern Arabic numerals (٠-٩)
  const arabicNumerals = ['٠٥:٣٠', '١٢:٠٠', '٠٠:٠٠', '٢٣:٥٩'];
  for (const an of arabicNumerals) {
    assert.equal(isValidTimeString(an), false, `Expected Arabic numeral string '${an}' to be rejected`);
  }
});

// --------------------------------------------------------------------------
// SUITE 5: Empirical Stress on getPrayerTimesStatus
// --------------------------------------------------------------------------
console.log('\n--- SUITE 5: getPrayerTimesStatus Empirical Invariants ---');

test('5.1 Returns READY for fully valid obligatory prayer times', () => {
  const validTimes = {
    Fajr: '05:10',
    Dhuhr: '12:15',
    Asr: '15:30',
    Maghrib: '18:00',
    Isha: '19:30',
  };
  assert.equal(getPrayerTimesStatus(validTimes), DATA_STATUS.READY);

  // Extra keys (Sunrise, Duha, Qiyam) should not alter READY
  const withExtras = {
    ...validTimes,
    Sunrise: '06:30',
    Duha: '07:15',
    Qiyam: '02:00',
    randomNote: 'custom data',
  };
  assert.equal(getPrayerTimesStatus(withExtras), DATA_STATUS.READY);
});

test('5.2 Returns UNAVAILABLE when any obligatory prayer has a colon placeholder', () => {
  const baseValid = {
    Fajr: '05:10',
    Dhuhr: '12:15',
    Asr: '15:30',
    Maghrib: '18:00',
    Isha: '19:30',
  };

  const placeholderCases = [
    ':', '::', ':::', '12:', ':30', '  :  ', ' : ', '--:--', '??:??', '   ', '',
  ];

  for (const pId of OBLIGATORY_PRAYER_IDS) {
    for (const ph of placeholderCases) {
      const contaminated = { ...baseValid, [pId]: ph };
      assert.equal(
        getPrayerTimesStatus(contaminated),
        DATA_STATUS.UNAVAILABLE,
        `Expected UNAVAILABLE when ${pId} has placeholder '${ph}'`
      );
    }
  }
});

test('5.3 Returns UNAVAILABLE when any obligatory prayer is missing or undefined/null', () => {
  const baseValid = {
    Fajr: '05:10',
    Dhuhr: '12:15',
    Asr: '15:30',
    Maghrib: '18:00',
    Isha: '19:30',
  };

  for (const pId of OBLIGATORY_PRAYER_IDS) {
    // Key deleted
    const missing = { ...baseValid };
    delete missing[pId];
    assert.equal(
      getPrayerTimesStatus(missing),
      DATA_STATUS.UNAVAILABLE,
      `Expected UNAVAILABLE when key ${pId} is deleted`
    );

    // Key is null
    const nullVal = { ...baseValid, [pId]: null };
    assert.equal(
      getPrayerTimesStatus(nullVal),
      DATA_STATUS.UNAVAILABLE,
      `Expected UNAVAILABLE when ${pId} is null`
    );

    // Key is undefined
    const undefVal = { ...baseValid, [pId]: undefined };
    assert.equal(
      getPrayerTimesStatus(undefVal),
      DATA_STATUS.UNAVAILABLE,
      `Expected UNAVAILABLE when ${pId} is undefined`
    );
  }
});

test('5.4 Returns UNAVAILABLE for non-object, empty, or corrupted payloads', () => {
  const corrupted = [
    null, undefined, '', 'not an object', 12345, true, false,
    {}, [], [baseObligatoryObject()], () => ({}),
  ];

  function baseObligatoryObject() {
    return { Fajr: '05:10', Dhuhr: '12:15', Asr: '15:30', Maghrib: '18:00', Isha: '19:30' };
  }

  for (const c of corrupted) {
    assert.equal(
      getPrayerTimesStatus(c),
      DATA_STATUS.UNAVAILABLE,
      `Expected UNAVAILABLE for corrupted payload ${String(c)}`
    );
  }
});

test('5.5 Default empty prayer times cache returns UNAVAILABLE', () => {
  const defaultCache = {
    Fajr: '',
    Sunrise: '',
    Dhuhr: '',
    Asr: '',
    Maghrib: '',
    Isha: '',
  };
  assert.equal(getPrayerTimesStatus(defaultCache), DATA_STATUS.UNAVAILABLE);
});

test('5.6 Single invalid obligatory prayer invalidates the whole set', () => {
  const oneInvalid = {
    Fajr: '05:10',
    Dhuhr: '12:15',
    Asr: '15:30',
    Maghrib: '24:00', // Invalid 24h
    Isha: '19:30',
  };
  assert.equal(getPrayerTimesStatus(oneInvalid), DATA_STATUS.UNAVAILABLE);
});

// --------------------------------------------------------------------------
// SUITE 6: Fuzzing & High-Volume Mutation Test
// --------------------------------------------------------------------------
console.log('\n--- SUITE 6: Fuzzing & High-Volume Adversarial Mutation ---');

test('6.1 Fuzz testing: 500 randomized malformed mutations never yield READY or throw', () => {
  const junkTokens = [
    ':', '::', '12:', ':30', '24:00', '12:60', '-1:00', 'abc', null, undefined,
    123, '', ' ', '  :  ', '--:--', '0:0', '000:00', '12:000', '23:59:00',
  ];

  for (let i = 0; i < 500; i++) {
    const fuzzedTimes = {
      Fajr: '05:10',
      Dhuhr: '12:15',
      Asr: '15:30',
      Maghrib: '18:00',
      Isha: '19:30',
    };

    // Inject 1 to 5 random corruptions
    const victimKeys = OBLIGATORY_PRAYER_IDS.filter(() => Math.random() < 0.5);
    if (victimKeys.length === 0) victimKeys.push(OBLIGATORY_PRAYER_IDS[i % OBLIGATORY_PRAYER_IDS.length]);

    for (const key of victimKeys) {
      fuzzedTimes[key] = junkTokens[Math.floor(Math.random() * junkTokens.length)];
    }

    const status = getPrayerTimesStatus(fuzzedTimes);
    assert.equal(
      status,
      DATA_STATUS.UNAVAILABLE,
      `Fuzz test iteration ${i} falsely evaluated to ${status}`
    );
  }
});

// --------------------------------------------------------------------------
// Summary & Verdict
// --------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`TOTAL TESTS: ${passedCount + failedCount}`);
console.log(`PASSED:      ${passedCount}`);
console.log(`FAILED:      ${failedCount}`);
if (failures.length > 0) {
  console.log('FAILURES:');
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
}
console.log('======================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
