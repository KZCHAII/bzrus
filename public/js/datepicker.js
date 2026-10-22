// 생년월일 선택기 (BZR에서 가져옴): 모바일은 드래그 휠, PC는 드롭다운. hidden input에 YYYY-MM-DD로 넣어 준다.
// ─── BZR Custom Date Picker ────────────────────────────────────────
// 모바일 브라우저(특히 안드로이드)의 native date picker가 연도 변경이
// 너무 어려운 문제를 해결하기 위한 커스텀 컴포넌트.
// hidden input의 value를 YYYY-MM-DD 형식으로 동기화하므로
// 기존 검증/제출 로직 변경 불필요.
(function(){
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const CURRENT_YEAR = new Date().getFullYear();
  const MIN_YEAR = 1920;
  const MAX_YEAR = CURRENT_YEAR;

  function daysInMonth(year, month){
    if (!year || !month) return 31;
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  }

  function pad2(n){ return String(n).padStart(2,'0'); }

  // 인라인 popover (전역 1개 재사용)
  let modal, currentPicker = null;
  let bzrDpScrollY = null;
  const ITEM_H = 40;       // 데스크톱
  const ITEM_H_M = 44;     // 모바일
  const VISIBLE = 5;        // 보이는 아이템 수 (홀수)

  function isMobile(){ return window.innerWidth <= 600; }
  function itemH(){ return isMobile() ? ITEM_H_M : ITEM_H; }
  function centerOffset(){ return Math.floor(VISIBLE/2) * itemH(); }

  function ensureModal(){
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'bzr-dp-modal';
    modal.innerHTML = ''
      + '<div class="bzr-dp-card">'
      + '  <div class="bzr-dp-card-head">'
      + '    <span class="bzr-dp-card-title" id="bzrDpCardTitle">SELECT BIRTH DATE</span>'
      + '    <button type="button" class="bzr-dp-card-x" aria-label="Close">×</button>'
      + '  </div>'
      + '  <div class="bzr-dp-wheels" id="bzrDpWheels">'
      + '    <div class="bzr-dp-wheel" data-w="month"><div class="bzr-dp-wheel-inner"></div></div>'
      + '    <div class="bzr-dp-wheel" data-w="day"><div class="bzr-dp-wheel-inner"></div></div>'
      + '    <div class="bzr-dp-wheel" data-w="year"><div class="bzr-dp-wheel-inner"></div></div>'
      + '    <div class="bzr-dp-band"></div>'
      + '    <div class="bzr-dp-fade-top"></div>'
      + '    <div class="bzr-dp-fade-btm"></div>'
      + '  </div>'
      + '  <div class="bzr-dp-labels"><span>MONTH</span><span>DAY</span><span>YEAR</span></div>'
      + '  <div class="bzr-dp-foot">'
      + '    <button type="button" class="bzr-dp-btn bzr-dp-btn-cancel">Cancel</button>'
      + '    <button type="button" class="bzr-dp-btn bzr-dp-btn-confirm">Done →</button>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(modal);

    // 닫기 버튼 (× 또는 취소)
    modal.querySelector('.bzr-dp-card-x').addEventListener('click', closeModal);
    modal.querySelector('.bzr-dp-btn-cancel').addEventListener('click', closeModal);

    // 백드롭 클릭은 의도적으로 무시 — 조작 미스 방지

    // 선택 완료
    modal.querySelector('.bzr-dp-btn-confirm').addEventListener('click', confirmSelection);

    // ESC로 닫기
    document.addEventListener('keydown', function(e){
      if (modal.classList.contains('is-open') && e.key === 'Escape') closeModal();
    });

    // 휠 초기화 (한 번만)
    initWheels();
  }

  // 휠 객체 저장소 — 각 휠의 현재 상태
  const wheels = {};

  function initWheels(){
    ['year','month','day'].forEach(function(name){
      const el = modal.querySelector('[data-w="'+name+'"]');
      const inner = el.querySelector('.bzr-dp-wheel-inner');
      const w = {
        name: name,
        el: el,
        inner: inner,
        items: [],
        selectedIdx: 0,
        offset: 0,
        startY: 0,
        startOffset: 0,
        dragging: false,
        samples: [],
        rafId: null,
        _transitionTimer: null,
      };
      wheels[name] = w;
      attachWheelHandlers(w);
    });
  }

  function attachWheelHandlers(w){
    // velocity 추적: 최근 100ms 이동 기록
    function recordSample(y){
      const now = performance.now();
      w.samples.push({ y:y, t:now });
      // 100ms보다 오래된 샘플 제거
      while (w.samples.length > 1 && now - w.samples[0].t > 100) {
        w.samples.shift();
      }
    }
    function calcVelocity(){
      if (w.samples.length < 2) return 0;
      // 마지막 샘플은 손가락 떼기 직전 반동이라 무시 (있을 때만)
      // 즉 끝에서 두 번째 vs 처음 샘플로 계산
      const first = w.samples[0];
      const last = w.samples.length >= 3
        ? w.samples[w.samples.length - 2]
        : w.samples[w.samples.length - 1];
      const dt = last.t - first.t;
      if (dt <= 0) return 0;
      return (last.y - first.y) / dt; // px/ms
    }
    // 총 이동 거리 (drag 시작 ~ 마지막 샘플) - flick 감지용
    function getTotalDelta(){
      if (w.samples.length < 2) return 0;
      return w.samples[w.samples.length - 1].y - w.samples[0].y;
    }
    // 마지막 샘플의 시간 (떼는 순간이 빨랐는지 판정용)
    function getDuration(){
      if (w.samples.length < 2) return 0;
      return w.samples[w.samples.length - 1].t - w.samples[0].t;
    }

    function onDown(e){
      e.preventDefault();
      const y = (e.touches ? e.touches[0].clientY : e.clientY);
      // stopMomentum이 진행 중인 transition을 멈추고 w.offset을 화면값으로 sync
      stopMomentum(w);
      // 추가 안전: transition이 정말 꺼졌는지 한 번 더 확인하고 startOffset 결정
      w.dragging = true;
      w.startY = y;
      w.startOffset = w.offset;
      w.samples = [{ y:y, t:performance.now() }];
      w.el.style.cursor = 'grabbing';
    }
    function onMove(e){
      if (!w.dragging) return;
      const y = (e.touches ? e.touches[0].clientY : e.clientY);
      e.preventDefault();
      const dy = y - w.startY;
      setOffset(w, w.startOffset + dy);
      recordSample(y);
    }
    function onUp(){
      if (!w.dragging) return;
      w.dragging = false;
      w.el.style.cursor = 'grab';
      const v = calcVelocity();
      const totalDelta = getTotalDelta();
      const duration = getDuration();
      startMomentum(w, v, totalDelta, duration);
    }

    w.el.addEventListener('touchstart', onDown, { passive:false });
    w.el.addEventListener('touchmove',  onMove, { passive:false });
    w.el.addEventListener('touchend',   onUp);
    w.el.addEventListener('touchcancel',onUp);

    w.el.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    // 마우스 휠 (PC) — 한 번에 1칸
    w.el.addEventListener('wheel', function(e){
      e.preventDefault();
      stopMomentum(w);
      const dir = e.deltaY > 0 ? 1 : -1;
      const newIdx = Math.max(0, Math.min(w.items.length-1, w.selectedIdx + dir));
      animateToIndex(w, newIdx);
    }, { passive:false });

    // 항목 직접 클릭
    w.inner.addEventListener('click', function(e){
      const target = e.target.closest('.bzr-dp-wheel-item');
      if (!target) return;
      const idx = parseInt(target.dataset.idx, 10);
      if (!isNaN(idx)) animateToIndex(w, idx);
    });
  }

  // GPU 가속을 위해 translate3d 사용
  function applyTransform(w, offset){
    w.inner.style.transform = 'translate3d(0,' + (offset + centerOffset()) + 'px,0)';
  }

  function setOffset(w, offset){
    const max = 0;
    const min = -(w.items.length - 1) * itemH();
    // 경계 너머 저항 효과
    if (offset > max) offset = max + (offset - max) * 0.3;
    else if (offset < min) offset = min + (offset - min) * 0.3;
    w.offset = offset;
    applyTransform(w, offset);

    // 활성 항목 업데이트 (drag 중에도 실시간 반영)
    const idx = Math.round(-offset / itemH());
    const clamped = Math.max(0, Math.min(w.items.length-1, idx));
    if (clamped !== w.selectedIdx) {
      w.selectedIdx = clamped;
      updateActiveItem(w);
      // Haptic feedback — 안드로이드만 동작 (iOS Safari는 미지원). rate limit으로 너무 빠른 momentum 시 진동 폭주 방지
      if (navigator.vibrate) {
        const now = performance.now();
        if (!w._lastVibrate || now - w._lastVibrate > 30) {
          navigator.vibrate(8);
          w._lastVibrate = now;
        }
      }
    }
  }

  function updateActiveItem(w){
    const items = w.inner.querySelectorAll('.bzr-dp-wheel-item');
    items.forEach(function(el, i){
      const dist = Math.abs(i - w.selectedIdx);
      // class 변경은 다음 frame에 batched (성능)
      if (dist === 0) {
        if (!el.classList.contains('is-active')) {
          el.className = 'bzr-dp-wheel-item is-active';
        }
      } else if (dist === 1) {
        if (!el.classList.contains('is-near') || el.classList.contains('is-active')) {
          el.className = 'bzr-dp-wheel-item is-near';
        }
      } else {
        if (el.classList.contains('is-active') || el.classList.contains('is-near')) {
          el.className = 'bzr-dp-wheel-item';
        }
      }
    });
  }

  // CSS transition 기반 모멘텀 (GPU 가속, RAF 안 씀)
  // velocity_px_per_ms: 마지막 ~80ms 평균 속도
  // totalDelta: drag 전체 이동량 (방향 판별 보조)
  // duration: drag 지속 시간 (flick 여부 판단)
  function startMomentum(w, velocity_px_per_ms, totalDelta, duration){
    const itemHeight = itemH();
    const items = w.items;
    if (!items || items.length === 0) return;

    // ── 방향 판별 — velocity 부호 우선, 0에 가까우면 totalDelta 부호로 fallback ──
    let sign = 0;
    if (Math.abs(velocity_px_per_ms) > 0.05) {
      sign = velocity_px_per_ms > 0 ? 1 : -1;
    } else if (typeof totalDelta === 'number' && Math.abs(totalDelta) > 4) {
      sign = totalDelta > 0 ? 1 : -1;
    }

    // ── flick 감지 — 짧고 빠른 swipe면 무조건 1칸 이상 이동 ──
    const isFlick = (typeof duration === 'number') && duration < 250
                  && (Math.abs(velocity_px_per_ms) > 0.4 || Math.abs(totalDelta) > 8);

    let target;

    if (Math.abs(velocity_px_per_ms) < 0.05 && (!totalDelta || Math.abs(totalDelta) < 4)) {
      // 거의 안 움직임 — 가장 가까운 칸으로 스냅 (제자리)
      target = Math.round(w.offset / itemHeight) * itemHeight;
    } else {
      // 휠별 감도 — 항목 수가 적은 month/day는 더 천천히
      let velMul, decel;
      if (w.name === 'year') {
        velMul = 1.3;  decel = 800;   // 107개 — 빠르게 굴러감 (살짝 flick은 2~3칸)
      } else if (w.name === 'month') {
        velMul = 0.7;  decel = 1300;  // 12개 — 살짝 flick = 1칸
      } else { // day
        velMul = 1.1;  decel = 900;   // 28~31개 — 중간
      }
      const v0 = velocity_px_per_ms * 1000 * velMul;
      // distance: v0의 부호를 그대로 가짐 (위로 swipe = 음수 → distance 음수)
      let distance = (v0 * Math.abs(v0)) / (2 * decel);
      // 한 번에 너무 멀리 가지 않도록 캡
      const maxSlots = w.name === 'year' ? 40 : (w.name === 'month' ? 8 : 14);
      const maxDistance = maxSlots * itemHeight;
      if (Math.abs(distance) > maxDistance) {
        distance = (distance > 0 ? 1 : -1) * maxDistance;
      }
      target = w.offset + distance;

      // 떼는 순간 위치 기준으로 sign 방향의 칸으로 스냅 (반대 칸 방지)
      if (sign !== 0) {
        const ratio = target / itemHeight;
        // sign이 양수(아래로 swipe → offset 증가 → 화면 위에 있던 항목들이 내려옴)이면 ceil
        // sign이 음수(위로 swipe → offset 감소)이면 floor
        target = sign > 0 ? Math.ceil(ratio) * itemHeight : Math.floor(ratio) * itemHeight;
      } else {
        target = Math.round(target / itemHeight) * itemHeight;
      }

      // flick인데 1칸 미만이면 강제로 1칸 이동
      if (isFlick && sign !== 0) {
        const startSnapped = Math.round(w.offset / itemHeight) * itemHeight;
        if (target === startSnapped) {
          target = startSnapped + sign * itemHeight;
        }
      }
    }

    // 경계 클램프
    target = Math.max(-(items.length-1) * itemHeight, Math.min(0, target));

    // duration: 거리 비례 (촤르르륵 굴러가는 느낌을 위해 길게)
    const dist = Math.abs(target - w.offset);
    const minDur = 220, maxDur = 1400;
    const dur = Math.min(maxDur, Math.max(minDur, Math.sqrt(dist) * 50));

    animateWithCSS(w, target, dur);
  }

  function animateToIndex(w, idx){
    const target = -idx * itemH();
    animateWithCSS(w, target, 240);
  }

  // CSS transition으로 부드럽게 이동 (RAF 대신 GPU에 맡김)
  function animateWithCSS(w, target, duration){
    // 진행 중인 RAF 멈추기
    if (w.rafId) { cancelAnimationFrame(w.rafId); w.rafId = null; }
    if (w._transitionTimer) { clearTimeout(w._transitionTimer); w._transitionTimer = null; }

    // 목적지를 별도로 추적 (실제 w.offset은 stopMomentum이 matrix에서 읽어와 진짜 현재값 유지)
    w._animTarget = target;
    w._animStartOffset = w.offset;
    w._animStartT = performance.now();
    w._animDuration = duration;

    // CSS transition 적용
    w.inner.style.transition = 'transform ' + duration + 'ms cubic-bezier(0.23, 1, 0.32, 1)';
    applyTransform(w, target);

    // 활성 항목은 미리 업데이트 (사용자에게 visual feedback 빠르게)
    const idx = Math.round(-target / itemH());
    w.selectedIdx = Math.max(0, Math.min(w.items.length-1, idx));
    updateActiveItem(w);

    // transition 끝나면 w.offset을 정확히 target으로 sync
    w._transitionTimer = setTimeout(function(){
      w.inner.style.transition = 'none';
      w.offset = target;                   // ★ 여기서 비로소 갱신
      w._animTarget = null;
      w._transitionTimer = null;
      // Settle haptic — momentum이 멈출 때 살짝 "톡" 느낌
      if (navigator.vibrate) {
        navigator.vibrate(12);
      }
    }, duration + 30);
  }

  // 현재 화면에 보이는 실제 transform 위치를 읽어옴
  function readCurrentOffset(w){
    const cs = window.getComputedStyle(w.inner);
    const matrix = cs.transform;
    if (matrix && matrix !== 'none') {
      const match = matrix.match(/matrix.*\(([^)]+)\)/);
      if (match) {
        const parts = match[1].split(',').map(parseFloat);
        const ty = parts.length === 16 ? parts[13] : (parts.length === 6 ? parts[5] : 0);
        return ty - centerOffset();
      }
    }
    return w.offset;
  }

  function stopMomentum(w){
    if (w.rafId) {
      cancelAnimationFrame(w.rafId);
      w.rafId = null;
    }
    // 진행 중인 transition이 있으면, 화면에 보이는 정확한 위치로 freeze
    const isAnimating = !!w._transitionTimer;
    if (isAnimating) {
      const realOffset = readCurrentOffset(w);
      // transition 즉시 끔 (없으면 다음 setTransform 호출 시 부드럽게 가버림)
      w.inner.style.transition = 'none';
      // 강제로 reflow를 일으켜 transition 변경이 반영되게 함
      // eslint-disable-next-line no-unused-expressions
      w.inner.offsetHeight;
      w.offset = realOffset;
      applyTransform(w, w.offset);
      clearTimeout(w._transitionTimer);
      w._transitionTimer = null;
      w._animTarget = null;
    } else {
      // 일반 상태: transition 끄기만
      w.inner.style.transition = 'none';
    }
  }

  function renderWheel(w, items, selectedIdx){
    w.items = items;
    w.selectedIdx = Math.max(0, Math.min(items.length-1, selectedIdx));
    w.inner.innerHTML = items.map(function(it, i){
      return '<div class="bzr-dp-wheel-item" data-idx="'+i+'">'+it.label+'</div>';
    }).join('');
    w.offset = -w.selectedIdx * itemH();
    w.inner.style.transition = 'none';
    applyTransform(w, w.offset);
    updateActiveItem(w);
  }

  function refreshDayWheel(){
    // 연/월 변경 시 일자 범위 재계산
    const yearItems  = wheels.year.items;
    const monthItems = wheels.month.items;
    const yVal = yearItems[wheels.year.selectedIdx]?.value || '';
    const mVal = monthItems[wheels.month.selectedIdx]?.value || '';
    const max = daysInMonth(yVal, mVal);
    const newDayItems = [];
    for (let d = 1; d <= max; d++) {
      newDayItems.push({ value:pad2(d), label:String(d) });
    }
    let newDayIdx = wheels.day.selectedIdx;
    if (newDayIdx >= max) newDayIdx = max - 1;
    renderWheel(wheels.day, newDayItems, newDayIdx);
  }

  function buildYearItems(){
    const out = [];
    for (let y = MAX_YEAR; y >= MIN_YEAR; y--) {
      out.push({ value:String(y), label:String(y) });
    }
    return out;
  }
  function buildMonthItems(){
    const out = [];
    for (let m = 1; m <= 12; m++) {
      out.push({ value:pad2(m), label:MONTHS[m-1] });
    }
    return out;
  }
  function buildDayItems(year, month){
    const max = daysInMonth(year, month);
    const out = [];
    for (let d = 1; d <= max; d++) {
      out.push({ value:pad2(d), label:String(d) });
    }
    return out;
  }

  function findIdx(items, value){
    if (!value) return -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i].value === value) return i;
    }
    return -1;
  }

  function closeModal(){
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    // restore scroll position
    document.body.classList.remove('bzr-dp-lock');
    document.body.style.top = '';
    if (bzrDpScrollY !== null) {
      window.scrollTo(0, bzrDpScrollY);
      bzrDpScrollY = null;
    }
    setTimeout(function(){
      if (!modal.classList.contains('is-open')) modal.style.display = '';
    }, 220);
    if (currentPicker) {
      currentPicker.openTriggers?.forEach(function(el){ el.classList.remove('is-open'); });
      currentPicker = null;
    }
  }

  function confirmSelection(){
    if (!currentPicker) { closeModal(); return; }
    const yVal = wheels.year.items[wheels.year.selectedIdx]?.value || '';
    const mVal = wheels.month.items[wheels.month.selectedIdx]?.value || '';
    const dVal = wheels.day.items[wheels.day.selectedIdx]?.value || '';
    if (yVal && mVal && dVal) {
      currentPicker.picker.setAll(yVal, mVal, dVal);
    }
    closeModal();
  }

  // ─── DESKTOP POPOVER (≥600px) ─────────────────────────────────
  // 모바일은 openModal()로 휠 피커, 데스크톱은 이 함수로 부분별 드롭다운
  let desktopPop = null, desktopPopState = null;

  function ensureDesktopPop(){
    if (desktopPop) return;
    desktopPop = document.createElement('div');
    desktopPop.className = 'bzr-dp-desktop-pop';
    desktopPop.innerHTML = ''
      + '<div class="bzr-dp-desktop-head" id="bzrDpDeskHead">'
      + '  <span class="bzr-dp-desktop-head-title"></span>'
      + '  <span class="bzr-dp-desktop-head-hint">ESC ✕</span>'
      + '</div>'
      + '<div class="bzr-dp-desktop-list"></div>';
    document.body.appendChild(desktopPop);

    // 외부 클릭으로 닫기 (트리거는 통과)
    document.addEventListener('click', function(e){
      if (!desktopPop.classList.contains('is-open')) return;
      if (desktopPop.contains(e.target)) return;
      if (desktopPopState && desktopPopState.trigger && desktopPopState.trigger.contains(e.target)) return;
      closeDesktopPop();
    });

    document.addEventListener('keydown', function(e){
      if (!desktopPop.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        closeDesktopPop();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveDesktopHighlight(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        confirmDesktopHighlight();
      }
    });

    // 페이지 스크롤 시 닫기 (단, 드롭다운 내부 스크롤은 무시)
    window.addEventListener('scroll', function(e){
      if (!desktopPop.classList.contains('is-open')) return;
      // 드롭다운 내부 스크롤은 무시
      if (desktopPop.contains(e.target)) return;
      closeDesktopPop();
    }, true);

    window.addEventListener('resize', function(){
      if (desktopPop.classList.contains('is-open') && desktopPopState) {
        positionDesktopPop(desktopPopState.trigger);
      }
    });
  }

  function moveDesktopHighlight(dir){
    if (!desktopPopState) return;
    const items = desktopPop.querySelectorAll('.bzr-dp-desktop-item');
    if (!items.length) return;
    let idx = desktopPopState.highlightIdx;
    idx = Math.max(0, Math.min(items.length - 1, idx + dir));
    desktopPopState.highlightIdx = idx;
    items.forEach(function(el, i){
      el.classList.toggle('is-highlight', i === idx);
    });
    items[idx].scrollIntoView({ block:'nearest' });
  }

  function confirmDesktopHighlight(){
    if (!desktopPopState) return;
    const items = desktopPopState.items;
    const idx = desktopPopState.highlightIdx;
    if (items[idx]) {
      desktopPopState.picker.set(desktopPopState.part, items[idx].value);
    }
    closeDesktopPop();
  }

  function positionDesktopPop(triggerEl){
    const rect = triggerEl.getBoundingClientRect();
    const popHeight = Math.min(desktopPop.scrollHeight, 440);
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < popHeight + 16 && rect.top > spaceBelow;
    let top, left = rect.left + window.scrollX;
    if (flipUp) {
      top = rect.top + window.scrollY - popHeight - 4;
    } else {
      top = rect.bottom + window.scrollY + 2;
    }
    desktopPop.style.left = left + 'px';
    desktopPop.style.top  = top  + 'px';
  }

  function closeDesktopPop(){
    if (!desktopPop) return;
    desktopPop.classList.remove('is-open');
    if (desktopPopState && desktopPopState.trigger) {
      desktopPopState.trigger.classList.remove('is-open');
    }
    desktopPopState = null;
  }

  function openDesktopPop(picker, part, triggerEl){
    ensureDesktopPop();

    // 같은 트리거 다시 클릭 = 토글 닫기
    if (desktopPopState && desktopPopState.trigger === triggerEl) {
      closeDesktopPop();
      return;
    }
    if (desktopPopState) closeDesktopPop();

    // items 빌드
    let items;
    if (part === 'year')       items = buildYearItems();
    else if (part === 'month') items = buildMonthItems();
    else                       items = buildDayItems(picker.state.year, picker.state.month);

    const currentVal = picker.state[part];
    let highlightIdx = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].value === currentVal) { highlightIdx = i; break; }
    }
    if (!currentVal && part === 'year') {
      // 기본값 1990
      for (let i = 0; i < items.length; i++) {
        if (items[i].value === '1990') { highlightIdx = i; break; }
      }
    }

    desktopPopState = { picker:picker, part:part, trigger:triggerEl, items:items, highlightIdx:highlightIdx };

    const titles = { year:'BIRTH YEAR', month:'BIRTH MONTH', day:'BIRTH DAY' };
    desktopPop.querySelector('.bzr-dp-desktop-head-title').textContent = titles[part];

    const list = desktopPop.querySelector('.bzr-dp-desktop-list');
    list.innerHTML = '';
    items.forEach(function(it, i){
      const div = document.createElement('div');
      div.className = 'bzr-dp-desktop-item' + (i === highlightIdx ? ' is-highlight' : '');
      div.textContent = it.label;
      div.addEventListener('click', function(e){
        e.stopPropagation();
        picker.set(part, it.value);
        closeDesktopPop();
      });
      div.addEventListener('mouseenter', function(){
        const all = list.querySelectorAll('.bzr-dp-desktop-item');
        all.forEach(function(el, j){ el.classList.toggle('is-highlight', j === i); });
        desktopPopState.highlightIdx = i;
      });
      list.appendChild(div);
    });

    triggerEl.classList.add('is-open');
    positionDesktopPop(triggerEl);
    requestAnimationFrame(function(){
      desktopPop.classList.add('is-open');
      // 선택된 항목 가운데로 스크롤
      const sel = list.querySelector('.is-highlight');
      if (sel) {
        const offsetTop = sel.offsetTop - list.clientHeight / 2 + sel.clientHeight / 2;
        list.scrollTop = Math.max(0, offsetTop);
      }
    });
  }

  function openModal(picker, allTriggers){
    ensureModal();
    currentPicker = { picker: picker, openTriggers: allTriggers };
    allTriggers.forEach(function(el){ el.classList.add('is-open'); });

    const yearItems  = buildYearItems();
    const monthItems = buildMonthItems();
    const dayItems   = buildDayItems(picker.state.year, picker.state.month);

    let yIdx = findIdx(yearItems, picker.state.year);
    if (yIdx < 0) yIdx = findIdx(yearItems, '1990');         // 기본값: 1990
    if (yIdx < 0) yIdx = 0;
    let mIdx = findIdx(monthItems, picker.state.month);
    if (mIdx < 0) mIdx = 0;
    let dIdx = findIdx(dayItems, picker.state.day);
    if (dIdx < 0) dIdx = 0;

    renderWheel(wheels.year,  yearItems,  yIdx);
    renderWheel(wheels.month, monthItems, mIdx);
    renderWheel(wheels.day,   dayItems,   dIdx);

    // 연/월 휠 변경 시 day 휠 갱신을 위한 옵저버 (스냅 완료 후만)
    // 간단하게: 매번 confirm 호출 시 검증 + drag end 시 refresh
    ['year','month'].forEach(function(name){
      const w = wheels[name];
      // 기존 등록된 게 있으면 안 함
      if (w._dayRefreshHooked) return;
      w._dayRefreshHooked = true;
      // touchend / mouseup 후 살짝 지연시켜 호출
      const refresh = function(){
        setTimeout(refreshDayWheel, 80); // 빠른 반영
      };
      w.el.addEventListener('touchend', refresh);
      w.el.addEventListener('mouseup', refresh);
      w.el.addEventListener('wheel', refresh);
    });

    document.body.style.overflow = 'hidden';
    // body scroll lock — prevents background scroll bleed in iOS/Android in-app browsers
    bzrDpScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = '-' + bzrDpScrollY + 'px';
    document.body.classList.add('bzr-dp-lock');
    modal.style.display = 'flex';
    requestAnimationFrame(function(){
      modal.classList.add('is-open');
    });
  }

  function initPicker(root){
    const targetId = root.getAttribute('data-target');
    const target   = document.getElementById(targetId);
    if (!target) return;

    const yBtn = root.querySelector('[data-part="year"]');
    const mBtn = root.querySelector('[data-part="month"]');
    const dBtn = root.querySelector('[data-part="day"]');

    const picker = {
      state: { year:'', month:'', day:'' },
      set: function(part, value){
        this.state[part] = value;
        // 일자 범위 검증 (예: 4월 31일 → 4월 30일)
        if (part === 'year' || part === 'month') {
          const max = daysInMonth(this.state.year, this.state.month);
          if (this.state.day && parseInt(this.state.day) > max) {
            this.state.day = pad2(max);
          }
        }
        this.render();
        this.sync();
      },
      setAll: function(year, month, day){
        this.state.year  = year;
        this.state.month = month;
        const max = daysInMonth(year, month);
        if (parseInt(day) > max) day = pad2(max);
        this.state.day = day;
        this.render();
        this.sync();
      },
      render: function(){
        const labels = {
          year:  this.state.year  || 'YYYY',
          month: this.state.month ? MONTHS[parseInt(this.state.month)-1] : 'MM',
          day:   this.state.day   ? String(parseInt(this.state.day))   : 'DD',
        };
        yBtn.querySelector('.bzr-dp-val').textContent = labels.year;
        mBtn.querySelector('.bzr-dp-val').textContent = labels.month;
        dBtn.querySelector('.bzr-dp-val').textContent = labels.day;
        yBtn.classList.toggle('is-empty', !this.state.year);
        mBtn.classList.toggle('is-empty', !this.state.month);
        dBtn.classList.toggle('is-empty', !this.state.day);
      },
      sync: function(){
        const { year, month, day } = this.state;
        if (year && month && day) {
          target.value = year + '-' + month + '-' + day;
        } else {
          target.value = '';
        }
        // 기존 검증 로직 호환을 위해 input 이벤트 발화
        target.dispatchEvent(new Event('input',  { bubbles:true }));
        target.dispatchEvent(new Event('change', { bubbles:true }));
      },
      // 외부에서 값 주입 시 (예: restoreFormInputs)
      hydrateFromTarget: function(){
        const v = target.value || '';
        const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
          this.state.year = m[1]; this.state.month = m[2]; this.state.day = m[3];
        } else {
          this.state.year = ''; this.state.month = ''; this.state.day = '';
        }
        this.render();
      },
    };

    // 디바이스 분기 — 데스크톱: 부분별 드롭다운, 모바일: 휠 피커 모달
    const triggers = [yBtn, mBtn, dBtn];
    function makeHandler(part, btn){
      return function(e){
        e.stopPropagation();
        if (isMobile()) {
          openModal(picker, triggers);
        } else {
          openDesktopPop(picker, part, btn);
        }
      };
    }
    yBtn.addEventListener('click', makeHandler('year',  yBtn));
    mBtn.addEventListener('click', makeHandler('month', mBtn));
    dBtn.addEventListener('click', makeHandler('day',   dBtn));

    // 모바일에서 컨테이너 빈 공간(/, padding 영역) 클릭 시도 모달 열기
    root.addEventListener('click', function(e){
      // 트리거 버튼은 이미 자체 핸들러가 있으므로 무시
      if (e.target.closest('.bzr-dp-trigger')) return;
      if (!isMobile()) return; // 데스크톱은 part별 드롭다운이라 컨테이너 클릭 무시
      e.stopPropagation();
      openModal(picker, triggers);
    });

    // 외부에서 hidden input value를 직접 set한 경우에도 UI 동기화
    target._bzrPicker = picker;

    picker.hydrateFromTarget();
  }

  function initAll(){
    document.querySelectorAll('.bzr-datepicker').forEach(initPicker);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // resetForm / restoreFormInputs 호환: hidden input value가 외부에서 변경된 경우
  // setVal 헬퍼들이 그냥 .value를 쓰므로, 폼 복원 후 picker를 다시 hydrate해야 함.
  // 안전한 패턴: 전역으로 노출
  window.bzrRehydrateDatepickers = function(){
    document.querySelectorAll('.bzr-datepicker').forEach(function(root){
      const targetId = root.getAttribute('data-target');
      const target = document.getElementById(targetId);
      if (target && target._bzrPicker) target._bzrPicker.hydrateFromTarget();
    });
  };
})();
