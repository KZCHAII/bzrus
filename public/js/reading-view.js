// 상세 리포트 화면: 사주 원국(계산값) + 섹션별 카드 + 원래 글 전부 (BZR 카드 결과지의 영어판)
(function () {
  var esc = WS.esc;
  var EL_VAR = WS.EL_VAR;
  var TG = { companion: "Companion", rob: "Rob Wealth", eating: "Eating God", hurting: "Hurting Officer", indirectWealth: "Indirect Wealth", directWealth: "Direct Wealth", sevenKillings: "Seven Killings", directOfficer: "Direct Officer", indirectResource: "Indirect Resource", directResource: "Direct Resource", self: "Day Master" };
  var TONE = { up: "Good", down: "Careful", mix: "Turning" };

  function allSections(text) {
    var list = [], cur = null;
    String(text || "").replace(/\r/g, "").split(/\n+/).forEach(function (raw) {
      var l = raw.trim(); if (!l) return;
      var m = l.match(/^#{1,3}\s*(.+)$/);
      if (m) { cur = { title: m[1].trim(), paras: [] }; list.push(cur); return; }
      if (cur) cur.paras.push(l.replace(/\*\*/g, ""));
    });
    return list;
  }
  function mini(cls, label, p) {
    if (!p || (!p.title && !p.desc)) return "";
    return '<div class="mini ' + cls + '">' + (label ? '<div class="label">' + esc(label) + "</div>" : "") + (p.title ? "<h3>" + esc(p.title) + "</h3>" : "") + "<p>" + esc(p.desc) + "</p></div>";
  }
  function details(paras, q) {
    if (!paras.length) return "";
    return '<details open><summary>Read the full section</summary>' + paras.map(function (p) {
      var e = esc(p);
      if (q) e = e.split(esc(q)).join('<strong class="hl">' + esc(q) + "</strong>");
      return "<p>" + e + "</p>";
    }).join("") + "</details>";
  }
  var NO = 0;
  function head(title, id) { NO++; return '<section class="sec" id="rc-' + id + '"><div class="sec-head"><span class="sec-no">' + (NO < 10 ? "0" : "") + NO + "</span><h2>" + esc(title) + "</h2></div>"; }

  function chartHtml(d) {
    var c = d.chart, P = c.pillars, h = [];
    var cell = function (label, p) {
      if (!p) return '<div class="unk"><dt>' + label + '</dt><dd><span class="ph">??</span><span class="pr">time unknown</span></dd></div>';
      return '<div' + (label === "Day" ? ' class="me"' : "") + '><dt>' + label + '</dt><dd><span class="ph"><span style="color:var(' + EL_VAR[p.stem.element] + ')">' + esc(p.stem.han) + '</span><span style="color:var(' + EL_VAR[p.branch.element] + ')">' + esc(p.branch.han) + '</span></span><span class="pr">' + esc(p.roman) + '</span><span class="tgod">' + esc(TG[p.stem.tenGod]) + "<br>" + esc(p.branch.animal) + "</span></dd></div>";
    };
    h.push(head("Your Saju chart", "chart") + '<div class="card" style="--el:var(' + EL_VAR[c.sign.element] + ')">');
    if (window.WSArt && c.sign.animal) h.push('<div class="chart-art"><div class="art">' + WSArt.svg({ animal: c.sign.animal.name, element: c.sign.element, yang: c.sign.yang, season: c.sign.season, hanja: c.sign.dayPillar.han }) + '</div><div><div class="label" style="color:var(--cyan)">' + esc(c.sign.name) + '</div><div class="big" style="font-size:20px">' + esc(c.sign.title || (c.sign.animal.color + " " + c.sign.animal.name)) + "</div><p>" + esc(c.sign.tagline) + " The " + esc(c.sign.animal.name.toLowerCase()) + ": " + esc(c.sign.animal.line) + ".</p></div></div>");
    h.push('<div class="label">Four pillars</div><dl class="pillars" style="margin-bottom:18px">' + cell("Year", P.year) + cell("Month", P.month) + cell("Day", P.day) + cell("Hour", P.hour) + "</dl>");
    if (window.WSCharts) h.push('<div class="label">Five elements</div>' + WSCharts.elementsPentagon([{ name: d.name, elements: c.elements, hidden: c.hidden }]));
    var HD = c.hidden || {};
    var max = Math.max.apply(null, Object.keys(c.elements).map(function (k) { return c.elements[k] + (HD[k] || 0); }).concat([1]));
    h.push('<div class="elbar" style="margin-top:6px">' + ["Wood", "Fire", "Earth", "Metal", "Water"].map(function (k) {
      var v = c.elements[k], hv = HD[k] || 0;
      return '<div><div class="nm" style="color:var(' + EL_VAR[k] + ')"><span>' + k + "</span><b>" + v + (hv ? ' <small>+' + hv + '</small>' : '') + '</b></div><div class="tr"><i style="width:' + Math.round(v / max * 100) + "%;background:var(" + EL_VAR[k] + ')"></i>' + (hv ? '<i class="hid" style="left:' + Math.round(v / max * 100) + '%;width:' + Math.round(hv / max * 100) + '%;--c:var(' + EL_VAR[k] + ')"></i>' : '') + '</div></div>';
    }).join("") + "</div>");
    if (c.hidden) { var hn = WSCharts.hiddenNote({ elements: c.elements, hidden: c.hidden, hiddenSpots: c.hiddenSpots }, true); h.push('<p class="hnote">' + (hn || '') + (hn ? '<br>' : '') + '<span>Solid = elements on the surface. Dashed / striped = hidden stems (地藏干) inside your branches: potential that shows up when a year or cycle calls it out.</span></p>'); }
    var age = new Date().getFullYear() - Number(d.birthday.slice(0, 4));
    h.push('<div class="label mt">10-year luck cycles · starts at age ' + c.luck.startAge + '</div><div class="luck">' + c.luck.cycles.map(function (x) {
      var now = age >= x.startAge && age <= x.endAge;
      return '<div' + (now ? ' class="now"' : "") + '><div class="a">AGE ' + x.startAge + "–" + x.endAge + '</div><div class="h"><span style="color:var(' + EL_VAR[x.pillar.stem.element] + ')">' + esc(x.pillar.stem.han) + '</span><span style="color:var(' + EL_VAR[x.pillar.branch.element] + ')">' + esc(x.pillar.branch.han) + '</span></div><div class="y">' + (now ? "NOW" : "FROM " + x.startYear) + "</div></div>";
    }).join("") + "</div>");
    h.push('<p class="note" style="text-align:left;margin-top:12px">Calculated from your exact birth moment and the solar terms. The reading below interprets these values.</p></div></section>');
    return h.join("");
  }

  // 지금 대운: 지배하는 에너지 + 원국에 더해진 오행 + 영역별 영향
  function energyHtml(d, c) {
    var cur = d.chart.current; if (!cur) return "";
    var p = cur.cycle.pillar, h = [];
    h.push('<div class="energy"><div class="eh"><span style="color:var(' + EL_VAR[p.stem.element] + ')">' + esc(p.stem.han) + '</span><span style="color:var(' + EL_VAR[p.branch.element] + ')">' + esc(p.branch.han) + "</span></div>");
    h.push('<div class="et"><div class="label" style="color:var(--cyan)">Now · ages ' + cur.cycle.startAge + "–" + cur.cycle.endAge + "</div>");
    h.push('<div class="big" style="font-size:20px">' + esc((c && c.cycle && c.cycle.theme) || (p.stem.element + " over " + p.branch.element)) + "</div>");
    h.push("<p>" + esc(p.stem.yang ? "Yang " : "Yin ") + esc(p.stem.element) + " brings " + esc(cur.plain[0]) + ". " + esc(p.branch.animal) + " " + esc(p.branch.element) + " brings " + esc(cur.plain[1]) + ".</p></div></div>");
    var areas = (c && c.cycle && c.cycle.areas) || [];
    h.push('<div class="twocol mt"><div><div class="label">Your elements, with this cycle added</div>' + WSCharts.elementsPentagon([{ name: "Your chart", elements: d.chart.elements }, { name: "This cycle", elements: cur.withCycle }]) + "</div>");
    if (areas.length) {
      h.push('<div><div class="label">How this cycle hits each area</div><div class="impact">' + areas.map(function (a) {
        var m = ""; for (var k = 1; k <= 5; k++) m += "<b" + (k <= a.score ? ' class="on s' + a.score + '"' : "") + "></b>";
        return '<div class="im"><div class="ir"><span>' + esc(a.area) + '</span><span class="meter">' + m + '</span></div><p>' + esc(a.note) + "</p></div>";
      }).join("") + "</div></div>");
    }
    h.push("</div>");
    return h.join("");
  }

  // 나에게 맞는 사람: 계산된 추천 사인 + 글에서 뽑은 성향
  function fitHtml(d, c) {
    var m = d.chart.match; if (!m || !m.signs || !m.signs.length) return "";
    var h = ['<div class="label">Korean signs that fit you · your chart needs ' + esc(m.needs.join(" + ")) + '</div><div class="fits">'];
    m.signs.forEach(function (x) { h.push('<div class="fitc" style="--fc:var(' + EL_VAR[x.element] + ')"><span class="fh">' + esc(x.hanja) + "</span><b>" + esc(x.name) + "</b><p>" + esc(x.why) + "</p></div>"); });
    h.push("</div>");
    var A = m.animals;
    if (A && A.best && A.best.length) {
      h.push('<div class="label mt">Spirit animals that fit yours</div><div class="chipsrow">' + A.best.map(function (a) { return '<span class="lchip good"><b>' + esc(a.han) + " " + esc(a.animal) + "</b> " + esc(a.label) + "</span>"; }).join("") + "</div>");
      if (A.picks && A.picks.length) h.push('<div class="label mt">Your best pairings · the color you need × an animal that fits</div><div class="fits">' + A.picks.map(function (p) {
        return '<div class="fitc" style="--fc:var(' + EL_VAR[p.element] + ')">' + (window.WSArt ? '<div class="fart">' + WSArt.svg({ animal: p.title.split(" ")[1], element: p.element, yang: "甲丙戊庚壬".indexOf(p.han.charAt(0)) >= 0, season: ({ Wood: "Spring", Fire: "Summer", Earth: "Summer", Metal: "Autumn", Water: "Winter" })[p.element], hanja: p.han, bare: true }) + "</div>" : "") + "<b>" + esc(p.title) + " " + esc(p.han) + "</b><p>" + esc(p.why.charAt(0).toUpperCase() + p.why.slice(1)) + ".</p></div>";
      }).join("") + "</div>");
      if (A.avoid && A.avoid.length) h.push('<div class="label mt">Be careful with</div><div class="chipsrow">' + A.avoid.map(function (a) { return '<span class="lchip bad"><b>' + esc(a.han) + " " + esc(a.animal) + "</b> " + esc(a.label) + "</span>"; }).join("") + "</div>");
    }
    var f = c && c.fit;
    if (f && f.summary) {
      h.push('<div class="big mt" style="font-size:18px">' + esc(f.summary) + "</div>");
      if (f.traits && f.traits.length) h.push('<div class="grid2 mt">' + f.traits.map(function (t) { return mini("good", "", t); }).join("") + "</div>");
      if (f.avoid) h.push('<div class="mini warn mt"><div class="label">Drains you</div><p>' + esc(f.avoid) + "</p></div>");
    }
    var maps = WS.me.maps();
    h.push('<p class="note mt" style="text-align:left">Know someone with one of these signs? ' + (maps.length ? '<a href="/m/' + esc(maps[0].slug) + '" style="color:var(--cyan)">Send them your page</a> and see your match.' : '<a href="/" style="color:var(--cyan)">Make your page</a> and send it to them.') + "</p>");
    return h.join("");
  }

  // 개운법: 부족한 오행을 채우는 방법
  function boostHtml(d) {
    var m = d.chart.match; if (!m || !m.boosters || !m.boosters.length) return "";
    return '<div class="boosts">' + m.boosters.map(function (b) {
      return '<div class="boost" style="--fc:var(' + EL_VAR[b.element] + ')"><div class="label" style="color:var(--fc)">Add ' + esc(b.element) + " · wear " + esc(b.color.toLowerCase()) + "</div><ul>" + b.items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul></div>";
    }).join("") + "</div>";
  }

  /** d: /api/readings 응답 (status done) */
  function render(el, d) {
    NO = 0; var usedEnergy = false, usedFit = false, usedBoost = false;
    var c = d.cards || null, secs = allSections(d.text), h = [];
    var byHead = {}; ((c && c.sections) || []).forEach(function (x) { byHead[x.heading] = x; });
    var first = secs.length && /report/i.test(secs[0].title) && !byHead[secs[0].title] ? secs.shift() : null;
    var lastLine = "";
    var tail = secs[secs.length - 1];
    if (tail && /^\(.*\)$/.test(tail.title)) {
      // 마지막 "(One sentence to carry with you)" 섹션: 문장이 아래에 있으면 그 문장, 제목 자리에 썼으면 제목
      secs.pop();
      lastLine = tail.paras.length ? tail.paras.join(" ") : tail.title.replace(/^\(|\)$/g, "");
    } else if (tail && !tail.paras.length) lastLine = secs.pop().title.replace(/^\(|\)$/g, "");
    if (!lastLine && c && c.final && c.final.last_line) lastLine = c.final.last_line;

    var toc = [];
    if (c) toc.push(["core", "Conclusion"]);
    toc.push(["chart", "Chart"]);
    secs.forEach(function (s, i) { toc.push(["s" + i, s.title.replace(/:.*$/, "").replace(/^Your /, "").slice(0, 16)]); });
    toc.push(["end", "Last word"]);
    var tocAt = h.length; h.push("");
    if (!c && d.cardsPending) h.push('<div class="wait">BUILDING YOUR SUMMARY CARDS. THE FULL TEXT IS READY BELOW</div>');
    if (first && first.paras.length) h.push('<p class="note" style="text-align:left;margin:-8px 0 18px">' + esc(first.paras.join(" ")) + "</p>");

    if (c) {
      var core = c.core || {};
      h.push('<section class="sec" id="rc-core" style="margin-top:0"><div class="card hero"><span class="corner"></span><span class="corner-br"></span>');
      h.push('<div class="label" style="color:var(--cyan)">Core insight</div><div class="big">' + esc(core.headline) + "</div><p>" + esc(core.body) + "</p>");
      h.push('<div class="grid2 mt">' + mini("good", "Biggest opening", core.strength) + mini("warn", "Watch most", core.caution) + "</div></div></section>");
    }
    // 연도별 흐름: 리포트 카드의 시기표(과거 5년·다음 5년)를 한 줄 그래프로
    if (c && window.WSCharts) {
      var pts = [];
      (c.sections || []).forEach(function (x) { if (x.kind === "timeline") (x.timeline || []).forEach(function (t) { pts.push({ label: t.label, score: t.score, tone: t.tone }); }); });
      pts.sort(function (a, b) { return (parseInt(a.label.match(/\d{4}/) || [0], 10)) - (parseInt(b.label.match(/\d{4}/) || [0], 10)); });
      if (pts.length >= 3) {
        h.push(head("Your years at a glance", "years") + '<div class="card"><div class="label">Opportunity by period · 1 low – 5 high</div>' + WSCharts.yearsLine(pts) +
          '<p class="note" style="text-align:left">From the year-by-year sections of your reading. Green = good stretch, amber = be careful.</p></div></section>');
        toc.splice(1, 0, ["years", "Years"]);
      }
    }
    h.push(chartHtml(d));

    secs.forEach(function (sec, i) {
      var cd = byHead[sec.title];
      h.push(head(sec.title, "s" + i) + '<div class="card">');
      var special = false;
      if (/^Your Current 10-Year Cycle/i.test(sec.title) && window.WSCharts) { h.push(energyHtml(d, c)); usedEnergy = special = true; }
      if (/^Who Fits You/i.test(sec.title)) { h.push(fitHtml(d, c)); usedFit = special = true; }
      if (/^Boost Your Luck/i.test(sec.title)) { h.push(boostHtml(d)); usedBoost = special = true; }
      if (cd && !special) {
        if (cd.summary) h.push('<p style="font-size:15.5px;color:var(--text-1)">' + esc(cd.summary) + "</p>");
        if (cd.kind === "timeline" && cd.timeline && cd.timeline.length) {
          h.push('<div class="tl mt">');
          cd.timeline.forEach(function (t) {
            var tone = TONE[t.tone] ? t.tone : "mix", m = "";
            for (var k = 1; k <= 5; k++) m += "<b" + (k <= t.score ? ' class="on"' : "") + "></b>";
            h.push('<div class="tl-item ' + tone + '"><div class="tl-top"><span class="yr">' + esc(t.label) + '</span><span class="tg ' + tone + '">' + TONE[tone] + '</span><span class="meter">' + m + "</span></div><h4>" + esc(t.title) + "</h4><p>" + esc(t.desc) + "</p></div>");
          });
          h.push("</div>");
        } else if (cd.kind === "qa" && cd.qa && cd.qa.length) {
          cd.qa.forEach(function (q) { h.push('<div class="mini mt"><div class="faq-q">Q. ' + esc(String(q.q).replace(/^Q[.:]\s*/, "")) + "</div><p>" + esc(q.a) + "</p></div>"); });
        } else if (cd.points && cd.points.length) {
          h.push('<div class="grid2 mt">' + cd.points.map(function (p) { return mini("", "", p); }).join("") + "</div>");
        }
      }
      var q = (cd && cd.highlight) || "";
      if (q) h.push('<div class="pull">' + esc(q) + "</div>");
      h.push(details(sec.paras, q) + "</div></section>");
    });

    // 예전 리포트(이 섹션들이 없던 때)에도 그래프는 보여 준다
    if (!usedEnergy && d.chart.current && window.WSCharts) h.push(head("Your current 10-year energy", "energy") + '<div class="card">' + energyHtml(d, null) + "</div></section>");
    if (!usedFit) h.push(head("Who fits you", "fit") + '<div class="card">' + fitHtml(d, null) + "</div></section>");
    if (!usedBoost) h.push(head("Boost your luck", "boost") + '<div class="card">' + boostHtml(d) + "</div></section>");
    h.push(head("Last word", "end"));
    if (c && c.final && c.final.conclusion) h.push('<div class="card"><div class="label">In one line</div><p style="font-size:16px;color:var(--text-1)">' + esc(c.final.conclusion) + "</p></div>");
    if (lastLine) h.push('<div class="card final"><span class="corner"></span><span class="corner-br"></span><div class="label">One sentence to carry with you</div><div class="line">' + esc(lastLine) + "</div></div>");
    h.push("</section>");

    h[tocAt] = '<div class="toc" role="navigation">' + toc.map(function (t) { return '<a href="#rc-' + t[0] + '">' + esc(t[1]) + "</a>"; }).join("") + "</div>";
    el.innerHTML = '<div class="rc">' + h.join("") + "</div>";
    Array.prototype.forEach.call(el.querySelectorAll(".toc a"), function (a) {
      a.addEventListener("click", function (e) { var t = el.querySelector(a.getAttribute("href")); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth", block: "start" }); } });
    });
  }

  window.WSReading = { render: render };
})();
