// WITHSAJU 화면 공통: API 호출, 사인 카드·관계·지도 그리기, 주인 토큰 보관
(function () {
  var EL_VAR = { Wood: '--wood', Fire: '--fire', Earth: '--earth', Metal: '--metal', Water: '--water' };
  var EL_H = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };
  var REL = {
    mirror: { n: 'Mirror', c: '--metal' }, battery: { n: 'Battery', c: '--wood' }, spark: { n: 'Spark', c: '--fire' },
    copilot: { n: 'Co-pilot', c: '--water' }, coach: { n: 'Coach', c: '--earth' }
  };
  var ZG = { Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓' };
  var STRENGTH = { peak: 'Home season', fed: 'Tailwind', off: 'Self-made' };
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
    if (s.strength === 'peak') return 'You were born in ' + season + ', ' + el + '’s own season. <b>Home season</b>: your energy runs at full power, easy to see and hard to ignore.';
    if (s.strength === 'fed') return 'You were born in ' + season + ', and ' + feeder + ' feeds ' + el + '. <b>Tailwind</b>: the season feeds you, and things move faster when you go with it.';
    return 'You were born in ' + season + ', when ' + el + ' isn’t the strongest element. <b>Self-made</b>: the season doesn’t hand you power, so you build your own. Late bloomer, hard to break, and people underestimate you until they don’t.';
  }

  function pillarsHtml(s) {
    if (!s.pillars) return '';
    var cell = function (label, p, me) {
      if (!p) return '<div class="unk"><dt>' + label + '</dt><dd><span class="ph">??</span><span class="pr">add time</span></dd></div>';
      var h = esc(p.han);
      return '<div' + (me ? ' class="me"' : '') + '><dt>' + label + '</dt><dd><span class="ph"><span style="color:var(' + EL_VAR[p.stemElement] + ')">' + h.charAt(0) + '</span><span style="color:var(' + EL_VAR[p.branchElement] + ')">' + h.charAt(1) + '</span></span><span class="pr">' + esc(p.roman) + '</span></dd></div>';
    };
    var P = s.pillars;
    return cell('Year', P.year) + cell('Month', P.month) + cell('Day', P.day, true) + cell('Hour', P.hour);
  }

  /** 사인 카드 채우기 (요소 id 접두사 p) */
  function fillSign(card, s, name, p) {
    p = p || '';
    card.style.setProperty('--el', 'var(' + EL_VAR[s.element] + ')');
    var set = function (id, html) { var e = $(p + id); if (e) e.innerHTML = html; };
    set('coord', 'SUN <b>' + s.sunLongitude.toFixed(1) + '°</b> · PILLAR <b>' + esc(s.dayPillar.han) + '</b>');
    set('w-line', (name ? esc(name) + ', you' : 'You') + '’re a <b>' + (ZG[s.zodiac] || '') + '︎ ' + esc(s.zodiac) + '</b> in the West,');
    var art = $(p + 'k-han');
    if (window.WSArt && s.animal) card.style.setProperty('--ac', WSArt.COLOR[s.element][s.yang ? 'yang' : 'yin']);
    if (art && window.WSArt && s.animal) { art.className = 'art'; art.innerHTML = WSArt.svg({ animal: s.animal.name, element: s.element, yang: s.yang, season: s.season, hanja: s.dayPillar ? s.dayPillar.han : s.hanja }); }
    else set('k-han', esc(s.hanja));
    set('k-animal', s.animal ? 'The ' + esc(s.animal.name.toLowerCase()) + ' in you: ' + esc(s.animal.line) + '.' : '');
    set('k-name', s.animal ? '<span class="ttl-a">' + esc(s.animal.color + ' ' + s.animal.name) + '</span> <span class="ttl-of">of the</span> ' + esc(s.season) + ' <em>' + esc(TYPE_WORD(s)) + '</em>' : esc(s.season) + ' <em>' + esc(TYPE_WORD(s)) + '</em>');
    set('k-meta', (s.yang ? 'Yang' : 'Yin') + ' ' + esc(s.element) + ' ' + EL_H[s.element] + ' · day pillar ' + esc(s.dayPillar.roman));
    set('k-tag', esc(s.tagline));
    set('k-stats', '<div><dt>Element</dt><dd>' + (s.yang ? 'Yang' : 'Yin') + ' ' + esc(s.element) + '</dd></div><div><dt>Season</dt><dd>' + esc(s.season) + '</dd></div><div><dt>Season power</dt><dd class="hot">' + STRENGTH[s.strength] + '</dd></div>');
    set('k-pillars', pillarsHtml(s));
    if (window.WSCharts && s.elements) set('k-penta', '<div class="label" style="font-family:var(--mono);font-size:10px;letter-spacing:.16em;color:var(--mute-3);margin:4px 0 0">YOUR FIVE ELEMENTS</div>' + WSCharts.elementsPentagon([{ name: name || 'You', elements: s.elements, hidden: s.hidden }]) + (WSCharts.hiddenNote(s, !!s.hiddenSpots) ? '<p class="hnote">' + WSCharts.hiddenNote(s, !!s.hiddenSpots) + '</p>' : ''));
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
  var LINK_INFO = {
    stemHarmony: ['天干合', 'Heavenly pull', 'your core selves are drawn together', 1], sixHarmony: ['六合', 'Natural pair', 'you fit together without trying', 1],
    trine: ['三合', 'Same team', 'you move toward the same goals', 1], stemClash: ['天干沖', 'Core friction', 'you want different things at the core', 0],
    clash: ['沖', 'Head-on clash', 'opposites that collide, then learn from it', 0], punish: ['刑', 'Friction', 'you rub each other the wrong way under stress', 0],
    harm: ['害', 'Small hurts', 'little misunderstandings pile up', 0], break: ['破', 'Cracks', 'plans you make together can fall apart', 0]
  };
  function linksHtml(links) {
    if (!links || !links.length) return '';
    return '<div class="rlinks">' + links.map(function (l) { var i = LINK_INFO[l]; return i ? '<span class="lchip ' + (i[3] ? 'good' : 'bad') + '"><b>' + i[0] + ' ' + i[1] + '</b> ' + i[2] + '</span>' : ''; }).join('') + '</div>';
  }
  function relHtml(rel, ownerSign, friendSign, headline, ownerName) {
    var R = REL[rel.kind];
    var text = ownerName
      ? REL_TEXT_GUEST[rel.kind](ownerSign.element.toLowerCase(), friendSign.element.toLowerCase(), ownerName)
      : REL_TEXT[rel.kind](ownerSign.element, friendSign.element);
    return '<div class="score" style="--rc:var(' + R.c + ')"><span class="corner"></span><span class="corner-br"></span><b>' + rel.score + '</b><small>CHEMISTRY</small></div>' +
      '<div style="--rc:var(' + R.c + ')"><p class="rel-pair">' + esc(ownerSign.name) + ' + ' + esc(friendSign.name) + '</p><p class="rel-name">' + headline.replace('{R}', '<em>' + R.n + '</em>') + '</p>' +
      '<p class="rel-text">' + esc(text) + '</p>' + linksHtml(rel.links) + '</div>';
  }

  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  /** 지도: 원을 관계 5종으로 다섯 등분. 빈 칸도 보여 주고, 점수가 높을수록 가운데(주인) 가까이 */
  var KINDS = ['battery', 'spark', 'copilot', 'mirror', 'coach'];
  function rgba(hex, a) {
    var h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function drawMap(canvas, centerLabel, entries) {
    var x = canvas.getContext('2d'), W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 92;
    var TAU = Math.PI * 2, span = TAU / 5;
    x.clearRect(0, 0, W, H);
    x.textBaseline = 'middle';
    KINDS.forEach(function (k, i) {
      var col = cssVar(REL[k].c), a0 = -Math.PI / 2 - span / 2 + i * span, a1 = a0 + span, mid = (a0 + a1) / 2;
      var list = entries.filter(function (e) { return e.relation === k; });
      // 칸 채우기 (빈 칸은 더 옅게)
      var g = x.createRadialGradient(cx, cy, 30, cx, cy, R);
      g.addColorStop(0, rgba(col, list.length ? .02 : .01)); g.addColorStop(1, rgba(col, list.length ? .16 : .06));
      x.fillStyle = g; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R, a0, a1); x.closePath(); x.fill();
      // 바깥 테두리 호
      x.strokeStyle = rgba(col, list.length ? .75 : .3); x.lineWidth = 2; x.setLineDash(list.length ? [] : [4, 5]);
      x.beginPath(); x.arc(cx, cy, R, a0 + .02, a1 - .02); x.stroke(); x.setLineDash([]);
      // 칸 이름 + 인원
      var lx = cx + Math.cos(mid) * (R + 44), ly = cy + Math.sin(mid) * (R + 44);
      x.textAlign = 'center';
      x.fillStyle = list.length ? col : rgba(col, .55);
      x.font = '700 22px "JetBrains Mono", monospace'; x.fillText(REL[k].n.toUpperCase(), lx, ly - 12);
      x.font = '500 16px "JetBrains Mono", monospace'; x.fillStyle = list.length ? '#e0e0e0' : '#8a8a8a';
      x.fillText(list.length ? list.length + (list.length === 1 ? ' FRIEND' : ' FRIENDS') : 'EMPTY', lx, ly + 14);
      if (!list.length) {
        x.fillStyle = rgba(col, .5); x.font = '500 16px "JetBrains Mono", monospace';
        x.fillText('OPEN SLOT', cx + Math.cos(mid) * R * .62, cy + Math.sin(mid) * R * .62);
      }
      // 사람 점: 칸 안에 고르게, 점수 높을수록 가까이
      list.forEach(function (e, j) {
        var ang = a0 + span * (j + 1) / (list.length + 1);
        var dist = Math.max(.34, Math.min(.84, 1 - (e.score - 60) / 45)) + (list.length > 4 ? (j % 2 ? .08 : -.04) : 0);
        e._p = { x: cx + Math.cos(ang) * R * dist, y: cy + Math.sin(ang) * R * dist, col: col, outer: dist > .6 };
      });
    });
    // 칸 나누는 선 + 동심원
    x.strokeStyle = 'rgba(255,255,255,0.09)'; x.lineWidth = 1;
    for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 - span / 2 + i * span; x.beginPath(); x.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40); x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.stroke(); }
    [.36, .66].forEach(function (f) { x.beginPath(); x.arc(cx, cy, R * f, 0, TAU); x.setLineDash([2, 5]); x.stroke(); x.setLineDash([]); });
    // 주인 (가운데)
    var glow = x.createRadialGradient(cx, cy, 2, cx, cy, 56); glow.addColorStop(0, 'rgba(0,240,255,.45)'); glow.addColorStop(1, 'rgba(0,240,255,0)');
    x.fillStyle = glow; x.beginPath(); x.arc(cx, cy, 56, 0, TAU); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, 40, 0, TAU); x.fill();
    x.fillStyle = '#000'; x.font = '700 17px "JetBrains Mono", monospace'; x.textAlign = 'center';
    x.fillText(String(centerLabel).slice(0, 7).toUpperCase(), cx, cy + 1);
    // 사람
    entries.forEach(function (e) {
      var p = e._p; if (!p) return;
      x.strokeStyle = rgba(p.col, .35); x.setLineDash([2, 4]); x.beginPath(); x.moveTo(cx, cy); x.lineTo(p.x, p.y); x.stroke(); x.setLineDash([]);
      x.shadowColor = p.col; x.shadowBlur = 14; x.fillStyle = p.col; x.beginPath(); x.arc(p.x, p.y, 10, 0, TAU); x.fill(); x.shadowBlur = 0;
      // 이름은 바깥쪽 칸 이름과 겹치지 않게: 바깥 점이면 안쪽으로, 안쪽 점이면 바깥쪽으로
      var right = p.outer ? p.x >= cx : p.x < cx;
      x.textAlign = right ? 'right' : 'left'; x.fillStyle = '#fff'; x.font = '700 19px "JetBrains Mono", monospace';
      x.fillText(String(e.nickname).slice(0, 10).toUpperCase(), p.x + (right ? -16 : 16), p.y - 2);
      x.fillStyle = p.col; x.font = '500 16px "JetBrains Mono", monospace';
      x.fillText(String(e.score), p.x + (right ? -16 : 16), p.y + 18);
      delete e._p;
    });
  }

  function legendHtml() {
    return Object.keys(REL).map(function (k) { return '<span><i style="background:var(' + REL[k].c + ');box-shadow:0 0 6px var(' + REL[k].c + ')"></i>' + REL[k].n + '</span>'; }).join('');
  }

  // 내 정보(이 기기에만): 다시 오면 바로 내 사인, 내가 만든 지도 목록
  var me = {
    get: function () { try { return JSON.parse(store.get('ws_me') || 'null'); } catch (e) { return null; } },
    set: function (v) { store.set('ws_me', JSON.stringify(v)); },
    maps: function () { try { return JSON.parse(store.get('ws_maps') || '[]'); } catch (e) { return []; } },
    readings: function () { try { return JSON.parse(store.get('ws_readings') || '[]'); } catch (e) { return []; } },
    addReading: function (id, key, name) {
      var l = me.readings().filter(function (r) { return r.id !== id; }); l.unshift({ id: id, key: key, name: name });
      store.set('ws_readings', JSON.stringify(l.slice(0, 5)));
    },
    readingKey: function (id) { var r = me.readings().filter(function (x) { return x.id === id; })[0]; return r ? r.key : ''; },
    addMap: function (slug, name, token) {
      store.set('ws_owner_' + slug, token);
      var l = me.maps().filter(function (m) { return m.slug !== slug; }); l.unshift({ slug: slug, name: name });
      store.set('ws_maps', JSON.stringify(l.slice(0, 5)));
    }
  };

  /** 상단 메뉴: 내 지도가 있으면 바로가기 */
  function initNav() {
    var l = me.maps(), a = $('nav-mymap');
    if (a) a.textContent = 'My page';
    if (a && l.length) { a.href = '/m/' + l[0].slug; a.hidden = false; }
    var rl = me.readings(), b = $('nav-myreading');
    if (b && rl.length) { b.href = '/r/' + rl[0].id + '?k=' + encodeURIComponent(rl[0].key); b.hidden = false; }
  }

  /** 아래에서 올라오는 유료 리포트 안내 (닫으면 이번 방문 동안 안 뜸) */
  function dock(show) {
    var d = $('dock'); if (!d) return;
    var closed = false; try { closed = sessionStorage.getItem('ws_dock_x') === '1'; } catch (e) { /* ignore */ }
    if (show && !closed) { d.classList.add('on'); document.body.classList.add('has-dock'); }
    var x = d.querySelector('.x');
    if (x && !x.dataset.on) { x.dataset.on = '1'; x.addEventListener('click', function () { d.classList.remove('on'); document.body.classList.remove('has-dock'); try { sessionStorage.setItem('ws_dock_x', '1'); } catch (e) { /* ignore */ } }); }
  }

  /** 내 사인 스토리 이미지 */
  function signStory(s, name, pageUrl) {
    if (!window.WSCharts) return;
    var go = function (img) {
      var c = WSCharts.storyImage({ top: (name ? name + ', ' : '') + 'a ' + s.zodiac + ' in the West. In Korea:', hanja: s.hanja, art: img, name: s.title || s.name, sub: s.tagline, foot: "WHAT'S YOURS? " + (pageUrl ? pageUrl.replace(/^https?:\/\//, '') : location.host), color: WSCharts.cv(EL_VAR[s.element]) });
      WSCharts.shareImage(c, 'my-korean-sign.png', 'In Korean Saju I\u2019m the ' + (s.title || s.name) + '. What\u2019s yours?');
    };
    if (window.WSArt && s.animal) WSArt.toImage({ animal: s.animal.name, element: s.element, yang: s.yang, season: s.season, hanja: s.dayPillar ? s.dayPillar.han : s.hanja }, 760, go); else go(null);
  }


  // 태어난 시간: 한 시간 단위 선택 (사주 시주는 홀수 시 정각에 바뀌므로 한 시간 단위면 결과가 같다)
  function hourLabel(h) { var a = h < 12 ? 'AM' : 'PM', k = h % 12 || 12; return k + ':00 – ' + k + ':59 ' + a + (h === 0 ? ' (midnight)' : h === 12 ? ' (noon)' : ''); }
  function initTimeSelects() {
    document.querySelectorAll('select[data-time]').forEach(function (el) {
      if (el.options.length) return;
      var req = el.getAttribute('data-time') === 'req', h = [];
      el.required = req;
      if (req) h.push('<option value="" disabled selected>Select</option>');
      h.push('<option value="' + (req ? 'unknown' : '') + '">I don\u2019t know</option>');
      for (var i = 0; i < 24; i++) h.push('<option value="' + (i < 10 ? '0' : '') + i + ':30">' + hourLabel(i) + '</option>');
      el.innerHTML = h.join('');
    });
  }
  function setTime(el, t) {
    initTimeSelects();
    var m = /^(\d{1,2}):/.exec(t || '');
    if (m) el.value = ('0' + Number(m[1])).slice(-2) + ':30';
  }
  function timeOf(el) { return el.value && el.value !== 'unknown' ? el.value : ''; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTimeSelects); else initTimeSelects();

  // 통계: 쿠키 없음. 정해진 이벤트 이름만, 실패해도 조용히
  function srcOf() {
    try {
      var q = new URLSearchParams(location.search), u = q.get('utm_source') || q.get('ref');
      if (u) return u.slice(0, 60);
      if (document.referrer) { var h = new URL(document.referrer).hostname.replace(/^www\./, ''); if (h && h !== location.hostname) return h; }
    } catch (e) { /* ignore */ }
    return '';
  }
  function track(n, r, p) {
    try {
      var body = JSON.stringify({ n: n, r: r || '', p: p || '', s: n === 'page_view' ? srcOf() : '' });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/e', new Blob([body], { type: 'text/plain' }));
      else fetch('/api/e', { method: 'POST', body: body, keepalive: true }).catch(function () {});
    } catch (e) { /* ignore */ }
  }
  // 아래 고정 유료 안내(dock) 클릭
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('#dock a'); if (a) track('upsell_click', 'dock');
  });

  window.WS = { api: api, esc: esc, $: $, store: store, fillSign: fillSign, relHtml: relHtml, drawMap: drawMap, legendHtml: legendHtml, REL: REL, EL_VAR: EL_VAR, me: me, initNav: initNav, dock: dock, signStory: signStory, setTime: setTime, timeOf: timeOf, track: track };
})();
