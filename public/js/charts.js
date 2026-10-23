// WITHSAJU 그래프: 오각형(오행·관계), 연도별 흐름 선 그래프, 공유용 스토리 이미지, 공유 버튼
(function () {
  var esc = WS.esc;
  var EL = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];           // 상생 순서로 돌면 오각형이 된다
  var EL_C = { Wood: '--wood', Fire: '--fire', Earth: '--earth', Metal: '--metal', Water: '--water' };
  var REL_K = ['battery', 'spark', 'copilot', 'mirror', 'coach'];
  function cv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#00f0ff'; }

  /**
   * 오각형 레이더. axes: [{label, color}], series: [{values:[5개], color, name, fill}]
   */
  function pentagon(axes, series, opts) {
    opts = opts || {};
    var W = 320, H = 300, cx = W / 2, cy = 158, R = 100, n = axes.length;
    var max = Math.max(opts.min || 3, Math.max.apply(null, series.reduce(function (a, s) { return a.concat(s.values); }, [0])));
    var pt = function (i, r) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    var poly = function (r) { return axes.map(function (_, i) { return pt(i, r).join(','); }).join(' '); };
    var h = ['<svg viewBox="0 0 ' + W + ' ' + H + '" class="penta" role="img" aria-label="' + esc(opts.label || 'Pentagon chart') + '">'];
    [1, .66, .33].forEach(function (f) { h.push('<polygon points="' + poly(R * f) + '" fill="none" stroke="rgba(255,255,255,' + (f === 1 ? .22 : .09) + ')" stroke-width="1"/>'); });
    axes.forEach(function (_, i) { var p = pt(i, R); h.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="rgba(255,255,255,.08)"/>'); });
    series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return pt(i, R * Math.max(.06, v / max)).join(','); }).join(' ');
      h.push('<polygon points="' + pts + '" fill="' + s.color + '" fill-opacity="' + (s.fill == null ? .22 : s.fill) + '" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round"/>');
      s.values.forEach(function (v, i) { var p = pt(i, R * Math.max(.06, v / max)); h.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" fill="' + s.color + '"/>'); });
    });
    axes.forEach(function (a, i) {
      var p = pt(i, R + 26), anchor = Math.abs(p[0] - cx) < 8 ? 'middle' : p[0] > cx ? 'start' : 'end';
      h.push('<text x="' + p[0] + '" y="' + (p[1] - 4) + '" text-anchor="' + anchor + '" fill="' + a.color + '" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" letter-spacing="1">' + esc(a.label.toUpperCase()) + '</text>');
      if (a.sub != null) h.push('<text x="' + p[0] + '" y="' + (p[1] + 11) + '" text-anchor="' + anchor + '" fill="#aaa" font-family="JetBrains Mono, monospace" font-size="11">' + esc(a.sub) + '</text>');
    });
    h.push('</svg>');
    var legend = series.length > 1 ? '<div class="pleg">' + series.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>' : '';
    return h.join('') + legend;
  }

  /** 오행 오각형: 한 사람 또는 두 사람 겹쳐서 */
  function elementsPentagon(list) {
    var colors = [cv('--cyan'), cv('--fire')];
    var axes = EL.map(function (k) { return { label: k, color: cv(EL_C[k]), sub: list.length === 1 ? String(list[0].elements[k]) : null }; });
    return pentagon(axes, list.map(function (p, i) { return { name: p.name, color: colors[i], values: EL.map(function (k) { return p.elements[k] || 0; }) }; }), { min: 3, label: 'Five elements' });
  }

  /** 관계 오각형: 친구들이 다섯 관계에 몇 명씩 */
  function relationsPentagon(entries) {
    var cnt = REL_K.map(function (k) { return entries.filter(function (e) { return e.relation === k; }).length; });
    var axes = REL_K.map(function (k, i) { return { label: WS.REL[k].n, color: cv(WS.REL[k].c), sub: String(cnt[i]) }; });
    return pentagon(axes, [{ name: 'Friends', color: cv('--cyan'), values: cnt }], { min: 2, label: 'Friends by relationship type' });
  }

  /** 연도별 흐름 (리포트 카드의 시기표에서): points [{label, score 1-5, tone}] */
  function yearsLine(points) {
    if (!points.length) return '';
    var W = 640, H = 280, L = 40, Rm = 30, T = 24, B = 64, n = points.length;
    var x = function (i) { return n === 1 ? W / 2 : L + i * (W - L - Rm) / (n - 1); };
    var y = function (v) { return T + (5 - v) * (H - T - B) / 4; };
    var h = ['<svg viewBox="0 0 ' + W + ' ' + H + '" class="yline" role="img" aria-label="Year by year outlook">'];
    for (var v = 1; v <= 5; v++) { h.push('<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="rgba(255,255,255,.07)"/><text x="' + (L - 12) + '" y="' + (y(v) + 6) + '" text-anchor="end" fill="#555" font-family="JetBrains Mono, monospace" font-size="17">' + v + '</text>'); }
    var path = points.map(function (p, i) { return (i ? 'L' : 'M') + x(i) + ',' + y(p.score); }).join(' ');
    var area = path + ' L' + x(n - 1) + ',' + y(1) + ' L' + x(0) + ',' + y(1) + ' Z';
    h.push('<defs><linearGradient id="yg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#00f0ff" stop-opacity=".35"/><stop offset="1" stop-color="#00f0ff" stop-opacity="0"/></linearGradient></defs>');
    h.push('<path d="' + area + '" fill="url(#yg)"/><path d="' + path + '" fill="none" stroke="#00f0ff" stroke-width="3.5" stroke-linejoin="round"/>');
    var now = String(new Date().getFullYear());
    points.forEach(function (p, i) {
      var col = p.tone === 'up' ? cv('--wood') : p.tone === 'down' ? '#ffb547' : '#ddd';
      h.push('<circle cx="' + x(i) + '" cy="' + y(p.score) + '" r="7" fill="#000" stroke="' + col + '" stroke-width="2.5"/>');
      h.push('<text x="' + x(i) + '" y="' + (H - 32) + '" text-anchor="middle" fill="' + (p.label.indexOf(now) === 0 ? '#00f0ff' : '#aaa') + '" font-family="JetBrains Mono, monospace" font-size="18">' + esc(short(p.label)) + '</text>');
    });
    var ni = points.findIndex(function (p) { return p.label.indexOf(now) === 0; });
    if (ni >= 0) h.push('<text x="' + x(ni) + '" y="' + (H - 8) + '" text-anchor="middle" fill="#00f0ff" font-family="JetBrains Mono, monospace" font-size="15" letter-spacing="1">NOW</text>');
    h.push('</svg>');
    return h.join('');
  }

  /** 축 이름 짧게: "2022-2023" → '22–'23, "October 2026" → Oct '26 */
  function short(l) {
    var r = /(\d{4})\s*[-–~]\s*(\d{2,4})/.exec(l);
    if (r) return "'" + r[1].slice(2) + "–'" + r[2].slice(-2);
    var m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(l);
    if (m) return m[1] + " '" + m[2].slice(2);
    var y = /\d{4}/.exec(l);
    return y ? y[0] : l.slice(0, 7);
  }

  /** 인스타 스토리 크기 이미지 (1080×1920). lines: {top, hanja, name, sub, foot, color, extra} */
  function storyImage(o) {
    var c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    var x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 1080, 1920);
    x.strokeStyle = 'rgba(0,240,255,0.07)'; x.lineWidth = 2;
    for (var g = 0; g <= 1080; g += 72) { x.beginPath(); x.moveTo(g, 0); x.lineTo(g, 1920); x.stroke(); }
    for (g = 0; g <= 1920; g += 72) { x.beginPath(); x.moveTo(0, g); x.lineTo(1080, g); x.stroke(); }
    var glow = x.createRadialGradient(540, 810, 20, 540, 810, 620); glow.addColorStop(0, hexA(o.color, .28)); glow.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = glow; x.fillRect(0, 0, 1080, 1920);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#00f0ff'; x.font = '600 34px "JetBrains Mono", monospace'; x.fillText('WITHSAJU', 540, 170);
    x.fillStyle = '#aaa'; x.font = '500 40px Inter, Arial, sans-serif'; wrap(x, o.top, 540, 330, 900, 54);
    if (o.art) x.drawImage(o.art, 160, 430, 760, 760);
    else { x.shadowColor = o.color; x.shadowBlur = 60; x.fillStyle = o.color; x.font = '700 420px "Noto Serif KR", serif'; x.fillText(o.hanja, 540, 800); x.shadowBlur = 0; }
    var ny = o.art ? 1250 : 1150;
    x.fillStyle = '#fff'; x.font = '800 ' + (o.name.length > 22 ? 76 : 96) + 'px Inter, Arial, sans-serif';
    var nl = wrap(x, o.name, 540, ny, 960, o.name.length > 22 ? 86 : 104);
    x.fillStyle = '#bbb'; x.font = '500 40px Inter, Arial, sans-serif'; wrap(x, o.sub, 540, ny + nl * (o.name.length > 22 ? 86 : 104) + 30, 900, 54);
    if (o.extra) { x.fillStyle = o.color; x.font = '700 60px "JetBrains Mono", monospace'; x.fillText(o.extra, 540, 1590); }
    // 아래 버튼 모양: 위 줄은 질문, 아래 줄은 주소 (길면 글자를 줄여서 한 줄에)
    var q = o.foot, url = '';
    var m = /^(.*\?)\s+(\S+)$/.exec(o.foot); if (m) { q = m[1]; url = m[2]; }
    x.fillStyle = '#00f0ff'; x.fillRect(140, 1640, 800, url ? 150 : 110);
    x.fillStyle = '#000'; x.font = '800 44px "JetBrains Mono", monospace'; x.fillText(q, 540, url ? 1690 : 1696);
    if (url) { var fs = 34; x.font = '600 ' + fs + 'px "JetBrains Mono", monospace'; while (x.measureText(url).width > 740 && fs > 18) { fs -= 2; x.font = '600 ' + fs + 'px "JetBrains Mono", monospace'; } x.fillText(url, 540, 1748); }
    return c;
  }
  function hexA(col, a) { var m = /^#?([0-9a-f]{6})$/i.exec(col.trim()); if (!m) return 'rgba(0,240,255,' + a + ')'; var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function wrap(x, text, cx, y, maxW, lh) {
    var words = String(text || '').split(' '), line = '', lines = [];
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    lines.forEach(function (l, i) { x.fillText(l, cx, y + i * lh); });
    return lines.length;
  }

  /** 이미지 저장·공유 (폰: 공유 시트에 이미지, PC: 파일 저장) */
  function shareImage(canvas, filename, text) {
    canvas.toBlob(function (blob) {
      var file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], text: text }).catch(function () {});
        return;
      }
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }, 'image/png');
  }

  /** 공유 버튼 줄 */
  function shareBar(el, url, text, onImage) {
    var u = encodeURIComponent(url), t = encodeURIComponent(text);
    el.innerHTML = '<div class="sharebar">' +
      (navigator.share ? '<button type="button" data-a="native">Share</button>' : '') +
      '<button type="button" data-a="copy">Copy link</button>' +
      (onImage ? '<button type="button" data-a="img">Story image</button>' : '') +
      '<a href="https://twitter.com/intent/tweet?text=' + t + '&url=' + u + '" target="_blank" rel="noopener">X</a>' +
      '<a href="https://www.facebook.com/sharer/sharer.php?u=' + u + '" target="_blank" rel="noopener">Facebook</a>' +
      '<a href="https://wa.me/?text=' + t + '%20' + u + '" target="_blank" rel="noopener">WhatsApp</a>' +
      '<a href="sms:?&body=' + t + '%20' + u + '">Text</a>' +
      '</div><p class="copied"></p>';
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var out = el.querySelector('.copied');
      if (b.dataset.a === 'native') navigator.share({ title: text, text: text, url: url }).catch(function () {});
      if (b.dataset.a === 'copy') { try { navigator.clipboard.writeText(url).then(function () { out.textContent = 'COPIED // ' + url; }, function () { out.textContent = url; }); } catch (x) { out.textContent = url; } }
      if (b.dataset.a === 'img' && onImage) onImage();
    });
  }

  window.WSCharts = { pentagon: pentagon, elementsPentagon: elementsPentagon, relationsPentagon: relationsPentagon, yearsLine: yearsLine, storyImage: storyImage, shareImage: shareImage, shareBar: shareBar, cv: cv };
})();
