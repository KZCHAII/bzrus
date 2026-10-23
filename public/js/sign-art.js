// 네온 "스피릿 애니멀" 그림: 일지 동물 + 일간 색(오방색) + 태어난 계절. 코드로 그려서 무료·즉시.
(function (root) {
  // 오방색: 목=푸른, 화=붉은, 토=노란, 금=흰, 수=검은(네온에서는 보라빛)
  var COLOR = {
    Wood: { name: "Blue", yang: "#29c4ff", yin: "#7fdcff" },
    Fire: { name: "Red", yang: "#ff3b5c", yin: "#ff7a8f" },
    Earth: { name: "Yellow", yang: "#ffcc33", yin: "#ffe08a" },
    Metal: { name: "White", yang: "#f4f6ff", yin: "#d8def5" },
    Water: { name: "Black", yang: "#8a5cff", yin: "#b39bff" },
  };
  var SEASON_C = { Spring: "#ff8fc8", Summer: "#ffb020", Autumn: "#ff7a2f", Winter: "#bfe9ff" };

  function rnd(seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
  function seedOf(str) { var h = 7; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 2147483647; return h; }

  function blossom(x, y, r, c, rot) {
    var p = "";
    for (var i = 0; i < 5; i++) { var a = rot + i * 72 * Math.PI / 180; p += '<ellipse cx="' + (x + Math.cos(a) * r * .55).toFixed(1) + '" cy="' + (y + Math.sin(a) * r * .55).toFixed(1) + '" rx="' + (r * .45).toFixed(1) + '" ry="' + (r * .3).toFixed(1) + '" transform="rotate(' + (a * 180 / Math.PI).toFixed(0) + ' ' + (x + Math.cos(a) * r * .55).toFixed(1) + ' ' + (y + Math.sin(a) * r * .55).toFixed(1) + ')" fill="' + c + '" fill-opacity=".55"/>'; }
    return p + '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (r * .18).toFixed(1) + '" fill="#fff" fill-opacity=".8"/>';
  }
  function leaf(x, y, r, c, rot) {
    return '<path transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + (r / 10).toFixed(2) + ')" d="M0,-10 L3,-4 L9,-6 L6,0 L10,4 L3,3 L2,10 L0,6 L-2,10 L-3,3 L-10,4 L-6,0 L-9,-6 L-3,-4 Z" fill="' + c + '" fill-opacity=".5" stroke="' + c + '" stroke-width=".6"/>';
  }
  function flake(x, y, r, c) {
    var p = '<g stroke="' + c + '" stroke-width="1.4" stroke-linecap="round" opacity=".75">';
    for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; p += '<line x1="' + x.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + (x + Math.cos(a) * r).toFixed(1) + '" y2="' + (y + Math.sin(a) * r).toFixed(1) + '"/>'; }
    return p + "</g>";
  }

  /** o: {animal, element, yang, season, hanja} → SVG 문자열 */
  function svg(o, size) {
    var col = (COLOR[o.element] || COLOR.Water)[o.yang ? "yang" : "yin"], sc = SEASON_C[o.season] || "#fff";
    var R = rnd(seedOf(o.hanja + o.season)), id = "a" + seedOf(o.hanja + o.season + (o.bare ? "b" : "") + String(Math.random()).slice(2, 8));
    var h = ['<svg viewBox="0 0 600 600" width="' + (size || 600) + '" height="' + (size || 600) + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + (COLOR[o.element] || {}).name + " " + o.animal + " of " + o.season + '">'];
    h.push('<defs><filter id="' + id + 'g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="' + id + 's" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<radialGradient id="' + id + 'r"><stop offset="0" stop-color="' + col + '" stop-opacity=".28"/><stop offset=".6" stop-color="' + col + '" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>');
    if (!o.bare) h.push('<rect width="600" height="600" fill="#000"/>');
    for (var g = 0; !o.bare && g <= 600; g += 40) h.push('<line x1="' + g + '" y1="0" x2="' + g + '" y2="600" stroke="rgba(0,240,255,.05)"/><line x1="0" y1="' + g + '" x2="600" y2="' + g + '" stroke="rgba(0,240,255,.05)"/>');
    h.push('<circle cx="300" cy="300" r="290" fill="url(#' + id + 'r)"/>');
    // 계절 배경
    var deco = [];
    if (o.season === "Summer") {
      deco.push('<g filter="url(#' + id + 's)" opacity=".7">');
      for (var k = 0; k < 24; k++) { var a = k * Math.PI / 12; deco.push('<line x1="' + (300 + Math.cos(a) * 250).toFixed(1) + '" y1="' + (300 + Math.sin(a) * 250).toFixed(1) + '" x2="' + (300 + Math.cos(a) * (k % 2 ? 278 : 292)).toFixed(1) + '" y2="' + (300 + Math.sin(a) * (k % 2 ? 278 : 292)).toFixed(1) + '" stroke="' + sc + '" stroke-width="3" stroke-linecap="round"/>'); }
      deco.push('<circle cx="300" cy="300" r="268" fill="none" stroke="' + sc + '" stroke-width="1.5" stroke-dasharray="2 9"/></g>');
    }
    for (var i = 0; i < 26; i++) {
      var x = R() * 600, y = R() * 600, rr = 6 + R() * 12;
      if (Math.hypot(x - 300, y - 300) < 170) continue;
      if (o.season === "Spring") deco.push(blossom(x, y, rr, sc, R() * 6));
      else if (o.season === "Autumn") deco.push(leaf(x.toFixed(1), y.toFixed(1), rr, i % 3 ? sc : "#ffcc33", (R() * 360).toFixed(0)));
      else if (o.season === "Winter") deco.push(flake(x, y, rr * .8, sc));
      else if (i % 3 === 0) deco.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (rr / 4).toFixed(1) + '" fill="' + sc + '" opacity=".6"/>');
    }
    h.push(deco.join(""));
    // 네온 원 + 동물
    h.push('<circle cx="300" cy="300" r="228" fill="none" stroke="' + col + '" stroke-width="3" filter="url(#' + id + 'g)" opacity=".9"/>');
    h.push('<circle cx="300" cy="300" r="214" fill="none" stroke="' + col + '" stroke-width="1" opacity=".35"/>');
    var body = (root.WS_ANIMALS || {})[o.animal] || "";
    h.push('<g transform="translate(120 112) scale(0.703)" filter="url(#' + id + 'g)"><g fill="' + col + '" fill-opacity=".14" stroke="' + col + '" stroke-width="5" stroke-linejoin="round">' + body + "</g></g>");
    h.push('<text x="300" y="566" text-anchor="middle" font-family="Noto Serif KR, serif" font-weight="700" font-size="30" fill="' + col + '" letter-spacing="6" filter="url(#' + id + 's)">' + o.hanja + "</text>");
    h.push("</svg>");
    return h.join("");
  }

  /** 그림을 캔버스에 그리기 (스토리 이미지용) */
  function toImage(o, size, cb) {
    var img = new Image();
    img.onload = function () { cb(img); };
    img.onerror = function () { cb(null); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg(Object.assign({ bare: true }, o), size));
  }

  root.WSArt = { svg: svg, toImage: toImage, COLOR: COLOR };
})(typeof window !== "undefined" ? window : globalThis);
