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
    h.push('<div class="label">Four pillars</div><dl class="pillars" style="margin-bottom:18px">' + cell("Year", P.year) + cell("Month", P.month) + cell("Day", P.day) + cell("Hour", P.hour) + "</dl>");
    var max = Math.max.apply(null, Object.keys(c.elements).map(function (k) { return c.elements[k]; }).concat([1]));
    h.push('<div class="label">Five elements</div><div class="elbar">' + ["Wood", "Fire", "Earth", "Metal", "Water"].map(function (k) {
      return '<div><div class="nm" style="color:var(' + EL_VAR[k] + ')"><span>' + k + "</span><b>" + c.elements[k] + '</b></div><div class="tr"><i style="width:' + Math.round(c.elements[k] / max * 100) + "%;background:var(" + EL_VAR[k] + ')"></i></div></div>';
    }).join("") + "</div>");
    var age = new Date().getFullYear() - Number(d.birthday.slice(0, 4));
    h.push('<div class="label mt">10-year luck cycles · starts at age ' + c.luck.startAge + '</div><div class="luck">' + c.luck.cycles.map(function (x) {
      var now = age >= x.startAge && age <= x.endAge;
      return '<div' + (now ? ' class="now"' : "") + '><div class="a">AGE ' + x.startAge + "–" + x.endAge + '</div><div class="h"><span style="color:var(' + EL_VAR[x.pillar.stem.element] + ')">' + esc(x.pillar.stem.han) + '</span><span style="color:var(' + EL_VAR[x.pillar.branch.element] + ')">' + esc(x.pillar.branch.han) + '</span></div><div class="y">' + (now ? "NOW" : "FROM " + x.startYear) + "</div></div>";
    }).join("") + "</div>");
    h.push('<p class="note" style="text-align:left;margin-top:12px">Calculated from your exact birth moment and the solar terms. The reading below interprets these values.</p></div></section>');
    return h.join("");
  }

  /** d: /api/readings 응답 (status done) */
  function render(el, d) {
    NO = 0;
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
    h.push('<div class="toc" role="navigation">' + toc.map(function (t) { return '<a href="#rc-' + t[0] + '">' + esc(t[1]) + "</a>"; }).join("") + "</div>");
    if (!c && d.cardsPending) h.push('<div class="wait">BUILDING YOUR SUMMARY CARDS. THE FULL TEXT IS READY BELOW</div>');
    if (first && first.paras.length) h.push('<p class="note" style="text-align:left;margin:-8px 0 18px">' + esc(first.paras.join(" ")) + "</p>");

    if (c) {
      var core = c.core || {};
      h.push('<section class="sec" id="rc-core" style="margin-top:0"><div class="card hero"><span class="corner"></span><span class="corner-br"></span>');
      h.push('<div class="label" style="color:var(--cyan)">Core insight</div><div class="big">' + esc(core.headline) + "</div><p>" + esc(core.body) + "</p>");
      h.push('<div class="grid2 mt">' + mini("good", "Biggest opening", core.strength) + mini("warn", "Watch most", core.caution) + "</div></div></section>");
    }
    h.push(chartHtml(d));

    secs.forEach(function (sec, i) {
      var cd = byHead[sec.title];
      h.push(head(sec.title, "s" + i) + '<div class="card">');
      if (cd) {
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

    h.push(head("Last word", "end"));
    if (c && c.final && c.final.conclusion) h.push('<div class="card"><div class="label">In one line</div><p style="font-size:16px;color:var(--text-1)">' + esc(c.final.conclusion) + "</p></div>");
    if (lastLine) h.push('<div class="card final"><span class="corner"></span><span class="corner-br"></span><div class="label">One sentence to carry with you</div><div class="line">' + esc(lastLine) + "</div></div>");
    h.push("</section>");

    el.innerHTML = '<div class="rc">' + h.join("") + "</div>";
    Array.prototype.forEach.call(el.querySelectorAll(".toc a"), function (a) {
      a.addEventListener("click", function (e) { var t = el.querySelector(a.getAttribute("href")); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth", block: "start" }); } });
    });
  }

  window.WSReading = { render: render };
})();
