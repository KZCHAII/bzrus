// WITHSAJU 화면 공통: API 호출, 사인 카드·관계·지도 그리기, 주인 토큰 보관
(function () {
  var EL_VAR = { Wood: '--wood', Fire: '--fire', Earth: '--earth', Metal: '--metal', Water: '--water' };
  var EL_H = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };
  var REL = {
    mirror: { n: 'Mirror', c: '--metal' }, battery: { n: 'Battery', c: '--wood' }, spark: { n: 'Spark', c: '--fire' },
    copilot: { n: 'Co-pilot', c: '--water' }, coach: { n: 'Coach', c: '--earth' }
  };
  var ZG = { Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓' };
  var STRENGTH = { peak: 'In season', fed: 'Season-fed', off: 'Off season' };
  var TYPE_WORD = function (s) { return s.name.split(' ').slice(1).join(' '); };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }

  async function api(path, opts) {
    opts = opts || {};
    var headers = { 'content-type': 'application/json' };
    if (opts.token) headers['x-owner-token'] = opts.token;
    var res = await fetch(path, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    var data = null; try { data = await res.json(); } catch (e) { /* empty */ }
    if (!res.ok) { var err = new Error((data && data.message) || 'Something went wrong. Try again.'); err.status = res.status; err.code = data && data.error; throw err; }
    return data;
  }

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  function whyText(s) {
    var season = s.season.toLowerCase(), el = s.element.toLowerCase();
    var feeder = { Spring: 'wood', Summer: 'fire', Autumn: 'metal', Winter: 'water' }[s.season];
    if (s.strength === 'peak') return 'You were born in ' + season + ', ' + el + '’s own season. In Saju that puts your element at full strength: easy to see, hard to ignore.';
    if (s.strength === 'fed') return 'You were born in ' + season + ', and ' + feeder + ' feeds ' + el + '. The season was on your side from day one.';
    return 'You were born in ' + season + ', when ' + el + ' isn’t the strongest element. You work harder for it, and people underestimate you until they don’t.';
  }

  /** 사인 카드 채우기 (요소 id 접두사 p) */
  function fillSign(card, s, name, p) {
    p = p || '';
    card.style.setProperty('--el', 'var(' + EL_VAR[s.element] + ')');
    var set = function (id, html) { var e = $(p + id); if (e) e.innerHTML = html; };
    set('coord', 'SUN <b>' + s.sunLongitude.toFixed(1) + '°</b> · PILLAR <b>' + esc(s.dayPillar.han) + '</b>');
    set('w-line', (name ? esc(name) + ', you' : 'You') + '’re a <b>' + (ZG[s.zodiac] || '') + '︎ ' + esc(s.zodiac) + '</b> in the West,');
    set('k-han', esc(s.hanja));
    set('k-name', esc(s.season) + ' <em>' + esc(TYPE_WORD(s)) + '</em>');
    set('k-meta', (s.yang ? 'Yang' : 'Yin') + ' ' + esc(s.element) + ' ' + EL_H[s.element] + ' · day pillar ' + esc(s.dayPillar.roman));
    set('k-tag', esc(s.tagline));
    set('k-stats', '<div><dt>Element</dt><dd>' + (s.yang ? 'Yang' : 'Yin') + ' ' + esc(s.element) + '</dd></div><div><dt>Season</dt><dd>' + esc(s.season) + '</dd></div><div><dt>Strength</dt><dd class="hot">' + STRENGTH[s.strength] + '</dd></div>');
    set('k-why', '<b>Why ' + esc(s.name) + '?</b> Saju names you after your <b>Day Master</b>, the heavenly stem of the day you were born. Yours is ' + esc(s.hanja) + ', ' + (s.yang ? 'Yang' : 'Yin') + ' ' + esc(s.element) + '. ' + whyText(s));
  }

  var REL_TEXT = {
    mirror: function () { return 'Same element. You get each other without explaining, and you fight about the same things.'; },
    battery: function (a, b) { return 'Their ' + b.toLowerCase() + ' feeds your ' + a.toLowerCase() + '. Time with them feels like plugging in.'; },
    spark: function (a, b) { return 'Your ' + a.toLowerCase() + ' feeds their ' + b.toLowerCase() + '. They grow when you’re around, and they know it.'; },
    copilot: function (a, b) { return 'Your ' + a.toLowerCase() + ' steers their ' + b.toLowerCase() + '. You plan, they follow through. Great team, as long as nobody gets bossy.'; },
    coach: function (a, b) { return 'Their ' + b.toLowerCase() + ' checks your ' + a.toLowerCase() + '. They push harder than anyone. Annoying, and also why you get better.'; }
  };

  // 친구(손님)가 보는 문장: 지도 주인을 3인칭으로
  var REL_TEXT_GUEST = {
    mirror: function (o, g, O) { return 'Same element. You and ' + O + ' get each other without explaining, and you fight about the same things.'; },
    battery: function (o, g, O) { return 'Your ' + g + ' feeds ' + O + '\u2019s ' + o + '. Time with you recharges ' + O + '.'; },
    spark: function (o, g, O) { return O + '\u2019s ' + o + ' feeds your ' + g + '. You grow when ' + O + '\u2019s around.'; },
    copilot: function (o, g, O) { return O + '\u2019s ' + o + ' steers your ' + g + '. ' + O + ' plans, you follow through. Great team, as long as nobody gets bossy.'; },
    coach: function (o, g, O) { return 'Your ' + g + ' checks ' + O + '\u2019s ' + o + '. You push ' + O + ' harder than anyone, and that\u2019s why ' + O + ' gets better.'; }
  };

  /** 관계 상자. ownerSign 입장의 관계(rel). guestName을 주면 친구 시점 문장. headline은 화면별 문장 */
  function relHtml(rel, ownerSign, friendSign, headline, ownerName) {
    var R = REL[rel.kind];
    var text = ownerName
      ? REL_TEXT_GUEST[rel.kind](ownerSign.element.toLowerCase(), friendSign.element.toLowerCase(), ownerName)
      : REL_TEXT[rel.kind](ownerSign.element, friendSign.element);
    return '<div class="score" style="--rc:var(' + R.c + ')"><span class="corner"></span><span class="corner-br"></span><b>' + rel.score + '</b><small>CHEMISTRY</small></div>' +
      '<div style="--rc:var(' + R.c + ')"><p class="rel-pair">' + esc(ownerSign.name) + ' + ' + esc(friendSign.name) + '</p><p class="rel-name">' + headline.replace('{R}', '<em>' + R.n + '</em>') + '</p>' +
      '<p class="rel-text">' + esc(text) + '</p></div>';
  }

  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  /** 지도: 가운데 주인, 점수가 높을수록 가깝게, 관계별로 방향을 나눔 */
  function drawMap(canvas, centerLabel, entries) {
    var x = canvas.getContext('2d'), W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 34;
    x.clearRect(0, 0, W, H);
    [[1, 'rgba(0,240,255,0.14)'], [.66, 'rgba(168,85,247,0.16)'], [.33, 'rgba(236,72,153,0.16)']].forEach(function (o) {
      x.save(); x.translate(cx, cy); x.scale(1, .78); x.beginPath(); x.arc(0, 0, R * o[0], 0, Math.PI * 2); x.restore(); x.strokeStyle = o[1]; x.lineWidth = 1; x.stroke();
    });
    var kinds = ['battery', 'spark', 'copilot', 'mirror', 'coach'];
    var pos = entries.map(function (e, i) {
      var sector = kinds.indexOf(e.relation), within = entries.filter(function (f, j) { return j < i && f.relation === e.relation; }).length;
      var ang = -Math.PI / 2 + sector * (Math.PI * 2 / 5) + (within % 5 - 2) * 0.22 + Math.floor(within / 5) * 0.11;
      var dist = Math.max(.28, Math.min(.95, 1 - (e.score - 60) / 42));
      return { e: e, px: cx + Math.cos(ang) * R * dist, py: cy + Math.sin(ang) * R * dist * .78 };
    });
    pos.forEach(function (p) { x.beginPath(); x.moveTo(cx, cy); x.lineTo(p.px, p.py); x.strokeStyle = 'rgba(255,255,255,0.10)'; x.setLineDash([2, 4]); x.stroke(); x.setLineDash([]); });
    var g = x.createRadialGradient(cx, cy, 2, cx, cy, 46); g.addColorStop(0, 'rgba(0,240,255,.45)'); g.addColorStop(1, 'rgba(0,240,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 46, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, 24, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#000'; x.font = '700 11px "JetBrains Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(centerLabel).slice(0, 6).toUpperCase(), cx, cy + 1);
    pos.forEach(function (p) {
      var col = cssVar(REL[p.e.relation].c);
      x.shadowColor = col; x.shadowBlur = 14; x.fillStyle = col; x.beginPath(); x.arc(p.px, p.py, 6, 0, Math.PI * 2); x.fill(); x.shadowBlur = 0;
      x.fillStyle = col; x.font = '600 13px "JetBrains Mono", monospace'; x.textAlign = p.px > cx + R * .55 ? 'right' : 'left';
      x.fillText(String(p.e.nickname).slice(0, 12).toUpperCase(), p.px + (x.textAlign === 'right' ? -11 : 11), p.py + 1);
    });
  }

  function legendHtml() {
    return Object.keys(REL).map(function (k) { return '<span><i style="background:var(' + REL[k].c + ');box-shadow:0 0 6px var(' + REL[k].c + ')"></i>' + REL[k].n + '</span>'; }).join('');
  }

  window.WS = { api: api, esc: esc, $: $, store: store, fillSign: fillSign, relHtml: relHtml, drawMap: drawMap, legendHtml: legendHtml, REL: REL, EL_VAR: EL_VAR };
})();
