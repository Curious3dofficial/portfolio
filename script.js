  /* ---------- Horizontal scroll progress bar ---------- */
  const scrollProgress = document.getElementById('scrollProgress');
  const scrollProgressTrack = document.getElementById('scrollProgressTrack');
  function updateScrollProgress(){
    /* while a project card is open, body is position:fixed (modal-scroll-lock)
       which takes it out of the flow entirely - document.documentElement's
       scrollHeight collapses to ~viewport height at that point, so this math
       would compute a bogus 0% and the bar would appear to vanish. Since
       scroll position genuinely can't change while locked, just freeze the
       bar at whatever it last showed instead of recalculating. */
    if(document.body.classList.contains('modal-scroll-lock')) return;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if(scrollProgress) scrollProgress.style.width = pct + '%';
    if(scrollProgressTrack) scrollProgressTrack.setAttribute('aria-valuenow', Math.round(pct));
  }
  /* Multi-colour bar: each section's colour occupies exactly its share of the
     scroll length, with short smooth blends at the boundaries. The gradient is
     sized to the full viewport so the growing bar reveals it. */
  function paintScrollProgress(){
    if(!scrollProgress) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if(max <= 0) return;
    const SECTION_COLOURS = [
      ['#about', '#8B5CF6'],
      ['#stats', '#FB4B70'],
      ['#education', '#22D3EE'],
      ['#projects', '#10CC1A'],
      ['#achievements', '#FFD100'],
      ['#epilogue', '#F5F6F8']
    ];
    const stops = [];
    let prev = '#8B5CF6'; /* hero rides on About purple */
    stops.push(prev + ' 0%');
    SECTION_COLOURS.forEach(pair => {
      const el = document.querySelector(pair[0]);
      if(!el) return;
      const p = Math.max(0, Math.min(100, (el.offsetTop / max) * 100));
      stops.push(prev + ' ' + Math.max(0, p - 2).toFixed(2) + '%');
      stops.push(pair[1] + ' ' + Math.min(100, p + 2).toFixed(2) + '%');
      prev = pair[1];
    });
    stops.push(prev + ' 100%');
    scrollProgress.style.background = 'linear-gradient(90deg, ' + stops.join(', ') + ')';
    scrollProgress.style.backgroundSize = '100vw 100%';
    scrollProgress.style.backgroundRepeat = 'no-repeat';
  }
  window.addEventListener('scroll', updateScrollProgress, { passive:true });
  window.addEventListener('resize', () => { updateScrollProgress(); paintScrollProgress(); });
  window.addEventListener('load', paintScrollProgress);
  updateScrollProgress();
  paintScrollProgress();

  /* ---------- Scroll progress bar: draggable/clickable scrubber ----------
     The bar itself stays a plain 4px line with no visible handle - the
     invisible taller track on top is what's actually draggable, so you can
     click anywhere along it, or press-and-drag, to jump straight to that
     point in the page. Works with mouse, touch and pen via Pointer Events,
     plus arrow/Home/End keys since it's exposed as a real role="slider". */
  if(scrollProgressTrack){
    let isDraggingProgress = false;

    function scrollRatioToPage(ratio, smooth){
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if(max <= 0) return;
      const clamped = Math.max(0, Math.min(1, ratio));
      window.scrollTo({ top: clamped * max, behavior: smooth ? 'smooth' : 'auto' });
    }

    function ratioFromPointer(evt){
      const rect = scrollProgressTrack.getBoundingClientRect();
      return (evt.clientX - rect.left) / rect.width;
    }

    scrollProgressTrack.addEventListener('pointerdown', (evt) => {
      isDraggingProgress = true;
      scrollProgressTrack.classList.add('is-dragging');
      try{ scrollProgressTrack.setPointerCapture(evt.pointerId); }catch(err){}
      scrollRatioToPage(ratioFromPointer(evt), false);
      evt.preventDefault();
    });
    scrollProgressTrack.addEventListener('pointermove', (evt) => {
      if(!isDraggingProgress) return;
      scrollRatioToPage(ratioFromPointer(evt), false);
    });
    function endProgressDrag(evt){
      if(!isDraggingProgress) return;
      isDraggingProgress = false;
      scrollProgressTrack.classList.remove('is-dragging');
      try{ scrollProgressTrack.releasePointerCapture(evt.pointerId); }catch(err){}
    }
    scrollProgressTrack.addEventListener('pointerup', endProgressDrag);
    scrollProgressTrack.addEventListener('pointercancel', endProgressDrag);

    scrollProgressTrack.addEventListener('keydown', (evt) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if(max <= 0) return;
      const step = window.innerHeight * 0.12;
      const cur = window.scrollY;
      if(evt.key === 'ArrowRight' || evt.key === 'ArrowUp'){
        evt.preventDefault();
        window.scrollTo({ top: Math.min(max, cur + step), behavior:'smooth' });
      } else if(evt.key === 'ArrowLeft' || evt.key === 'ArrowDown'){
        evt.preventDefault();
        window.scrollTo({ top: Math.max(0, cur - step), behavior:'smooth' });
      } else if(evt.key === 'Home'){
        evt.preventDefault();
        window.scrollTo({ top:0, behavior:'smooth' });
      } else if(evt.key === 'End'){
        evt.preventDefault();
        window.scrollTo({ top:max, behavior:'smooth' });
      }
    });
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if(href && href.startsWith('#')){
        const target = document.querySelector(href);
        if(target){
          e.preventDefault();
          target.scrollIntoView({ behavior:'smooth', block:'start' });
        }
      }
    });
  });

  /* ---------- Currently Learning: folder open/close ---------- */
  /* ---------- Folder holds the fact cards: click to unpack / pack ---------- */
  const learningFolder = document.getElementById('learningFolder');
  const factCards = Array.from(document.querySelectorAll('.fact-grid .fact-card')).filter(c => !c.classList.contains('fact-folder-cell'));
  if(learningFolder && factCards.length){
    const folderBack = learningFolder.querySelector('.learning-folder__back');
    const reduceMotionFacts = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let factsDeployed = false;
    let factsAnimating = false;

    factCards.forEach(c => c.classList.add('in-folder'));

    /* Clockwise placement starting from Builder (top-left → around the grid) */
    const DEPLOY_TITLES = ['Builder', 'Favorite Language', 'Linux User', 'Football Fan', 'Chess Enthusiast', 'Student', 'Based In', 'Currently Learning'];
    const orderedCards = DEPLOY_TITLES
      .map(t => factCards.find(c => { const h = c.querySelector('h4'); return h && h.textContent.trim() === t; }))
      .filter(Boolean);
    factCards.forEach(c => { if(orderedCards.indexOf(c) === -1) orderedCards.push(c); });

    const miniStack = learningFolder.querySelector('.mini-stack');

    /* Build the minis: exact scaled-down clones of the big cards, stacked
       in reverse deploy order so the first card out (Builder) sits on top. */
    if(miniStack){
      const MINI_W = 54;
      const MINI_H = 42; /* cap the height so tall cards (like Linux) stay tucked inside the folder */
      const stackCards = orderedCards.slice().reverse();
      /* slide the narrow Linux mini toward the back of the stack so other cards sit in front of it */
      const linuxIdx = stackCards.findIndex(c => { const h = c.querySelector('h4'); return h && h.textContent.trim() === 'Linux User'; });
      if(linuxIdx > 2){
        const linuxCard = stackCards.splice(linuxIdx, 1)[0];
        stackCards.splice(2, 0, linuxCard);
      }
      stackCards.forEach((card, idx) => {
        const w = card.offsetWidth || 1;
        const h = card.offsetHeight || 1;
        const k = Math.min(MINI_W / w, MINI_H / h);
        const mini = document.createElement('div');
        mini.className = 'mini-card';
        const head = card.querySelector('h4');
        mini.dataset.fact = head ? head.textContent.trim() : ('card-' + idx);
        mini.style.width = (w * k).toFixed(1) + 'px';
        mini.style.height = (h * k).toFixed(1) + 'px';
        mini.style.setProperty('--y', (-1 - idx * 3) + 'px');
        mini.style.setProperty('--r', ((idx % 2 ? 1 : -1) * (2 + (idx % 4))) + 'deg');
        const inner = document.createElement('div');
        inner.className = 'mini-inner';
        inner.style.width = w + 'px';
        inner.style.height = h + 'px';
        inner.style.transform = 'scale(' + k.toFixed(4) + ')';
        const clone = card.cloneNode(true);
        clone.classList.remove('in-folder', 'deploying');
        clone.classList.add('mini-clone');
        clone.style.width = '100%';
        clone.style.height = '100%';
        inner.appendChild(clone);
        mini.appendChild(inner);
        miniStack.appendChild(mini);
      });
    }

    function miniFor(card){
      const h = card.querySelector('h4');
      const t = h ? h.textContent.trim() : '';
      return miniStack ? miniStack.querySelector('.mini-card[data-fact="' + t + '"]') : null;
    }

    /* Flight path for a mini card: pulled up out of the folder, then a curved swing to the slot,
       growing to the slot's size on the way. Starts from the mini's real current position. */
    function miniFlightKeyframes(mini, card){
      const m = mini.getBoundingClientRect();
      const r = card.getBoundingClientRect();
      const cs = getComputedStyle(mini).transform;
      let bm;
      try { bm = (cs === 'none') ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(cs); }
      catch(err){ bm = { a:1, b:0, e:0, f:0 }; }
      const bx = bm.e, by = bm.f;
      const rot = Math.atan2(bm.b, bm.a) * 180 / Math.PI;
      const dx = (r.left + r.width / 2) - (m.left + m.width / 2);
      const dy = (r.top + r.height / 2) - (m.top + m.height / 2);
      /* use the mini's untransformed size — the rotated bounding box would skew the scale */
      const mw = parseFloat(mini.style.width) || mini.offsetWidth || m.width;
      const mh = parseFloat(mini.style.height) || mini.offsetHeight || m.height;
      const sc = ((r.width / mw) + (r.height / mh)) / 2;
      const p0x = bx, p0y = by - 90;
      const p2x = bx + dx, p2y = by + dy;
      const cxp = bx + dx * 0.35;
      const cyp = Math.min(by - 170, by + dy - 90);
      const kfs = [
        { transform: 'translate(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px) rotate(' + rot.toFixed(2) + 'deg) scale(1)', offset: 0 },
        { transform: 'translate(' + p0x.toFixed(1) + 'px,' + p0y.toFixed(1) + 'px) rotate(' + (rot / 2).toFixed(2) + 'deg) scale(1.12)', offset: 0.3 }
      ];
      const steps = 14;
      /* Motion 1 (drag & align): continuous flight that grows the whole way and
         ends centred on the placeholder slightly oversized, ready for the snap */
      const hover = sc * 1.12;
      for(let i = 1; i <= steps; i++){
        const t = i / steps, mt = 1 - t;
        const x = mt*mt*p0x + 2*mt*t*cxp + t*t*p2x;
        const y = mt*mt*p0y + 2*mt*t*cyp + t*t*p2y;
        const s = 1.12 + (hover - 1.12) * t;
        const rr = (rot / 2) * (1 - t);
        kfs.push({ transform: 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + rr.toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')', offset: 0.3 + 0.7 * t });
      }
      const slotT = function(s){ return 'translate(' + p2x.toFixed(1) + 'px,' + p2y.toFixed(1) + 'px) rotate(0deg) scale(' + s.toFixed(3) + ')'; };
      return {
        kfs: kfs,
        hoverT: slotT(hover),
        underT: slotT(sc * 0.99),
        finalT: slotT(sc)
      };
    }

    function reverseKeyframes(kfs){
      return kfs.slice().reverse().map(k => ({ transform: k.transform, offset: 1 - k.offset }));
    }

    /* Reverse echo before pickup: the outline converges onto the card, then it's plucked */
    function snapRelease(card, done){
      const ring = document.createElement('div');
      ring.className = 'snap-echo';
      card.appendChild(ring);
      /* exact reverse of the lock-in echo: same scales, opacities and colour,
         offsets mirrored (0.45 -> 0.55), easing curve time-reversed */
      ring.animate([
        { transform: 'scale(1.32)', opacity: 0 },
        { transform: 'scale(1.14)', opacity: 0.2, offset: 0.55 },
        { transform: 'scale(1)', opacity: 0.45 }
      ], { duration: 700, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' }).onfinish = () => {
        ring.remove();
        if(done) done();
      };
    }

    /* Impact feedback as the card locks in: expanding echo ring + subtle settle pulse */
    function snapImpact(card){
      const ring = document.createElement('div');
      ring.className = 'snap-echo';
      card.appendChild(ring);
      ring.animate([
        { transform: 'scale(1)', opacity: 0.45 },
        { transform: 'scale(1.14)', opacity: 0.2, offset: 0.45 },
        { transform: 'scale(1.32)', opacity: 0 }
      ], { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }).onfinish = () => ring.remove();
      /* settle pulse + a VERY subtle decaying shake as the card sits */
      card.animate([
        { transform: 'scale(1) translate(0,0) rotate(0deg)' },
        { transform: 'scale(1.03) translate(1px,-0.7px) rotate(0.2deg)', offset: 0.22 },
        { transform: 'scale(1.012) translate(-1px,0.5px) rotate(-0.16deg)', offset: 0.45 },
        { transform: 'scale(1) translate(0.6px,0.3px) rotate(0.08deg)', offset: 0.68 },
        { transform: 'scale(1) translate(-0.3px,-0.2px) rotate(-0.04deg)', offset: 0.85 },
        { transform: 'scale(1) translate(0,0) rotate(0deg)' }
      ], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    }

    function deployFacts(){
      factsAnimating = true;
      learningFolder.classList.add('open', 'busy');
      orderedCards.forEach((card, i) => {
        setTimeout(() => {
          const mini = miniFor(card);
          if(!mini){
            card.classList.remove('in-folder');
            return;
          }
          mini.classList.add('flying');
          const dur = 820;
          const flight = miniFlightKeyframes(mini, card);
          mini._flight = flight;
          /* Motion 1: continuous flight, ends centred over the placeholder at ~108% */
          const anim = mini.animate(flight.kfs, { duration: dur, easing: 'cubic-bezier(.45,.1,.3,1)', fill: 'forwards' });
          /* Motion 2 (magnetic snap): brief hold, then a steep ease-in pull —
             barely moves at first, rushes to exact fit at the very end */
          anim.onfinish = () => {
            const snap = mini.animate([
              { transform: flight.hoverT, filter: 'drop-shadow(0 10px 14px rgba(15,8,35,0.55))' },
              { transform: flight.finalT, filter: 'drop-shadow(0 6px 10px rgba(15,8,35,0.35))' }
            ], { duration: 150, delay: 25, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' });
            snap.onfinish = () => {
              card.style.transition = 'none';
              card.classList.remove('in-folder');
              void card.offsetWidth;
              card.style.transition = '';
              mini.classList.add('taken');
              mini.classList.remove('flying');
              snap.cancel();
              anim.cancel();
              snapImpact(card);
            };
          };
          if(i === orderedCards.length - 1){
            setTimeout(() => {
              factsAnimating = false;
              factsDeployed = true;
              learningFolder.classList.remove('open', 'busy');
              learningFolder.classList.add('deployed');
            }, dur + 300);
          }
        }, i * 240);
      });
    }

    function stashFacts(){
      factsAnimating = true;
      learningFolder.classList.remove('deployed');
      learningFolder.classList.add('open', 'busy');
      const cards = orderedCards.slice().reverse();
      cards.forEach((card, i) => {
        setTimeout(() => {
          const mini = miniFor(card);
          if(!mini){
            card.classList.add('in-folder');
            return;
          }
          /* pickup: the echo ring closes in on the card first, then instant swap
             card -> mini, reverse Motion 2 (fast yank off the slot, decelerating
             to oversized), brief hold, then the normal drag motion back */
          const dur = 720;
          snapRelease(card, () => {
            mini.classList.remove('taken');
            mini.classList.add('flying');
            card.style.transition = 'none';
            card.classList.add('in-folder');
            void card.offsetWidth;
            card.style.transition = '';
            const flight = mini._flight || miniFlightKeyframes(mini, card);
            const pull = mini.animate([
              { transform: flight.finalT, filter: 'drop-shadow(0 6px 10px rgba(15,8,35,0.35))' },
              { transform: flight.hoverT, filter: 'drop-shadow(0 10px 14px rgba(15,8,35,0.55))' }
            ], { duration: 150, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
            pull.onfinish = () => {
              const back = mini.animate(reverseKeyframes(flight.kfs), { duration: dur, delay: 25, easing: 'cubic-bezier(.5,.05,.45,1)', fill: 'backwards' });
              back.onfinish = () => mini.classList.remove('flying');
              pull.cancel();
            };
          });
          if(i === cards.length - 1){
            setTimeout(() => {
              factsAnimating = false;
              factsDeployed = false;
              learningFolder.classList.remove('open', 'busy');
            }, dur + 1000); /* covers ring close-in (700ms) + pull (175ms) + drag */
          }
        }, i * 200);
      });
    }

    function toggleLearningFolder(){
      if(factsAnimating) return;
      if(reduceMotionFacts){
        factsDeployed = !factsDeployed;
        factCards.forEach(c => c.classList.toggle('in-folder', !factsDeployed));
        if(miniStack) miniStack.querySelectorAll('.mini-card').forEach(mc => mc.classList.toggle('taken', factsDeployed));
        learningFolder.classList.toggle('deployed', factsDeployed);
        learningFolder.setAttribute('aria-expanded', factsDeployed ? 'true' : 'false');
        return;
      }
      const willDeploy = !factsDeployed;
      if(willDeploy) deployFacts(); else stashFacts();
      learningFolder.setAttribute('aria-expanded', willDeploy ? 'true' : 'false');
    }
    learningFolder.addEventListener('click', toggleLearningFolder);
    learningFolder.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        toggleLearningFolder();
      }
    });
  }

  /* ---------- Light / dark theme toggle (ripple, ported) ---------- */
  const themeToggle = document.getElementById('themeToggle');
  const themeToggleIcon = document.getElementById('themeToggleIcon');
  const themeTransitionLayer = document.getElementById('theme-transition-layer');
  const SUN_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  const MOON_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>';
  const THEME_REVEAL_DURATION = 950;
  const supportsViewTransition = typeof document.startViewTransition === 'function';
  let themeAnimating = false;

  function applyThemeClass(isLight){
    document.body.classList.toggle('light-theme', isLight);
    if(themeToggleIcon){ themeToggleIcon.innerHTML = isLight ? MOON_ICON : SUN_ICON; }
  }

  if(themeToggle){
    const storedTheme = localStorage.getItem('theme');
    applyThemeClass(storedTheme === 'light');

    function runThemeSwitchAnimation(nextIsLight){
      if(themeAnimating) return;
      themeAnimating = true;

      const rect = themeToggle.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rootStyle = document.documentElement.style;
      rootStyle.setProperty('--reveal-x', `${centerX}px`);
      rootStyle.setProperty('--reveal-y', `${centerY}px`);
      themeToggle.classList.add('switching');

      if(supportsViewTransition){
        try{
          const transition = document.startViewTransition(() => {
            applyThemeClass(nextIsLight);
          });
          transition.finished.finally(() => {
            themeToggle.classList.remove('switching');
            themeAnimating = false;
          });
          return;
        } catch(err){
          // Fall through to the clip-path layer fallback on transition API errors.
        }
      }

      themeTransitionLayer.style.backgroundColor = nextIsLight ? '#F3F1FA' : '#0B0D12';
      themeTransitionLayer.classList.add('reset');
      themeTransitionLayer.classList.remove('active');
      themeTransitionLayer.style.visibility = 'visible';
      themeTransitionLayer.style.opacity = '1';

      requestAnimationFrame(() => {
        themeTransitionLayer.classList.remove('reset');
        themeTransitionLayer.classList.add('active');
        applyThemeClass(nextIsLight);
      });

      window.setTimeout(() => {
        themeTransitionLayer.style.opacity = '0';
      }, THEME_REVEAL_DURATION);

      window.setTimeout(() => {
        themeTransitionLayer.classList.add('reset');
        themeTransitionLayer.classList.remove('active');
        themeTransitionLayer.style.visibility = 'hidden';
        themeToggle.classList.remove('switching');
        themeAnimating = false;
      }, THEME_REVEAL_DURATION + 210);
    }

    themeToggle.addEventListener('click', () => {
      const nextIsLight = !document.body.classList.contains('light-theme');
      runThemeSwitchAnimation(nextIsLight);
      localStorage.setItem('theme', nextIsLight ? 'light' : 'dark');
    });

    /* Press "x" to toggle light/dark mode anywhere on the page, throttled to 1/sec */
    const THEME_KEY_THROTTLE_MS = 1000;
    let lastThemeKeyToggle = 0;
    window.addEventListener('keydown', (e) => {
      if(e.key !== 'x' && e.key !== 'X') return;
      if(e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      const tag = target && target.tagName;
      const isEditable = target && (target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
      if(isEditable) return;

      const now = Date.now();
      if(now - lastThemeKeyToggle < THEME_KEY_THROTTLE_MS) return;
      lastThemeKeyToggle = now;

      const nextIsLight = !document.body.classList.contains('light-theme');
      runThemeSwitchAnimation(nextIsLight);
      localStorage.setItem('theme', nextIsLight ? 'light' : 'dark');
    });
  }

  /* ---------- Name stagger reveal ---------- */
  const heading = document.getElementById('nameHeading');
  const chunks = ["ANIRUDDHA", "MALLICK"];
  let delay = 0.2;
  chunks.forEach(chunk => {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'word';
    const inner = document.createElement('span');
    inner.dataset.text = chunk;
    inner.style.animationDelay = delay + 's';
    inner.addEventListener('animationend', function onNameReveal(e){
      if(e.animationName === 'wordUp'){
        wordSpan.classList.add('reveal-done');
        inner.removeEventListener('animationend', onNameReveal);
      }
    });
    inner.textContent = chunk;
    wordSpan.appendChild(inner);
    heading.appendChild(wordSpan);
    delay += 0.1;
  });

  /* The CSS (text-align:center + a trailing-letter-spacing correction on
     MALLICK) gets close, but it's still an approximation of where the
     glyphs actually land - browser text metrics for letter-spacing/kerning
     aren't identical everywhere. Measuring the real rendered boxes and
     nudging MALLICK by the exact pixel delta guarantees its visible centre
     lines up with ANIRUDDHA's, instead of trusting the CSS math to be
     exactly right. */
  function centerSecondNameWord(){
    const outerWords = heading.querySelectorAll('.word');
    if(outerWords.length < 2) return;
    const outer2 = outerWords[1];
    /* each .word wrapper is stretched to the SAME width (flex:0 0 100% -
       both rows fill the widest word's width), so measuring/shifting the
       wrappers themselves is a no-op - they're already aligned. What
       actually differs is where the inner <span> holding the real text
       sits inside that wrapper, so measure those instead. */
    const inner1 = outerWords[0].querySelector('span');
    const inner2 = outer2.querySelector('span');
    if(!inner1 || !inner2) return;
    outer2.style.transform = '';
    const r1 = inner1.getBoundingClientRect();
    const r2 = inner2.getBoundingClientRect();
    if(!r1.width || !r2.width) return;
    const delta = (r1.left + r1.width / 2) - (r2.left + r2.width / 2);
    // the inner span's own transform is already owned by the wordUp reveal
    // animation (fill-mode forwards keeps pinning it) - shift the outer
    // wrapper instead so this doesn't fight that animation.
    outer2.style.transform = 'translateX(' + delta + 'px)';
  }
  requestAnimationFrame(centerSecondNameWord);
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(centerSecondNameWord).catch(() => {});
  }
  window.addEventListener('resize', centerSecondNameWord);

  /* pointer capability, not a width proxy: tablets count as touch, and a
     narrow desktop window doesn't lose its mouse-driven effects */
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  /* ---------- Fixed background canvas (hosts the EvilEye shader) ---------- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wrap = document.getElementById('canvas-wrap');

  /* ---------- Hero: EvilEye shader (ported from ogl to Three.js) ---------- */
  (function initEvilEye(){
    const eyeWrap = wrap;
    if(!eyeWrap) return;
    /* the Three.js CDN script can be blocked (adblock, offline) and WebGL
       context creation can fail - either would throw here, and since this
       whole file is one script block, an uncaught error would take down
       everything below it (stats, projects, music, reveals). Degrade to a
       plain background instead. */
    if(typeof THREE === 'undefined') return;

    function hexToVec3(hex){
      const h = hex.replace('#', '');
      return [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
      ];
    }

    function generateNoiseTexture(size){
      const data = new Uint8Array(size * size * 4);
      function hash(x, y, s){
        let n = x * 374761393 + y * 668265263 + s * 1274126177;
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
      }
      function noise(px, py, freq, seed){
        const fx = (px / size) * freq;
        const fy = (py / size) * freq;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = fx - ix;
        const ty = fy - iy;
        const w = freq | 0;
        const v00 = hash(((ix % w) + w) % w, ((iy % w) + w) % w, seed);
        const v10 = hash((((ix + 1) % w) + w) % w, ((iy % w) + w) % w, seed);
        const v01 = hash(((ix % w) + w) % w, (((iy + 1) % w) + w) % w, seed);
        const v11 = hash((((ix + 1) % w) + w) % w, (((iy + 1) % w) + w) % w, seed);
        return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
      }
      for(let y = 0; y < size; y++){
        for(let x = 0; x < size; x++){
          let v = 0, amp = 0.4, totalAmp = 0;
          for(let o = 0; o < 8; o++){
            const f = 32 * (1 << o);
            v += amp * noise(x, y, f, o * 31);
            totalAmp += amp;
            amp *= 0.65;
          }
          v /= totalAmp;
          v = (v - 0.5) * 2.2 + 0.5;
          v = Math.max(0, Math.min(1, v));
          const val = Math.round(v * 255);
          const i = (y * size + x) * 4;
          data[i] = val; data[i + 1] = val; data[i + 2] = val; data[i + 3] = 255;
        }
      }
      return data;
    }

    const eyeScene = new THREE.Scene();
    const eyeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    eyeCamera.position.z = 1;

    let eyeRenderer;
    try{
      eyeRenderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
    } catch(err){
      return; // WebGL unavailable - skip the eye, keep the rest of the page alive
    }
    /* phones commonly report DPR 3 - shading a full-screen quad at that
       resolution is a battery drain for little visible gain on a small
       screen, so cap touch devices harder than desktop */
    eyeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
    eyeWrap.appendChild(eyeRenderer.domElement);

    const noiseSize = 256;
    const noiseData = generateNoiseTexture(noiseSize);
    const noiseTexture = new THREE.DataTexture(noiseData, noiseSize, noiseSize, THREE.RGBAFormat);
    noiseTexture.minFilter = THREE.LinearFilter;
    noiseTexture.magFilter = THREE.LinearFilter;
    noiseTexture.wrapS = THREE.RepeatWrapping;
    noiseTexture.wrapT = THREE.RepeatWrapping;
    noiseTexture.needsUpdate = true;

    const eyeVertexShader = `
      precision highp float;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const eyeFragmentShader = `
      precision highp float;
      varying vec2 vUv;

      uniform float uTime;
      uniform vec3 uResolution;
      uniform sampler2D uNoiseTexture;
      uniform float uPupilSize;
      uniform float uIrisWidth;
      uniform float uGlowIntensity;
      uniform float uIntensity;
      uniform float uScale;
      uniform float uNoiseScale;
      uniform vec2 uMouse;
      uniform float uPupilFollow;
      uniform float uFlameSpeed;
      uniform vec3 uEyeColor;
      uniform vec3 uBgColor;
      uniform float uOffsetX;

      void main(){
        vec2 fragCoord = vUv * uResolution.xy;
        vec2 uv = (fragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
        uv.x += uOffsetX;
        uv /= uScale;
        float ft = uTime * uFlameSpeed;

        float polarRadius = length(uv) * 2.0;
        float polarAngle = (2.0 * atan(uv.x, uv.y)) / 6.28 * 0.3;
        vec2 polarUv = vec2(polarRadius, polarAngle);

        vec4 noiseA = texture2D(uNoiseTexture, polarUv * vec2(0.2, 7.0) * uNoiseScale + vec2(-ft * 0.1, 0.0));
        vec4 noiseB = texture2D(uNoiseTexture, polarUv * vec2(0.3, 4.0) * uNoiseScale + vec2(-ft * 0.2, 0.0));
        vec4 noiseC = texture2D(uNoiseTexture, polarUv * vec2(0.1, 5.0) * uNoiseScale + vec2(-ft * 0.1, 0.0));

        float distanceMask = 1.0 - length(uv);

        float innerRing = clamp(-1.0 * ((distanceMask - 0.7) / uIrisWidth), 0.0, 1.0);
        innerRing = (innerRing * distanceMask - 0.2) / 0.28;
        innerRing += noiseA.r - 0.5;
        innerRing *= 1.3;
        innerRing = clamp(innerRing, 0.0, 1.0);

        float outerRing = clamp(-1.0 * ((distanceMask - 0.5) / 0.2), 0.0, 1.0);
        outerRing = (outerRing * distanceMask - 0.1) / 0.38;
        outerRing += noiseC.r - 0.5;
        outerRing *= 1.3;
        outerRing = clamp(outerRing, 0.0, 1.0);

        innerRing += outerRing;

        float innerEye = distanceMask - 0.1 * 2.0;
        innerEye *= noiseB.r * 2.0;

        vec2 pupilOffset = uMouse * uPupilFollow * 0.12;
        vec2 pupilUv = uv - pupilOffset;
        float pupil = 1.0 - length(pupilUv * vec2(9.0, 2.3));
        pupil *= uPupilSize;
        pupil = clamp(pupil, 0.0, 1.0);
        pupil /= 0.35;

        float outerEyeGlow = 1.0 - length(uv * vec2(0.5, 1.5));
        outerEyeGlow = clamp(outerEyeGlow + 0.5, 0.0, 1.0);
        outerEyeGlow += noiseC.r - 0.5;
        float outerBgGlow = outerEyeGlow;
        outerEyeGlow = pow(outerEyeGlow, 2.0);
        outerEyeGlow += distanceMask;
        outerEyeGlow *= uGlowIntensity;
        outerEyeGlow = clamp(outerEyeGlow, 0.0, 1.0);
        outerEyeGlow *= pow(1.0 - distanceMask, 2.0) * 2.5;

        outerBgGlow += distanceMask;
        outerBgGlow = pow(outerBgGlow, 0.5);
        outerBgGlow *= 0.15;

        vec3 color = uEyeColor * uIntensity * clamp(max(innerRing + innerEye, outerEyeGlow + outerBgGlow) - pupil, 0.0, 3.0);
        color += uBgColor;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // uBgColor matches the page's own void background so the canvas's
    // square edges blend in rather than showing as a visible box.
    const eyeUniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector3(1, 1, 1) },
      uNoiseTexture: { value: noiseTexture },
      uPupilSize: { value: 0.85 },
      uIrisWidth: { value: 0.25 },
      uGlowIntensity: { value: 0.24 },
      uIntensity: { value: 1.0 },
      uScale: { value: 0.85 },
      uNoiseScale: { value: 1.0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uPupilFollow: { value: 1.0 },
      uFlameSpeed: { value: 1.0 },
      uEyeColor: { value: new THREE.Vector3(...hexToVec3('#FF6F37')) },
      uBgColor: { value: new THREE.Vector3(...hexToVec3('#0B0D12')) },
      uOffsetX: { value: 0.63 },
    };

    const eyeMaterial = new THREE.ShaderMaterial({
      uniforms: eyeUniforms,
      vertexShader: eyeVertexShader,
      fragmentShader: eyeFragmentShader,
      transparent: false,
      depthWrite: false,
      depthTest: false,
    });

    const eyeMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), eyeMaterial);
    eyeScene.add(eyeMesh);

    const eyeClock = new THREE.Clock();
    const eyeMouse = { x: 0, y: 0, tx: 0, ty: 0 };

    function setEyeSize(){
      const w = window.innerWidth;
      const h = window.innerHeight;
      eyeRenderer.setSize(w, h);
      const cw = eyeRenderer.domElement.width;
      const ch = eyeRenderer.domElement.height;
      eyeUniforms.uResolution.value.set(cw, ch, cw / ch);
    }
    setEyeSize();

    if(!isTouch){
      // wrap has pointer-events:none (it sits behind page content), so
      // track the cursor at the window level, same approach the hex
      // background used.
      window.addEventListener('mousemove', (e) => {
        eyeMouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
        eyeMouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
      });
      window.addEventListener('mouseleave', () => { eyeMouse.tx = 0; eyeMouse.ty = 0; });
    }

    function animateEye(){
      requestAnimationFrame(animateEye);
      /* updateCanvasVisibility() fades the wrap to opacity 0 once the Stats
         section approaches - past that point (or with the tab hidden) there's
         nothing to see, so skip the GPU work entirely instead of shading a
         full-screen quad every frame for the rest of the visit */
      if(document.hidden || eyeWrap.style.opacity === '0') return;
      if(!reduceMotion){
        eyeMouse.x += (eyeMouse.tx - eyeMouse.x) * 0.05;
        eyeMouse.y += (eyeMouse.ty - eyeMouse.y) * 0.05;
        eyeUniforms.uMouse.value.set(eyeMouse.x, eyeMouse.y);
        eyeUniforms.uTime.value = eyeClock.getElapsedTime();
      }
      eyeRenderer.render(eyeScene, eyeCamera);
    }
    animateEye();

    window.addEventListener('resize', setEyeSize);
  })();

  /* ---------- Act III: Stats timeline reveal ---------- */
  const timelineWrap = document.getElementById('timelineWrap');
  const timelineFill = document.getElementById('timelineFill');
  const timelineTrackEl = timelineWrap ? timelineWrap.querySelector('.timeline-track') : null;
  const statNodes = document.querySelectorAll('[data-node]');
  const FILL_DURATION = 3200;
  const nodeFractions = [0.167, 0.5, 0.833]; // matches the 3 evenly spaced node x-positions

  /* The dashed line's repeat period (originally a fixed 16px CSS pattern)
     has no idea where the 3 node dots actually sit, so at most widths a
     dash gets cut off mid-way right under a node instead of the pattern
     reading cleanly through it. Measures the dots' real rendered centres
     (not the approximate nodeFractions constants above, which drift
     slightly at different widths since the grid's column-gap is a fixed
     px value, not a percentage) and picks a period that divides the
     average node-to-node gap into a whole number of repeats, closest to
     the original ~16px look. Phase (background/mask-position) then shifts
     the whole pattern so node 1 sits on a boundary; nodes 2 and 3 fall
     into place automatically since they're each ~one more whole gap
     further along. */
  function alignTimelineDashes(){
    if(!timelineWrap || (!timelineTrackEl && !timelineFill)) return;
    const dots = timelineWrap.querySelectorAll('.node-dot');
    if(dots.length < 2) return;
    const wrapLeft = timelineWrap.getBoundingClientRect().left;
    const centers = Array.from(dots).map(dot => {
      const r = dot.getBoundingClientRect();
      return (r.left + r.right) / 2 - wrapLeft;
    });
    let gapSum = 0;
    for(let i = 1; i < centers.length; i++) gapSum += centers[i] - centers[i - 1];
    const gap = gapSum / (centers.length - 1);
    if(!(gap > 0)) return;
    const targetPeriod = 16; // original dash(8px) + gap(8px) length
    const repeats = Math.max(1, Math.round(gap / targetPeriod));
    const period = gap / repeats;
    const dashLen = period / 2;
    /* -dashLen/2 so each node sits in the MIDDLE of a dash rather than
       exactly on the dash/gap boundary - without this, one side of the
       node starts a dash immediately and the other starts a gap
       immediately, an asymmetric seam right at the node itself. */
    const phase = (((centers[0] - dashLen / 2) % period) + period) % period;

    if(timelineTrackEl){
      timelineTrackEl.style.backgroundImage = `repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0 ${dashLen}px, transparent ${dashLen}px ${period}px)`;
      timelineTrackEl.style.backgroundPositionX = `${phase}px`;
    }
    if(timelineFill){
      const maskImg = `repeating-linear-gradient(90deg, #000 0 ${dashLen}px, transparent ${dashLen}px ${period}px)`;
      timelineFill.style.maskImage = maskImg;
      timelineFill.style.webkitMaskImage = maskImg;
      timelineFill.style.maskPosition = `${phase}px 0`;
      timelineFill.style.webkitMaskPosition = `${phase}px 0`;
    }
  }
  alignTimelineDashes();
  window.addEventListener('resize', alignTimelineDashes);

  function animateCount(el){
    const target = parseFloat(el.getAttribute('data-target'));
    const suffix = el.getAttribute('data-suffix') || '';
    if(isNaN(target)) return;
    const duration = 1100;
    const start = performance.now();
    function tick(now){
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if(p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function animateInfinityCount(el){
    const target = 7000;
    const duration = 1100; // matched to the other two counters' count-up duration
    const start = performance.now();
    let popped = false;
    function tick(now){
      const p = Math.min(1, (now - start) / duration);
      if(!popped && p >= 1){
        popped = true;
        shatterAndBecomeInfinity(el);
        return;
      }
      if(!popped){
        // Classic exponential ease-in: flat/slow through small numbers,
        // then a rapid final sprint up toward the target.
        const eased = p === 0 ? 0 : Math.pow(2, 10 * (p - 1));
        el.textContent = Math.round(eased * target).toString();
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  }

  function shatterAndBecomeInfinity(el){
    // Lock in the exact "7000" that's about to shatter, and measure it
    // in place before we touch the live element's content.
    el.textContent = '7000';
    const elStyle = getComputedStyle(el);
    const elRect = el.getBoundingClientRect();

    const overlay = document.createElement('div');
    overlay.className = 'shatter-overlay';
    overlay.style.left = `${elRect.left}px`;
    overlay.style.top = `${elRect.top}px`;
    overlay.style.width = `${elRect.width}px`;
    overlay.style.height = `${elRect.height}px`;
    overlay.style.fontFamily = elStyle.fontFamily;
    overlay.style.fontWeight = elStyle.fontWeight;
    overlay.style.fontSize = elStyle.fontSize;
    overlay.style.lineHeight = elStyle.lineHeight;
    overlay.style.color = elStyle.color;

    function rand(min, max){ return min + Math.random() * (max - min); }

    // Six irregular fragments per digit, each kicked off in roughly its own
    // direction but with heavy randomization for a genuinely chaotic break.
    const shardDirs = {
      'shard-a': [-1, -1], 'shard-b': [0.4, -1], 'shard-c': [-1, 0.6],
      'shard-d': [0.2, 0.1], 'shard-e': [1, -0.2], 'shard-f': [-0.3, 1]
    };
    const shardClasses = Object.keys(shardDirs);
    const allShards = [];
    '7000'.split('').forEach(ch => {
      const digit = document.createElement('span');
      digit.className = 'shatter-digit';
      digit.style.width = `${elRect.width / 4}px`;
      digit.style.height = `${elRect.height}px`;
      shardClasses.forEach(cls => {
        const shard = document.createElement('span');
        shard.className = `shatter-shard ${cls}`;
        shard.textContent = ch;
        const [dx, dy] = shardDirs[cls];
        const dist = rand(70, 150);
        shard.style.setProperty('--tx', `${dx * dist + rand(-20, 20)}px`);
        shard.style.setProperty('--ty', `${dy * dist + rand(-20, 20)}px`);
        shard.style.setProperty('--rot', `${rand(-260, 260)}deg`);
        shard.style.setProperty('--sc', `${rand(0.15, 0.5)}`);
        shard.style.transitionDelay = `${rand(0, 45)}ms`;
        digit.appendChild(shard);
        allShards.push(shard);
      });
      overlay.appendChild(digit);
    });
    document.body.appendChild(overlay);

    // Swap to infinity immediately underneath the shattering debris — no delay —
    // and pop it in from nothing with an overshooting bounce.
    el.textContent = '∞';
    el.classList.add('is-infinity-symbol');
    el.style.transition = 'none';
    el.style.transform = 'scale(0)';
    el.classList.add('infinity-burst');
    void el.offsetWidth; // force reflow so the animation restarts cleanly
    el.style.animation = 'infinityPop 0.68s cubic-bezier(.22,1,.36,1) forwards';
    setTimeout(() => { el.classList.remove('infinity-burst'); }, 700);
    el.addEventListener('animationend', function onPopEnd(e){
      if(e.animationName === 'infinityPop'){
        el.style.animation = 'none';
        el.style.transform = '';
        el.style.transition = '';
        el.removeEventListener('animationend', onPopEnd);
      }
    });

    requestAnimationFrame(() => {
      allShards.forEach(shard => shard.classList.add('go'));
    });

    setTimeout(() => {
      overlay.remove();
    }, 620);
  }

  document.querySelectorAll('.icon-circle').forEach(circle => {
    circle.addEventListener('animationend', (e) => {
      if(e.animationName === 'flagPop'){
        circle.style.animation = 'none';
      }
    });
  });

  function runStatsTimeline(){
    if(reduceMotion){
      timelineFill.style.width = '100%';
      statNodes.forEach(node => {
        node.classList.add('is-revealed');
        const num = node.querySelector('.stat-number');
        if(!num) return;
        if(num.hasAttribute('data-infinity')){ num.textContent = '∞'; num.classList.add('is-infinity-symbol'); }
        else num.textContent = num.getAttribute('data-target') + (num.getAttribute('data-suffix') || '');
      });
      return;
    }

    timelineFill.style.transition = `width ${FILL_DURATION}ms cubic-bezier(.65,0,.35,1)`;
    requestAnimationFrame(() => { timelineFill.style.width = '100%'; });

    statNodes.forEach((node, i) => {
      const delay = (nodeFractions[i] || 0.5) * FILL_DURATION;
      setTimeout(() => {
        node.classList.add('is-revealed');
        const num = node.querySelector('.stat-number');
        if(!num) return;
        if(num.hasAttribute('data-infinity')) animateInfinityCount(num);
        else animateCount(num);
      }, delay);
    });
  }

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        runStatsTimeline();
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.35 });
  if(timelineWrap) statsObserver.observe(timelineWrap);

  /* ---------- Projects: apple tree ---------- */
  const treeScene = document.getElementById('treeScene');
  const appleEls = Array.prototype.slice.call(document.querySelectorAll('.apple'));
  const projectCards = document.querySelectorAll('.project-display .project-card');
  const projectDisplay = document.getElementById('projectDisplay');

  function selectProject(idx){
    projectCards.forEach(c => c.classList.toggle('is-active', c.getAttribute('data-project-index') === idx));
    /* keep the dialog's accessible name in sync with what it's showing */
    if(projectDisplay){
      const activeTitle = projectDisplay.querySelector('.project-card.is-active .apple-card-title');
      projectDisplay.setAttribute('aria-label', activeTitle ? activeTitle.textContent.trim() + ' — project details' : 'Project details');
    }
  }

  /* Click an apple: it pulls forward and its card pops up over a blurred backdrop.
     Close it (Escape / backdrop / ×) and it travels down into the basket under
     the tree, in the order each project was viewed, marking it seen. Grounded
     apples reopen the same card with a lighter "lift" flourish instead of the
     full pull-forward. */
  /* Grounded apples get reparented into #basketSlots (see groundApple() and
     closeProject() below), which shares the exact same position/size CSS as
     the basket art itself. That means these slot numbers are just plain
     percentages of the basket's OWN box - no cross-container conversion, no
     runtime measuring. (An earlier version tried to convert the basket's
     pixel size into a tree-scene percentage at runtime via
     getBoundingClientRect(), which is also something I can't reliably test
     in this sandbox - jsdom always reports zero-size rects - and it came out
     wrong in the live page. Reparenting sidesteps the conversion entirely.)
     Coordinates: x/y are % of the basket's own 500x500 art. All 8 projects
     now live on the tree, so all 8 can end up here - two overlapping rows
     (front row lower/more central, back row higher/further apart), tuned
     against the real basketfront.svg's own silhouette (pixel-sampled to
     find where its rim/weave starts covering each column) so apples nestle
     against the front rim instead of floating above or vanishing beneath it.
     Fill order is deliberately NOT tied to which apple was clicked: the
     front row fills first, right-to-left, then the back row fills the same
     way - so the basket always fills in the same predictable pattern no
     matter which of the 8 projects the visitor happens to explore first. */
  const basketSlots = document.getElementById('basketSlots');
  /* tight spacing on purpose - each slot is closer than an apple's own width,
     so neighbours overlap like a real pile instead of sitting in a neat row. */
  const BASKET_SLOTS = [
    { left: 66, top: 24 },    // front row, right-to-left (fills 1st-4th)
    { left: 55, top: 30.6 },
    { left: 45, top: 31.6 },
    { left: 34, top: 28.6 },
    { left: 72, top: 19.5 },  // back row, right-to-left (fills 5th-8th)
    { left: 58, top: 23.7 },
    { left: 42, top: 23.5 },
    { left: 28, top: 17.5 }
  ];
  /* slots 0-3 are the front row (fills first), 4-7 the back row. Front-row
     apples sit closer to the viewer, so they need a higher z-index than the
     whole back row - not just "higher than whichever slot happens to be next
     to it" - otherwise a back-row apple could render on top of a front-row
     one it visually overlaps, which looks wrong AND can block that apple
     from being clicked (its hit area gets covered). Within each row, left
     still stacks above right - since slots now go right-to-left (index 0 =
     rightmost), a later position-in-row means further left, so it gets the
     higher z-index. */
  function basketZIndex(slotIndex){
    const isFrontRow = slotIndex < 4;
    const posInRow = slotIndex % 4; // 0 = rightmost slot in its row ... 3 = leftmost
    return (isFrontRow ? 20 : 10) + (posInRow + 1);
  }
  const appleState = {};
  appleEls.forEach(a => { appleState[a.getAttribute('data-project')] = 'hanging'; });
  let groundedCount = 0;
  let currentOpenIdx = null;
  /* bumped every time animateCardArc() is (re)called; each running step()
     loop checks its own captured generation against this and quietly stops
     if it's stale. Without this, opening/closing quickly starts a second
     rAF loop before the first one finishes, and both loops fight over
     #projectDisplay's transform every frame - that fight is the "ghost"
     the user is seeing when toggling fast. */
  let cardAnimGen = 0;

  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'project-modal-backdrop';
  document.body.appendChild(modalBackdrop);
  /* re-home the modal at body level so it's never affected by an ancestor's
     transform/filter (which would otherwise break position:fixed) */
  if(projectDisplay) document.body.appendChild(projectDisplay);
  /* where keyboard focus was before the dialog opened, so closing can hand
     it back instead of dropping it on <body> */
  let lastFocusedBeforeModal = null;

  function appleForIdx(idx){
    return appleEls.find(a => a.getAttribute('data-project') === idx);
  }

  function groundApple(idx){
    const apple = appleForIdx(idx);
    if(!apple || appleState[idx] === 'grounded') return;
    const slotIndex = groundedCount % BASKET_SLOTS.length;
    const slot = BASKET_SLOTS[slotIndex];
    groundedCount++;
    if(basketSlots) basketSlots.appendChild(apple);
    apple.style.left = slot.left + '%';
    apple.style.top = slot.top + '%';
    apple.style.zIndex = String(basketZIndex(slotIndex));
    apple.classList.add('is-grounded');
    appleState[idx] = 'grounded';
  }

  /* The clicked apple IS the card: it flies from its own on-screen position/size
     to the centred, full-size card (a FLIP transition), instead of a separate
     "card" simply fading in somewhere else while the small apple stays put. */
  function easeInOutCubic(t){ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }
  /* zoom IN (opening) decelerates hard - pure easeOutQuint front-loads ~97% of
     the motion by the halfway point, leaving such a tiny tail that the "slowing
     down" was barely perceptible. A gentle overshoot-and-settle reads as an
     unmistakable deceleration instead: it flies in fast, slightly overshoots
     full size, then visibly eases back down into place. */
  function easeOutBack(t){
    const c1 = 1.22, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  /* zoom OUT (closing) accelerates hard - starts slow, rushes to the end */
  function easeInQuint(t){ return t*t*t*t*t; }

  /* express a rect as an offset (dx,dy,scale) from #projectDisplay's own natural
     centred/full-size layout, so (0,0,1,1) always means "settled, on-screen" */
  function rectToOffset(rect, naturalRect){
    return {
      dx: (rect.left + rect.width/2) - (naturalRect.left + naturalRect.width/2),
      dy: (rect.top + rect.height/2) - (naturalRect.top + naturalRect.height/2),
      sx: Math.max(rect.width / naturalRect.width, 0.02),
      sy: Math.max(rect.height / naturalRect.height, 0.02)
    };
  }

  /* animates #projectDisplay's transform+opacity along a curved (quadratic
     bezier) path between two offsets, instead of a straight-line interpolation */
  /* No opacity fade anywhere in here on purpose: it's the same apple the whole
     time, just changing size and position, never fading out and "respawning". */
  function animateCardArc(fromOffset, toOffset, opts, onDone){
    const myGen = ++cardAnimGen; // invalidates any still-running previous animation
    projectDisplay.style.opacity = '1';
    if(reduceMotion){
      projectDisplay.style.transform = 'translate(-50%,-50%) translate(' + toOffset.dx + 'px,' + toOffset.dy + 'px) scale(' + toOffset.sx + ',' + toOffset.sy + ')';
      if(onDone) onDone();
      return;
    }
    const duration = opts.duration || 540;
    const arc = opts.arc || 0;
    const ease = opts.easing || easeInOutCubic;
    const midX = (fromOffset.dx + toOffset.dx) / 2;
    const midY = (fromOffset.dy + toOffset.dy) / 2 + arc;
    projectDisplay.style.transition = 'none';
    const t0 = performance.now();
    function step(now){
      if(myGen !== cardAnimGen) return; // a newer open/close call has taken over - stop fighting over transform
      const raw = Math.min(1, (now - t0) / duration);
      const t = ease(raw);
      const mt = 1 - t;
      const dx = mt*mt*fromOffset.dx + 2*mt*t*midX + t*t*toOffset.dx;
      const dy = mt*mt*fromOffset.dy + 2*mt*t*midY + t*t*toOffset.dy;
      const sx = fromOffset.sx + (toOffset.sx - fromOffset.sx) * t;
      const sy = fromOffset.sy + (toOffset.sy - fromOffset.sy) * t;
      projectDisplay.style.transform = 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
      if(raw < 1){
        requestAnimationFrame(step);
      } else {
        /* commit the final state (and run onDone, which may clear these inline
           styles entirely) WHILE transition is still disabled, so nothing
           animates a second time; only THEN hand transition back for any
           other CSS-driven state changes - this is what was causing the
           "ghost" replay on close (transition got re-enabled first, so
           onDone's cleanup was itself animated back to the closed CSS state) */
        if(onDone) onDone();
        void projectDisplay.offsetWidth;
        /* two rAFs, not an immediate restore - see the matching comment in
           closeProject()'s basket-jump: a single forced reflow flushes
           layout but doesn't guarantee a paint has actually landed, so
           restoring the transition too early can make the browser fold the
           just-committed final state into the next transition and animate
           it again. */
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            projectDisplay.style.transition = '';
          });
        });
      }
    }
    requestAnimationFrame(step);
  }

  /* The page sets `scroll-behavior:smooth` globally (html,body), which means
     `behavior:'auto'` in scrollTo()/scrollIntoView() does NOT mean instant -
     per spec it means "defer to the CSS scroll-behavior", which is smooth
     here. Every place in this file that actually wants an instant, no-motion
     jump (restoring scroll position after the modal-scroll-lock, landing on
     a hash target, resetting scroll on reload) needs to force scroll-behavior
     to plain "auto" inline for the duration of that one call, or it silently
     animates instead. This helper does that. */
  function scrollInstant(target){
    const htmlPrev = document.documentElement.style.scrollBehavior;
    const bodyPrev = document.body.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    if(typeof target === 'number'){
      window.scrollTo(0, target);
    } else if(target && typeof target.scrollIntoView === 'function'){
      target.scrollIntoView({ behavior:'auto', block:'start' });
    }
    document.documentElement.style.scrollBehavior = htmlPrev;
    document.body.style.scrollBehavior = bodyPrev;
  }

  /* Native `behavior:'smooth'` scrolling has a duration the browser picks for
     itself - there's no way to tell it "take exactly this long", which is a
     problem anywhere a scroll needs to stay in sync with another animation
     running for a known duration (e.g. the epilogue's replay wither). This
     hand-rolls the scroll over an explicit duration instead. */
  let scrollAnimRaf = null;
  function smoothScrollTo(targetY, durationMs, onDone){
    if(scrollAnimRaf) cancelAnimationFrame(scrollAnimRaf);
    const startY = window.scrollY;
    const distance = targetY - startY;
    if(Math.abs(distance) < 1 || durationMs <= 0){
      scrollInstant(targetY);
      if(onDone) onDone();
      return;
    }
    /* same fix scrollInstant applies for its one-shot jump, needed here too -
       without forcing scroll-behavior to plain "auto" for the duration of
       this animation, every one of the ~60 window.scrollTo() calls below
       (each landing on a slightly different target than the last) also
       kicks off ITS OWN native smooth-scroll animation on top of this one's
       manual easing. The two fight each other, which is what caused the
       "fast jump, then the real scroll catches up" glitch - native smooth
       scroll overshooting toward whatever the target happened to be a
       frame ago. Restored to '' (the stylesheet's own scroll-behavior:smooth
       rule) once finished, rather than snapshotting/restoring a "previous"
       inline value - if a second call interrupts this one mid-flight (the
       cancelAnimationFrame above exists specifically because that happens),
       the interrupted call's "previous" value would itself already just be
       "auto" from this same fix, permanently pinning it instead of ever
       falling back to the real default. */
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    const start = performance.now();
    const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2; // easeInOutCubic
    function step(now){
      const p = Math.min(1, (now - start) / durationMs);
      window.scrollTo(0, startY + distance * ease(p));
      if(p < 1){
        scrollAnimRaf = requestAnimationFrame(step);
      } else {
        scrollAnimRaf = null;
        document.documentElement.style.scrollBehavior = '';
        document.body.style.scrollBehavior = '';
        if(onDone) onDone();
      }
    }
    scrollAnimRaf = requestAnimationFrame(step);
  }

  /* background scroll lock while a project card is zoomed in. Two layers,
     belt-and-suspenders: the CSS position:fixed-on-body trick (handles mouse
     wheel/trackpad/touch drag in virtually all browsers, including iOS
     Safari's rubber-band overscroll), PLUS a direct wheel/touchmove/keyboard
     blocker underneath it in case anything slips past the CSS layer (e.g. a
     stray scroll key while focus is on the body). Scrolling *inside* the open
     card itself (#projectDisplay, which has its own overflow-y for long
     content) is still allowed - only the page behind it is frozen. */
  let scrollLockY = 0;
  const SCROLL_KEYS = ['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Spacebar'];
  /* vertical scroll is now locked everywhere while a project card is open -
     including inside the card itself, so it stays exactly where it opened
     (centred via centerModalScroll()) rather than being scrollable */
  function blockWheel(e){
    e.preventDefault();
  }
  function blockTouchMove(e){
    e.preventDefault();
  }
  function blockScrollKeys(e){
    if(SCROLL_KEYS.indexOf(e.key) !== -1) e.preventDefault();
  }
  function lockBodyScroll(){
    if(document.body.classList.contains('modal-scroll-lock')) return;
    scrollLockY = window.scrollY;
    document.body.style.top = -scrollLockY + 'px';
    document.body.classList.add('modal-scroll-lock');
    document.addEventListener('wheel', blockWheel, { passive:false });
    document.addEventListener('touchmove', blockTouchMove, { passive:false });
    document.addEventListener('keydown', blockScrollKeys, { passive:false });
  }
  function unlockBodyScroll(){
    if(!document.body.classList.contains('modal-scroll-lock')) return;
    document.body.classList.remove('modal-scroll-lock');
    document.body.style.top = '';
    scrollInstant(scrollLockY);
    document.removeEventListener('wheel', blockWheel);
    document.removeEventListener('touchmove', blockTouchMove);
    document.removeEventListener('keydown', blockScrollKeys);
    /* the bar was frozen (skipped recalculating) the whole time it was
       locked - refresh it immediately now that scrollHeight is real again,
       rather than waiting for the next scroll/resize event */
    updateScrollProgress();
  }

  /* .project-display can be taller than the viewport (a square apple-card up
     to 840px plus padding), in which case overflow-y:auto makes it scrollable
     - starting scrolled to the top would cut the apple off instead of showing
     it centred, so this centres the scroll position the moment it opens */
  function centerModalScroll(){
    if(!projectDisplay) return;
    const overflow = projectDisplay.scrollHeight - projectDisplay.clientHeight;
    projectDisplay.scrollTop = overflow > 0 ? overflow / 2 : 0;
  }

  function openProject(idx){
    if(currentOpenIdx !== null && currentOpenIdx !== idx){
      const prevApple = appleForIdx(currentOpenIdx);
      if(prevApple) prevApple.style.visibility = '';
    }
    lockBodyScroll();
    currentOpenIdx = idx;
    selectProject(idx);
    modalBackdrop.classList.add('is-visible');
    lastFocusedBeforeModal = document.activeElement;
    if(projectDisplay) projectDisplay.focus({ preventScroll:true });

    const originEl = appleForIdx(idx);
    if(projectDisplay && originEl){
      const startRect = originEl.getBoundingClientRect();
      originEl.style.visibility = 'hidden'; // the apple becomes the card, not a duplicate of it
      projectDisplay.classList.add('is-open');
      centerModalScroll();
      const naturalRect = projectDisplay.getBoundingClientRect();
      const fromOffset = rectToOffset(startRect, naturalRect);
      const toOffset = { dx: 0, dy: 0, sx: 1, sy: 1 };
      animateCardArc(fromOffset, toOffset, { duration: 620, arc: -120, easing: easeOutBack });
    } else if(projectDisplay){
      projectDisplay.classList.add('is-open');
      centerModalScroll();
    }
    document.addEventListener('keydown', handleModalKeydown);
  }

  function closeProject(){
    if(currentOpenIdx === null) return;
    const idx = currentOpenIdx;
    const originEl = appleForIdx(idx);
    modalBackdrop.classList.remove('is-visible');
    unlockBodyScroll();

    if(projectDisplay && originEl){
      /* jump the (still-hidden) apple straight to its slot in the basket
         before measuring, so the card flies down into the basket in one
         curved motion instead of back up to the canopy and then sliding
         down separately */
      if(appleState[idx] !== 'grounded'){
        const slotIndex = groundedCount % BASKET_SLOTS.length;
        const slot = BASKET_SLOTS[slotIndex];
        groundedCount++;
        originEl.style.transition = 'none';
        /* reparent into the basket's own slot layer first, so left/top below
           are plain percentages of the basket's box, not the whole tree-scene */
        if(basketSlots) basketSlots.appendChild(originEl);
        originEl.style.left = slot.left + '%';
        originEl.style.top = slot.top + '%';
        originEl.style.zIndex = String(basketZIndex(slotIndex));
        originEl.classList.add('is-grounded');
        appleState[idx] = 'grounded';
        void originEl.offsetWidth;
        /* restore the transition two frames later rather than immediately -
           a single forced reflow (offsetWidth) guarantees layout is flushed,
           but not that the browser has actually PAINTED this jump yet; if
           the transition property comes back before that paint lands, some
           browsers fold the "instant jump" and the transition-restore into
           the same visual update and animate the jump anyway (a ghost
           replay of the apple sliding into place from outside the basket,
           right as it reappears). Waiting two rAFs guarantees a real paint
           happened first. */
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            originEl.style.transition = '';
          });
        });
      }

      const naturalRect = projectDisplay.getBoundingClientRect();
      const targetRect = originEl.getBoundingClientRect();
      const fromOffset = { dx: 0, dy: 0, sx: 1, sy: 1 };
      const toOffset = rectToOffset(targetRect, naturalRect);

      /* drop the open-state class now (not at the end) so the text content's
         fade-out starts immediately, instead of staying legible while the
         card visually shrinks down to the ground */
      projectDisplay.classList.remove('is-open');
      animateCardArc(fromOffset, toOffset, { duration: 540, arc: 130, easing: easeInQuint }, () => {
        projectDisplay.style.transform = '';
        projectDisplay.style.opacity = '';
        originEl.style.visibility = '';
        /* hand keyboard focus back to the apple the dialog came from - it
           only becomes focusable again once its visibility is restored */
        originEl.focus({ preventScroll:true });
      });
    } else if(projectDisplay){
      projectDisplay.classList.remove('is-open');
      groundApple(idx);
      if(lastFocusedBeforeModal && document.contains(lastFocusedBeforeModal)){
        lastFocusedBeforeModal.focus({ preventScroll:true });
      }
    }

    currentOpenIdx = null;
    document.removeEventListener('keydown', handleModalKeydown);
  }

  function handleModalKeydown(e){
    if(e.key === 'Escape'){ closeProject(); return; }
    /* trap Tab inside the dialog - without this, focus escapes to the apples
       and page content behind the backdrop (still tabbable, just obscured) */
    if(e.key === 'Tab' && projectDisplay){
      const focusables = projectDisplay.querySelectorAll('.project-card.is-active a[href], .project-card.is-active button');
      if(!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if(e.shiftKey){
        if(active === first || !projectDisplay.contains(active)){
          e.preventDefault();
          last.focus();
        }
      } else if(active === last || !projectDisplay.contains(active)){
        e.preventDefault();
        first.focus();
      }
    }
  }

  appleEls.forEach(apple => {
    apple.addEventListener('click', () => openProject(apple.getAttribute('data-project')));
    apple.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        openProject(apple.getAttribute('data-project'));
      }
    });
  });
  modalBackdrop.addEventListener('click', closeProject);

  const treeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('is-grown');
        treeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  if(treeScene) treeObserver.observe(treeScene);

  /* ---------- Projects: occasional falling leaves ---------- */
  (function(){
    if(!treeScene || reduceMotion) return;

    const leafLayer = document.createElement('div');
    leafLayer.className = 'falling-leaves';
    leafLayer.setAttribute('aria-hidden', 'true');
    treeScene.appendChild(leafLayer);

    const LEAF_COLORS = ['leaf-light', 'leaf-dark'];
    let spawning = false;
    let generation = 0;
    let leafColorIndex = 0;

    function rand(min, max){ return min + Math.random() * (max - min); }

    /* A plain ellipse was a rough stand-in for the canopy's actual lumpy,
       cloud-of-circles silhouette - loose enough that leaves (and, in the
       apple placement, apples) were spawning past the real edge in several
       spots. This table instead measured the ACTUAL rendered tree-art pixel
       by pixel: for every 6 degrees around the canopy's centre, how far you
       can go before leaving the leafy silhouette. randomPointInCanopy()
       interpolates between samples and applies a safety margin, so spawn
       points are guaranteed to land inside the real shape, not an
       approximation of it. Center and radii are in the tree-art's own
       600x503 viewBox (same box the tree-scene's % positioning maps to). */
    const CANOPY_CENTER_PX = { x: 0.50 * 600, y: 0.32 * 503 };
    const CANOPY_RADIUS_TABLE = [
      [0,213],[6,229],[12,238],[18,275],[24,281],[30,288],[36,295],[42,285],[48,258],[54,244],
      [60,236],[66,220],[72,194],[78,217],[84,181],[90,181.5],[96,168],[102,170],[108,185],[114,213],
      [120,235],[126,247],[132,273],[138,282],[144,289],[150,297],[156,284],[162,268],[168,258],[174,224],
      [180,217],[186,211],[192,194],[198,166],[204,166],[210,161],[216,153],[222,132],[228,121],[234,127],
      [240,132],[246,135],[252,137],[258,136],[264,136],[270,132],[276,128],[282,122],[288,114],[294,108],
      [300,117],[306,124],[312,127],[318,127],[324,125],[330,135],[336,158],[342,169],[348,175],[354,176]
    ];
    const CANOPY_SAFETY_MARGIN = 0.7;
    function canopySafeRadiusPx(deg){
      deg = ((deg % 360) + 360) % 360;
      for(let i = 0; i < CANOPY_RADIUS_TABLE.length; i++){
        const [a0, r0] = CANOPY_RADIUS_TABLE[i];
        const [a1nRaw, r1] = CANOPY_RADIUS_TABLE[(i + 1) % CANOPY_RADIUS_TABLE.length];
        const span = ((a1nRaw - a0) % 360 + 360) % 360 || 360;
        const d = ((deg - a0) % 360 + 360) % 360;
        if(d <= span){
          const t = d / span;
          return (r0 + (r1 - r0) * t) * CANOPY_SAFETY_MARGIN;
        }
      }
      return CANOPY_RADIUS_TABLE[0][1] * CANOPY_SAFETY_MARGIN;
    }
    function randomPointInCanopy(){
      const deg = Math.random() * 360;
      const maxR = canopySafeRadiusPx(deg);
      const r = maxR * Math.sqrt(Math.random()); // uniform density, not clumped at center
      const rad = deg * Math.PI / 180;
      const xPx = CANOPY_CENTER_PX.x + Math.cos(rad) * r;
      const yPx = CANOPY_CENTER_PX.y + Math.sin(rad) * r;
      return { x: xPx / 600 * 100, y: yPx / 503 * 100 };
    }

    function dropOneLeaf(){
      const leaf = document.createElement('div');
      // alternate colors instead of picking randomly, so runs of the same shade are rare
      leaf.className = 'leaf-particle ' + LEAF_COLORS[leafColorIndex % LEAF_COLORS.length];
      leafColorIndex++;
      const size = rand(16, 25);
      const dur = rand(6.5, 10.5);
      const sway1 = rand(16, 34) * (Math.random() < 0.5 ? -1 : 1);
      const sway2 = -sway1 * rand(0.6, 1.1);
      const sway3 = sway1 * 0.35;
      // keep spawn points inside a rough ellipse approximating the canopy's silhouette,
      // instead of a full rectangle (which would spawn leaves off in empty corners)
      const spot = randomPointInCanopy();
      leaf.style.left = spot.x.toFixed(1) + '%';
      leaf.style.top = spot.y.toFixed(1) + '%';
      leaf.style.width = size + 'px';
      leaf.style.height = size + 'px';
      leaf.style.setProperty('--dur', dur.toFixed(2) + 's');
      leaf.style.setProperty('--sway1', sway1.toFixed(0) + 'px');
      leaf.style.setProperty('--sway2', sway2.toFixed(0) + 'px');
      leaf.style.setProperty('--sway3', sway3.toFixed(0) + 'px');
      leaf.style.setProperty('--rot', rand(140, 260).toFixed(0) + 'deg');
      leaf.innerHTML = '<span class="leaf-shape"></span>';
      leafLayer.appendChild(leaf);
      leaf.addEventListener('animationend', () => leaf.remove());
    }

    function spawnChain(myGeneration, leavesLeft){
      if(myGeneration !== generation || leavesLeft <= 0) {
        if(myGeneration === generation) scheduleNextChain(myGeneration);
        return;
      }
      dropOneLeaf();
      setTimeout(() => spawnChain(myGeneration, leavesLeft - 1), rand(350, 600));
    }

    function scheduleNextChain(myGeneration){
      if(myGeneration !== generation) return;
      setTimeout(() => {
        if(myGeneration !== generation) return;
        spawnChain(myGeneration, Math.floor(rand(2, 5))); // small chain of 2-4 leaves
      }, rand(2500, 5000));
    }

    const leafObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting && !spawning){
          spawning = true;
          generation++;
          const myGeneration = generation;
          setTimeout(() => spawnChain(myGeneration, Math.floor(rand(2, 5))), rand(1200, 3000));
        } else if(!entry.isIntersecting){
          spawning = false;
          generation++; // invalidates any in-flight timeouts from this cycle
        }
      });
    }, { threshold: 0.15 });
    leafObserver.observe(treeScene);
  })();

  /* ---------- Education: mountain climb ----------
     The reveal/stagger/hover-card behavior is all still pure CSS (see the
     generic [data-reveal] observer further down, and the .is-visible-keyed
     stagger in the stylesheet). The one thing that DOES need JS: the
     graphic is wider than the viewport, so margin:0 auto on an overflowing
     child has no effect (auto margins resolve to 0 once the child is
     bigger than its container) - it just starts scrolled flush left. This
     centers the scroll position explicitly instead, and recomputes it on
     resize, which also fires on browser zoom (zoom changes the effective
     CSS pixel viewport size), so it stays centered rather than drifting
     back to flush-left as the available width changes. Bias is a fraction
     of the scrollable overflow (0.5 = dead centre); LOWER values scroll
     less, leaving more of the graphic's right side visible on screen
     (shifts the mountain right), HIGHER values scroll further, revealing
     more of the left side (shifts the mountain left) - expressed as a
     fraction of the overflow amount rather than a fixed px offset, so the
     bias holds proportionally at any zoom level instead of being a fixed
     nudge that's barely noticeable when zoomed out and huge when zoomed in. */
  (function(){
    const climbWrap = document.querySelector('.edu-climb-wrap');
    const climbEl = document.getElementById('eduClimb');
    if(!climbWrap || !climbEl) return;
    const CLIMB_SCROLL_BIAS = 0.08;

    function centerClimb(){
      const overflow = climbEl.offsetWidth - climbWrap.clientWidth;
      climbWrap.scrollLeft = Math.max(0, overflow * CLIMB_SCROLL_BIAS);
    }
    centerClimb();
    window.addEventListener('resize', centerClimb);
    /* fonts/images finishing load can change layout size after the first
       paint - one more pass once everything's settled */
    window.addEventListener('load', centerClimb);
  })();

  /* ---------- Education: blizzard visibility gate ----------
     Same idea as the hero background (animateEye) skipping its render
     work once scrolled out of view: only run the blizzard (particles +
     canvas wind trail) while .edu-climb-wrap is actually on screen. A
     single IntersectionObserver naturally covers both "scrolled in from
     the top" and "about to leave at the bottom" - toggling .is-in-view
     on the wrap, which the CSS above uses to pause/resume every
     .flake-group / .flake--mini animation. The canvas trail reads this
     same class directly in its own draw loop below. */
  (function(){
    const climbWrap = document.querySelector('.edu-climb-wrap');
    if(!climbWrap) return;
    const blizzardObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        climbWrap.classList.toggle('is-in-view', entry.isIntersecting);
      });
    }, { threshold: 0 });
    blizzardObserver.observe(climbWrap);
  })();

  /* ---------- Education: clicks are ignored entirely ----------
     .edu-stop is a <button>, and clicking a button natively FOCUSES it -
     which was firing the existing 'focus' listener (same effect as
     hovering), leaving that stage stuck bumped/hovered until focus moved
     elsewhere. Blocking the click on mousedown (before the browser gets a
     chance to focus it) stops that, while leaving real keyboard Tab
     navigation - which doesn't go through mousedown - completely intact.
     Also swallows plain clicks anywhere else in the scene as a blanket
     safety net, per "ignore all clicks in education section". */
  (function(){
    const climbWrap = document.querySelector('.edu-climb-wrap');
    if(!climbWrap) return;
    document.querySelectorAll('.edu-stop').forEach((stop) => {
      stop.addEventListener('mousedown', (e) => e.preventDefault());
    });
    climbWrap.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  })();

  /* ---------- Education: hover hit-boxes match the actual characters ----------
     .edu-stop buttons used to be a fixed-size box centered on a rough
     --sx/--sy guess - close to each hiker, but not actually the same
     shape/size, and each hiker pose/crop is a different size (toddler up
     to arms-out summit pose). Instead of hand-tuning five separate boxes,
     measure each hiker <img>'s REAL rendered position/size and copy it
     directly onto its .edu-stop button (as exact left/top/width/height,
     replacing the --sx/--sy anchor-point approach with inline styles,
     which take priority over the CSS custom-property-driven values) -
     so the hoverable area is precisely the character, whatever size or
     pose it happens to be. Re-synced on resize/load and again once each
     hiker's own reveal transition finishes (their rendered box shifts
     slightly - translateY(28px) -> 0 - during that animation). */
  (function(){
    const shiftEl = document.querySelector('.edu-climb-shift');
    if(!shiftEl) return;
    const pairs = [1, 2, 3, 4, 5].map(n => ({
      n,
      hiker: document.querySelector('.edu-hiker--' + n),
      stop: document.querySelector('.edu-stop[data-hiker="' + n + '"]'),
      // no longer nested inside .stop - a free-standing sibling, found by
      // its own data-hiker attribute (see "positioning independent" note
      // in the CSS above).
      detail: document.querySelector('.edu-stop-detail[data-hiker="' + n + '"]')
    })).filter(p => p.hiker && p.stop);
    if(!pairs.length) return;

    function syncHitboxes(){
      const shiftRect = shiftEl.getBoundingClientRect();
      if(!shiftRect.width || !shiftRect.height) return;
      pairs.forEach(({ hiker, stop }) => {
        const r = hiker.getBoundingClientRect();
        if(!r.width || !r.height) return;
        stop.style.left = (((r.left - shiftRect.left) / shiftRect.width) * 100).toFixed(3) + '%';
        stop.style.top = (((r.top - shiftRect.top) / shiftRect.height) * 100).toFixed(3) + '%';
        stop.style.width = ((r.width / shiftRect.width) * 100).toFixed(3) + '%';
        stop.style.height = ((r.height / shiftRect.height) * 100).toFixed(3) + '%';
        stop.style.transform = 'none'; // left/top are now an exact top-left corner, not a center anchor point
        // .edu-stop-detail is untouched here on purpose - it has its own
        // fixed --sx/--sy anchor and never reads this resized box.
      });
    }
    syncHitboxes();
    window.addEventListener('resize', syncHitboxes);
    window.addEventListener('load', syncHitboxes);
    pairs.forEach(({ hiker }) => hiker.addEventListener('transitionend', syncHitboxes));

    /* Text and character each watch their OWN reveal transition and react
       independently - they share the same delay/duration values in CSS so
       they still visually appear together, but neither one's JS state
       waits on the other's transitionend event. */
    pairs.forEach(({ hiker }) => {
      hiker.addEventListener('transitionend', (e) => {
        if(e.propertyName !== 'opacity') return;
        // switches the hiker to a fast transform transition for the
        // hover-grow effect, once its own fade-in has actually finished.
        hiker.classList.add('is-ready');
      });
    });
    pairs.forEach(({ stop, detail }) => {
      if(!detail) return;
      detail.addEventListener('transitionend', (e) => {
        if(e.propertyName !== 'opacity') return;
        // unlocks hover/tap on BOTH the button and the text itself (text
        // gets its own hit-box too - see .edu-stop-detail.is-ready in the
        // CSS), once ITS fade-in has finished.
        stop.classList.add('is-ready');
        detail.classList.add('is-ready');
      });
    });

    /* Grow the character alongside its text on hover/focus of EITHER one -
       the character's hit-box (.edu-stop) and the text (.edu-stop-detail)
       are independent siblings now, so each needs its own listeners, but
       both drive the exact same shared hover state. Stage 4 is excluded
       entirely from having its OWN hover listeners - no hover-triggered
       zoom from hovering IT directly. Its zoom instead gets driven
       inversely by every other stage's hover state below: bumping any
       other character immediately shrinks stage 4, and un-bumping any
       other character immediately re-bumps stage 4 - so stage 4 reads as
       "shrunk for as long as you're hovering someone else", back to its
       normal zoomed-in resting state otherwise. otherHoverCount tracks how
       many OTHER stages are currently hovered at once (handles overlap,
       e.g. fast pointer movement crossing two hit-boxes), so stage 4 only
       re-bumps once none of them are hovered anymore. */
    const stage4 = pairs.find(p => p.n === 4);
    let otherHoverCount = 0;
    function setStage4Bumped(on){
      if(!stage4) return;
      if(stage4.hiker) stage4.hiker.classList.toggle('is-hovered', on);
      if(stage4.detail) stage4.detail.classList.toggle('is-hovered', on);
    }

    pairs.forEach(({ n, hiker, stop, detail }) => {
      if(n === 4) return;
      const setHovered = (on) => {
        hiker.classList.toggle('is-hovered', on);
        if(detail) detail.classList.toggle('is-hovered', on);
        otherHoverCount += on ? 1 : -1;
        setStage4Bumped(otherHoverCount <= 0);
      };
      stop.addEventListener('mouseenter', () => setHovered(true));
      stop.addEventListener('mouseleave', () => setHovered(false));
      stop.addEventListener('focus', () => setHovered(true));
      stop.addEventListener('blur', () => setHovered(false));
      if(detail){
        detail.addEventListener('mouseenter', () => setHovered(true));
        detail.addEventListener('mouseleave', () => setHovered(false));
      }
    });
  })();

  /* ---------- Education: Enter key triggers the next stage + nudges the rest ----------
     Each stage normally reveals on its own fixed schedule (1s/3s/5s/7s/9s
     transition-delay after #eduClimb gets .is-visible, set once when the
     section first scrolls into view). Every time Enter is pressed while
     the section is on screen: the ONE next stage in line gets triggered
     immediately, in full (its remaining wait skipped entirely) - and every
     stage still waiting AFTER that one (up through 5) gets a smaller 2s
     nudge off its own remaining wait, without forcing it to start.

     The flicker from an earlier version came from restarting a stage that
     had ALREADY started interpolating (mid-flight or fully finished) -
     resetting it back to invisible and replaying is a visible jump, not a
     smooth speed-up. started{} tracks, per stage, whether its opacity
     transition has actually begun (via the real transitionstart event,
     so it's true whether that start was natural or Enter-forced) - both
     the "trigger next" step and the "nudge" loop below skip any stage
     that's already true here, so nothing already on screen ever gets
     touched again. */
  (function(){
    const climbEl = document.getElementById('eduClimb');
    if(!climbEl) return;
    const remaining = { 2: 3, 3: 5, 4: 7, 5: 9 }; // seconds - stage 1 auto-starts, Enter never touches it
    const started = {};
    let nextStage = 2;

    [2, 3, 4, 5].forEach((n) => {
      const hiker = document.querySelector('.edu-hiker--' + n);
      if(!hiker) return;
      hiker.addEventListener('transitionstart', (e) => {
        if(e.propertyName === 'opacity') started[n] = true;
      });
    });

    function restart(el, startTransform, delaySeconds){
      if(!el) return;
      el.style.transition = 'none';
      el.style.opacity = '0';
      el.style.transform = startTransform;
      void el.offsetHeight; // flush - must land before transition comes back
      el.style.transition = '';
      el.style.transitionDelay = delaySeconds + 's';
      el.style.opacity = '';
      el.style.transform = '';
      // Drop the inline delay once this reveal actually finishes - an
      // inline style beats every CSS rule regardless of specificity, so if
      // it stayed forever it would permanently override the fast 0-delay
      // transition .is-ready is supposed to give this element afterward.
      // That would silently re-break its hover/bump-relay animation on any
      // stage Enter ever touched - the same failure mode as the
      // :not(.is-ready) CSS specificity bug fixed above, just via inline
      // styles instead, which that fix can't reach.
      el.addEventListener('transitionend', function clearDelay(e){
        if(e.propertyName !== 'opacity') return;
        el.style.transitionDelay = '';
        el.removeEventListener('transitionend', clearDelay);
      });
    }

    function applyDelay(n, delaySeconds){
      const hiker = document.querySelector('.edu-hiker--' + n);
      const detail = document.querySelector('.edu-stop-detail[data-hiker="' + n + '"]');
      const hikerStart = (n === 4)
        ? 'translate(-50%, -100%) translateY(28px) rotate(-10deg)'
        : 'translate(-50%, -100%) translateY(28px)';
      restart(hiker, hikerStart, delaySeconds);
      // .edu-stop-detail already exposes its own pre-reveal transform as
      // --detail-start (set per position-variant class) - reuse it rather
      // than duplicating each stage's tuned offsets here.
      restart(detail, 'var(--detail-start)', delaySeconds);
    }

    window.addEventListener('keydown', (e) => {
      if(e.key !== 'Enter') return;
      // don't hijack Enter if it's being used somewhere else on the page
      // (a form field, a focused button, etc.)
      const active = document.activeElement;
      if(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
      if(!climbEl.classList.contains('is-visible')) return;
      if(nextStage > 5) return;

      if(!started[nextStage]){
        remaining[nextStage] = 0;
        applyDelay(nextStage, 0);
        started[nextStage] = true; // about to start immediately - don't double-restart on a fast repeat press
      }

      for(let n = nextStage + 1; n <= 5; n++){
        if(started[n]) continue;
        remaining[n] = Math.max(0, remaining[n] - 2);
        applyDelay(n, remaining[n]);
      }

      nextStage++;
    });
  })();

  /* ---------- Education: victory-lap zoom sequence ----------
     Starts 0.5s BEFORE stage 5's own reveal actually finishes, not after -
     listens for transitionstart (fires once stage 5's delay has elapsed
     and it actually begins interpolating, whether that wait was natural
     or Enter-fast-forwarded down to 0), then schedules the sequence for
     (duration - 0.5s) later, landing it half a second ahead of stage 5's
     own completion instead of waiting for it.

     From there it's a relay through stages 1-4, 0.5s per handoff:
       t=0.0s  stage 1 bumps
       t=0.5s  stage 1 shrinks AND stage 2 bumps, simultaneously
       t=1.0s  stage 2 shrinks AND stage 3 bumps, simultaneously
       t=1.5s  stage 3 shrinks AND stage 4 bumps, simultaneously
     Stage 4 is the last leg of the relay and is never shrunk afterward -
     it just stays bumped permanently from there (matches its permanent-
     zoom behavior elsewhere). Stage 5 is skipped entirely - it only
     serves as the trigger.

     Hover is globally locked (see .hover-locked in the CSS) until this
     whole sequence is done - unlocked right here, right after the very
     last scheduled step (stage 4's bump-in, plus its own 0.25s transition
     so it's visually settled first). The two early-return guards below
     also unlock immediately, so a missing element or reduced-motion never
     leaves hover permanently stuck off. */
  (function(){
    const climbWrap = document.querySelector('.edu-climb-wrap');
    const hiker5 = document.querySelector('.edu-hiker--5');
    const detail5 = document.querySelector('.edu-stop-detail[data-hiker="5"]');
    function unlockHover(){ if(climbWrap) climbWrap.classList.remove('hover-locked'); }
    if(!hiker5){ unlockHover(); return; }
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){ unlockHover(); return; }

    const REVEAL_DURATION_MS = 2500; // must match .edu-hiker's transition duration
    const EARLY_MS = 500;
    const HANDOFF_MS = 500;

    const stages = [1, 2, 3, 4].map(n => ({
      hiker: document.querySelector('.edu-hiker--' + n),
      detail: document.querySelector('.edu-stop-detail[data-hiker="' + n + '"]')
    }));

    function setZoom(n, on){
      const { hiker, detail } = stages[n - 1];
      if(hiker) hiker.classList.toggle('is-hovered', on);
      if(detail) detail.classList.toggle('is-hovered', on);
    }

    function markBumpDone(detail){
      if(detail) detail.classList.add('is-bump-done');
    }

    function runSequence(){
      const lastBumpAt = (stages.length - 1) * HANDOFF_MS;
      const sequenceSpanMs = lastBumpAt + 250; // matches unlockHover's own timing - the full visible relay, start to settle

      // Stage 5's TEXT dulls down UNIFORMLY (linear, constant rate) across
      // that exact span - starting the instant stage 1 bumps, finishing
      // right as stage 4 settles - instead of a late one-shot fade. Driven
      // via a temporary inline transition (long + linear) rather than
      // is-victory-dimmed's own 0.25s one, which is reserved for snappy
      // hover recovery afterward. Once the span completes, is-victory-
      // dimmed is added (same 90% target, so no visual jump) and the
      // inline override is cleared, handing control back to that fast
      // CSS transition for any later hover in/out.
      if(detail5){
        detail5.style.transition = 'opacity ' + (sequenceSpanMs / 1000) + 's linear';
        detail5.style.opacity = '0.9';
        window.setTimeout(() => {
          detail5.classList.add('is-victory-dimmed');
          detail5.style.transition = '';
          detail5.style.opacity = '';
        }, sequenceSpanMs);
      }

      stages.forEach((stage, i) => {
        const n = i + 1;
        const bumpAt = i * HANDOFF_MS;
        window.setTimeout(() => setZoom(n, true), bumpAt);
        if(i < stages.length - 1){
          // shrink THIS one at the exact moment the NEXT one bumps - that's
          // also "its turn is over", so its text eases to 90% right then.
          const shrinkAt = bumpAt + HANDOFF_MS;
          window.setTimeout(() => setZoom(n, false), shrinkAt);
          window.setTimeout(() => markBumpDone(stage.detail), shrinkAt);
        } else {
          // the last stage in the relay (4) never shrinks - stays bumped,
          // so its "turn is over" the moment its own bump-in has visually
          // settled (250ms later) instead.
          window.setTimeout(() => markBumpDone(stage.detail), bumpAt + 250);
        }
      });
      window.setTimeout(unlockHover, lastBumpAt + 250);
    }

    let played = false;
    hiker5.addEventListener('transitionstart', (e) => {
      if(e.propertyName !== 'opacity' || played) return;
      played = true;
      window.setTimeout(runSequence, REVEAL_DURATION_MS - EARLY_MS);
    });
  })();

  /* ---------- Education: particle travel distance ----------
     flakeWave (see CSS) now sweeps particles via `transform:translate()`
     instead of animating `left` - transform is GPU-compositable, `left`
     isn't (it was forcing a layout recalc on every animated particle,
     every frame, which was the real source of the lag). transform's own
     percentage units are relative to the ELEMENT's own tiny size though,
     not its parent, so the sweep distance has to be an actual px value -
     --travel is measured once here and set on both shared layers; every
     .flake-group inherits it automatically via normal CSS custom-
     property inheritance.
     Measured from each layer's OWN clientWidth (not the mountain box) -
     since .edu-wind-layer now extends 300px past the mountain's edges on
     each side (left:-300px/right:-300px in the CSS), its clientWidth
     already includes that extra 600px, so the sweep naturally covers the
     full widened area instead of stopping at the SVG's own bounds. */
  (function(){
    const travelLayers = [document.getElementById('eduWind'), document.getElementById('eduWindFront')].filter(Boolean);
    if(!travelLayers.length) return;
    function syncTravel(){
      travelLayers.forEach(l => {
        const px = l.clientWidth || 2600;
        l.style.setProperty('--travel', px + 'px');
      });
    }
    syncTravel();
    window.addEventListener('resize', syncTravel);
    window.addEventListener('load', syncTravel);
  })();

  /* ---------- Education: mini flakes ----------
     Small flakes, spinning continuously as they drift via the shared
     flakeWave travel/wave motion, with a .flake--mini child that rotates
     on its own separate timer. */
  (function(){
    const windLayer = document.getElementById('eduWind');
    const windLayerFront = document.getElementById('eduWindFront');
    if(!windLayer || !windLayerFront) return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const COUNT = 26; // was 12 - more small rotating flakes drifting through the scene
    const TOP_FRONT_BAND = 40; // particles spawning above this % go in front - the opaque summit snow hides the behind-everything layer up there
    const rand = (min, max) => min + Math.random() * (max - min);
    const frag = document.createDocumentFragment();
    const fragFront = document.createDocumentFragment();

    for(let i = 0; i < COUNT; i++){
      const group = document.createElement('div');
      group.className = 'flake-group';

      const top = rand(0, 100);
      const size = rand(0.12, 0.35);       // smaller than the wind-flake range
      const duration = rand(1.8, 2.7);     // horizontal speed - wider spread, moderately slow
      const delay = -Math.random() * duration;
      const waveAmp = rand(10, 26);

      group.style.top = top + '%';
      group.style.width = (1.1 * size).toFixed(2) + '%';
      group.style.animationDuration = duration.toFixed(2) + 's';
      group.style.animationDelay = delay.toFixed(2) + 's';
      group.style.setProperty('--wave-amp', waveAmp.toFixed(0) + 'px');

      const flake = document.createElement('div');
      flake.className = 'flake flake--mini';
      const spinDur = rand(0.8, 2.2);
      const spinDeg = (Math.random() < 0.5 ? -1 : 1) * rand(360, 900);
      flake.style.animationDuration = spinDur.toFixed(2) + 's';
      flake.style.setProperty('--spin-deg', spinDeg.toFixed(0) + 'deg');
      group.appendChild(flake);

      (top < TOP_FRONT_BAND ? fragFront : frag).appendChild(group);
    }
    windLayer.appendChild(frag);
    windLayerFront.appendChild(fragFront);
  })();

  /* ---------- Education: rare flake+wind particles ----------
     Just 3-4 flakes, each with a .wind streak through it, using
     flakeWaveRare (see CSS) - same physical sweep speed as the mini
     flakes below (the SWEEP_FRACTION math makes sure of that), just
     confined to a small window of a much longer, mostly-idle cycle, so
     they still show up rarely rather than as a constant stream. */
  (function(){
    const windLayer = document.getElementById('eduWind');
    const windLayerFront = document.getElementById('eduWindFront');
    if(!windLayer || !windLayerFront) return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const COUNT = 3 + Math.round(Math.random()); // 3 or 4
    const SWEEP_FRACTION = 0.15; // must match the 85%->100% window in flakeWaveRare
    const TOP_FRONT_BAND = 40; // particles spawning above this % go in front - the opaque summit snow hides the behind-everything layer up there
    const rand = (min, max) => min + Math.random() * (max - min);
    const frag = document.createDocumentFragment();
    const fragFront = document.createDocumentFragment();

    for(let i = 0; i < COUNT; i++){
      const group = document.createElement('div');
      group.className = 'flake-group flake-group--rare';

      const top = rand(0, 100);
      const size = rand(0.35, 0.7);
      const sweepTime = rand(1.8, 2.7);              // same range as the mini flakes' duration - matches their speed
      const duration = sweepTime / SWEEP_FRACTION;   // stretches the surrounding idle/cycle time, not the sweep itself
      const delay = -Math.random() * duration;
      const waveAmp = rand(18, 36);

      group.style.top = top + '%';
      group.style.width = (1.1 * size).toFixed(2) + '%';
      group.style.animationDuration = duration.toFixed(2) + 's';
      group.style.animationDelay = delay.toFixed(2) + 's';
      group.style.setProperty('--wave-amp', waveAmp.toFixed(0) + 'px');

      const wind = document.createElement('div');
      wind.className = 'wind';
      const flake = document.createElement('div');
      flake.className = 'flake';
      group.appendChild(wind);
      group.appendChild(flake);

      (top < TOP_FRONT_BAND ? fragFront : frag).appendChild(group);
    }
    windLayer.appendChild(frag);
    windLayerFront.appendChild(fragFront);
  })();

  /* ---------- Achievement toasts ---------- */
  const achievementToastsWrap = document.getElementById('achievementToasts');
  const ACHIEVEMENTS = [
    { selector: '#about',        icon: '🧭', title: 'The Origin Story',       rgb: '167,109,255' },
    { selector: '#stats',        icon: '📊', title: "The Numbers Don't Lie",  rgb: '239,68,68' },
    { selector: '#education',    icon: '🎓', title: 'The Learning Path',      rgb: '34,211,238' },
    { selector: '#projects',     icon: '⚡', title: 'Built From Scratch',     rgb: '34,197,94' },
    { selector: '#achievements', icon: '🏆', title: 'Trophy Room',            rgb: '255,209,0' },
    { selector: '#epilogue',     icon: '📖', title: 'The Perfect Portfolio',   rgb: '245,246,248' },
  ];
  const ACHIEVEMENT_VISIBLE_MS = 3400;

  function spawnAchievementToast(icon, title, rgb){
    if(!achievementToastsWrap) return;
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    if(rgb) toast.style.setProperty('--toast-rgb', rgb);
    toast.innerHTML = `
      <div class="achievement-toast-inner">
        <div class="achievement-toast-icon">${icon}</div>
        <div class="achievement-toast-copy">
          <p class="achievement-toast-eyebrow">Achievement Unlocked</p>
          <p class="achievement-toast-title">${title}</p>
        </div>
      </div>
    `;
    achievementToastsWrap.appendChild(toast);
    requestAnimationFrame(() => { requestAnimationFrame(() => toast.classList.add('is-shown')); });

    setTimeout(() => {
      toast.classList.remove('is-shown');
      toast.classList.add('is-leaving');
      toast.addEventListener('transitionend', () => toast.remove(), { once:true });
      /* transitionend never fires under prefers-reduced-motion (or if the
         tab is backgrounded mid-leave) - make sure the node still gets
         removed instead of piling up invisibly. remove() on an already
         detached node is a safe no-op. */
      setTimeout(() => toast.remove(), 800);
    }, ACHIEVEMENT_VISIBLE_MS);
  }

  /* the epilogue's own "The Perfect Portfolio" toast is triggered from a
     completion-detection listener further down (near the epilogue letter's
     own reveal logic) instead of the generic scroll-into-view observer
     below, since it needs to fire once the LETTER is actually finished,
     not just once the section is scrolled into view. This flag guarantees
     it can only ever spawn once per page load, no matter how many
     different paths call fireEpilogueAchievement() (normal read, the skip
     button, or a replay re-triggering the same completion condition). */
  let epilogueAchievementFired = false;
  function fireEpilogueAchievement(){
    if(epilogueAchievementFired) return;
    epilogueAchievementFired = true;
    const epilogueAch = ACHIEVEMENTS.find(a => a.selector === '#epilogue');
    if(epilogueAch) spawnAchievementToast(epilogueAch.icon, epilogueAch.title, epilogueAch.rgb);
  }

  const achievementObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        const match = ACHIEVEMENTS.find(a => document.querySelector(a.selector) === entry.target);
        /* the epilogue toast is timed to the end of the letter instead */
        if(match && match.selector !== '#epilogue') setTimeout(() => spawnAchievementToast(match.icon, match.title, match.rgb), 1000);
        achievementObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  ACHIEVEMENTS.forEach(a => {
    const el = document.querySelector(a.selector);
    if(el) achievementObserver.observe(el);
  });

  /* Size each stat-bar to match its label's text width */
  function measureTextWidth(text, font){
    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.visibility = 'hidden';
    span.style.whiteSpace = 'nowrap';
    span.style.font = font;
    span.textContent = text;
    document.body.appendChild(span);
    const w = span.getBoundingClientRect().width;
    document.body.removeChild(span);
    return w;
  }

  function syncStatBars(){
    document.querySelectorAll('.stat-node').forEach(node => {
      const caption = node.querySelector('.stat-caption');
      const bar = node.querySelector('.stat-bar');
      if(!caption || !bar) return;
      const cs = getComputedStyle(caption);
      const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const lines = caption.innerHTML.split(/<br\s*\/?>/i).map(l => l.replace(/<[^>]+>/g, '').trim());
      let maxWidth = 0;
      lines.forEach(line => {
        const w = measureTextWidth(line, font);
        if(w > maxWidth) maxWidth = w;
      });
      if(maxWidth > 0) bar.style.width = Math.round(maxWidth) + 'px';
    });
  }
  syncStatBars();
  window.addEventListener('resize', syncStatBars);

  /* ---------- Act II: scroll-triggered reveal ---------- */
  const SECONDS_PER_WORD_SINGLE_LINE = 0.3;
  const SECONDS_PER_WORD_MULTI_LINE = 0.25;
  const FLAT_SHORT_LINE_SECONDS = 1;
  const FLAT_TIME_LINES = new Set([
    'A random Stack Overflow answer.',
    'You had no idea Java was coming.'
  ]);
  /* Extra pause (in seconds) before specific lines reveal */
  const EXTRA_DELAY_SECONDS = new Map([
    ["It started on quiet afternoons nobody was watching, in late nights where one bug just wouldn't quit, and in the number of times giving up would honestly have been the easier option.", 0.7]
  ]);
  const epilogueLines = Array.from(document.querySelectorAll('.epilogue-letter [data-reveal]'));
  let cumulativeDelay = 0;
  /* the divider itself never adds to cumulativeDelay (it's weightless), so
     at the moment we reach one, cumulativeDelay already equals the delay
     the addressee line right after it will use - and prevAppliedDelay is
     whatever the last line of the PREVIOUS section landed on. The divider
     now fires exactly halfway between those two, instead of a flat "1s
     before the line below" regardless of how big that gap actually is. */
  let prevAppliedDelay = 0;
  epilogueLines.forEach(el => {
    const isDivider = el.classList.contains('epilogue-divider');
    const text = el.textContent.trim();
    cumulativeDelay += EXTRA_DELAY_SECONDS.get(text) || 0;
    const appliedDelay = isDivider ? (prevAppliedDelay + cumulativeDelay) / 2 : cumulativeDelay;
    el.style.transitionDelay = `${appliedDelay}s`;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const weight = el.classList.contains('epilogue-addressee') ? 2 : 1;
    if(!isDivider && (wordCount < 4 || FLAT_TIME_LINES.has(text))){
      cumulativeDelay += FLAT_SHORT_LINE_SECONDS * weight;
      prevAppliedDelay = appliedDelay;
      return;
    }
    const lineHeightPx = parseFloat(getComputedStyle(el).lineHeight) || 1;
    const lineCount = lineHeightPx > 0 ? Math.round(el.offsetHeight / lineHeightPx) : 1;
    const secondsPerWord = lineCount <= 1 ? SECONDS_PER_WORD_SINGLE_LINE : SECONDS_PER_WORD_MULTI_LINE;
    cumulativeDelay += wordCount * secondsPerWord * weight;
    prevAppliedDelay = appliedDelay;
  });

  /* the ONE true record of each line's real reading-paced delay, captured
     right after the loop above computes them and before anything (skip-
     ahead, replay) ever gets a chance to overwrite el.style.transitionDelay
     with something temporary. Anything that needs to restore a line's
     "real" pacing later (skip-ahead's cleanup below) reads from this Map
     instead of trusting whatever's currently sitting in the inline style. */
  const epilogueOriginalDelays = new Map(epilogueLines.map(el => [el, el.style.transitionDelay]));

  /* set by the music-widget block further down (only if the epilogue's
     audio widget actually exists on the page) to a function that fades the
     volume bar to 0 and the progress bar to 100% over a given duration,
     then treats the song as ended - lets the skip button below (defined
     earlier in the file, so it can't reach into that block's private
     state directly) trigger the "song fades out and finishes exactly when
     the letter does" illusion with a simple function call. */
  let triggerSkipAheadMusicEnding = null;

  /* same indirection as triggerSkipAheadMusicEnding above, set by the
     music-widget block to a function that makes the mute button and volume
     slider stop responding to clicks/drags/keyboard for a given duration -
     called the instant Skip is pressed so nothing about the music can be
     touched while the compressed reveal is mid-flight (would otherwise
     race against the auto-fade/auto-end illusion above), released again
     once the whole skip sequence (quick-locate hop + compressed reveal
     scroll) has actually finished. */
  let lockMusicWidgetForSkip = null;

  /* ---------- Epilogue: skip-ahead button ----------
     Shows up once the "For Mom and Dad..." line has actually finished
     fading in (not just when the epilogue enters view) - listens for that
     one line's own transitionend rather than a fixed timer, so it stays
     correct even if the reveal pacing above ever changes. Clicking it
     fast-forwards every line that hasn't revealed yet through a short,
     compressed stagger instead of their normal reading-paced delays. The
     song itself keeps playing from wherever it already was, but is faded
     out and treated as "ended" in sync with the compressed reveal (see
     triggerSkipAheadMusicEnding above) - the illusion that the song ends
     exactly when the letter does. The listener is left attached (not
     removed after firing once) so this also re-arms correctly if the
     letter gets withered and replayed later. */
  (function(){
    const skipBtn = document.getElementById('epilogueSkipBtn');
    const momDadLine = epilogueLines.find(el => el.textContent.trim() === 'For Mom and Dad...');
    if(!skipBtn || !momDadLine) return;

    /* armed = the mom/dad line has revealed and it hasn't been clicked yet.
       Gates the .is-visible fade the same way it always did. is-leaving
       gets added right at the moment it's going from shown to hidden (not
       on the very first call, when it was never visible to begin with) so
       the CSS wither can target its own upward exit rather than just the
       entrance's starting position. */
    let skipBtnArmed = false;
    /* true once the letter's very last line (the signature) has actually
       finished revealing - see the lastLine watcher further down. Disarms
       the button, since there's nothing left below it to skip to. (Used to
       also switch its wither to a special downward variant, back when the
       default wither went upward - now that appearing/disappearing both
       go downward by default, there's nothing extra left for this to
       toggle visually, it just gates shouldBeArmed below.) */
    let letterComplete = false;
    function syncSkipBtnVisibility(){
      const wasVisible = skipBtn.classList.contains('is-visible');
      if(!skipBtnArmed && wasVisible) skipBtn.classList.add('is-leaving');
      if(skipBtnArmed) skipBtn.classList.remove('is-leaving');
      skipBtn.classList.toggle('is-visible', skipBtnArmed);
    }

    /* Deterministic JS instead of CSS position:sticky - plain arithmetic
       I can actually verify by reading the code, rather than trusting a
       browser layout algorithm I have no way to render and check here.
       While unparked, the button is plain position:fixed (tracks the
       viewport normally, exactly like it always did). The instant the
       footer comes within FOOTER_TRIGGER_MARGIN of the viewport, it
       freezes: read where it's CURRENTLY sitting on screen (which, since
       it's still fixed at bottom:24px, is just window.innerHeight - 24 -
       its own height), convert that to a document coordinate by adding the
       current scrollY, and switch to position:absolute with that as an
       explicit inline top. From that point it's ordinary in-flow content
       and scrolls away with the page like anything else. Scrolling back up
       past the trigger point switches it back to position:fixed, which
       makes it resume tracking the viewport immediately since fixed
       positioning is always relative to the current viewport, not
       wherever it happened to be. */
    const footerSection = document.getElementById('closing');
    const SKIP_BTN_REST_GAP = 12; // was 10, then 24 originally - nudged 2px higher
    const FOOTER_TRIGGER_MARGIN = 8; // was 28 - parks even later, right at the footer's edge
    let skipBtnParked = false;

    function parkSkipBtn(){
      if(skipBtnParked) return;
      /* .is-parked makes this position:absolute, whose containing block is
         .content-section-inner (position:relative, AND max-width:1080px
         centered via margin:0 auto - not full viewport width). So both
         "top" AND "right" need to be measured as offsets from THAT
         ancestor's own edges, not from the page root / viewport - using
         right:24px unmodified was measuring 24px from the centered 1080px
         column's edge, not the real screen edge, which is why it landed
         well short of "very right". Switching to an explicit "left"
         (computed from the real viewport width) sidesteps that entirely.
         Both rects are read here, back-to-back, while the button is still
         position:fixed, so the deltas are accurate for however this page
         happens to be structured. */
      const containingBlock = skipBtn.closest('.content-section-inner') || skipBtn.offsetParent || document.body;
      const btnRect = skipBtn.getBoundingClientRect();
      const containerRect = containingBlock.getBoundingClientRect();
      let desiredScreenTop = window.innerHeight - SKIP_BTN_REST_GAP - btnRect.height;
      /* safety clamp for fast scrolling: IntersectionObserver callbacks
         aren't guaranteed to fire on every single frame, so a fast flick
         can cross the FOOTER_TRIGGER_MARGIN zone and only get noticed
         several frames later - by which point the footer may have already
         scrolled further up than expected, and "current viewport bottom"
         would land the button ON TOP OF the footer's own (very dark)
         background instead of the gap just above it, reading as if it
         had vanished. Re-checking the footer's actual live position here
         and clamping against it means the button can never render lower
         than just above the footer's real edge, no matter how late this
         callback ends up firing. */
      if(footerSection){
        const footerTopNow = footerSection.getBoundingClientRect().top;
        const maxScreenTop = footerTopNow - SKIP_BTN_REST_GAP - btnRect.height;
        desiredScreenTop = Math.min(desiredScreenTop, maxScreenTop);
      }
      /* horizontal uses the button's OWN current on-screen left edge
         (btnRect.left), not a separately recomputed gap - it was
         previously using SKIP_BTN_REST_GAP here too, which is a DIFFERENT
         number than the floating button's actual CSS right:24px (or 16px
         on the mobile breakpoint), so the docked version landed a bit
         further right than the floating one. Reading its real current
         position instead guarantees an exact match, on any screen size,
         with zero risk of the two numbers drifting apart again. */
      const desiredScreenLeft = btnRect.left;
      skipBtn.style.top = (desiredScreenTop - containerRect.top) + 'px';
      skipBtn.style.left = (desiredScreenLeft - containerRect.left) + 'px';
      skipBtn.style.right = 'auto';
      skipBtn.classList.add('is-parked');
      skipBtnParked = true;
    }
    function unparkSkipBtn(){
      if(!skipBtnParked) return;
      skipBtn.classList.remove('is-parked');
      skipBtn.style.top = '';
      skipBtn.style.left = '';
      skipBtn.style.right = '';
      skipBtnParked = false;
    }
    if(footerSection){
      const footerNearObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if(entry.isIntersecting) parkSkipBtn();
          else unparkSkipBtn();
        });
      }, { threshold:0, rootMargin:`0px 0px ${FOOTER_TRIGGER_MARGIN}px 0px` });
      footerNearObserver.observe(footerSection);
    }

    /* momDadRevealed = "For Mom and Dad..." has finished fading in this
       pass. scrolledPastLeadLine = the letter's own OPENING line ("None of
       this started with a line of code.") has actually scrolled up OFF
       the top of the viewport - not just "is it on screen right now",
       which would only cover the narrow moment it's passing through. This
       needs to also stay false (button hidden) for the entire time BEFORE
       the reader ever reaches the epilogue at all, and flip back to false
       again if they scroll back up far enough to bring that opening line
       back into view - "hidden above the epilogue", full stop, not just
       "hidden while that one line happens to be visible". Kept as two
       separate booleans (rather than folding straight into skipBtnArmed)
       so either one changing re-derives the same combined answer instead
       of two different code paths fighting over what skipBtnArmed should
       be. */
    let momDadRevealed = false;
    let scrolledPastLeadLine = false;
    function refreshSkipBtnArmedState(){
      const shouldBeArmed = momDadRevealed && scrolledPastLeadLine && !skipBtn.disabled && !letterComplete;
      if(shouldBeArmed === skipBtnArmed) return;
      skipBtnArmed = shouldBeArmed;
      syncSkipBtnVisibility();
    }

    function revealSkipBtn(){
      skipBtn.disabled = false;
      momDadRevealed = true;
      /* a fresh pass through the letter has genuinely reached this line
         again (replay's own forward reveal only gets here AFTER its wither
         and scroll-to-top have both fully finished) - any earlier
         completion no longer applies. Deliberately reset HERE and nowhere
         earlier in the wither: resetting the moment the last line's own
         is-visible gets removed (much earlier, since the wither runs
         bottom-to-top) would re-arm the button while still mid-wither,
         before the scroll has caught up - a visible flash-in/flash-out. */
      letterComplete = false;
      refreshSkipBtnArmedState();
    }

    if(reduceMotion){
      // no transition to key off of - just watch the line's own class
      const momDadClassObserver = new MutationObserver(() => {
        if(momDadLine.classList.contains('is-visible')) revealSkipBtn();
      });
      momDadClassObserver.observe(momDadLine, { attributes:true, attributeFilter:['class'] });
      if(momDadLine.classList.contains('is-visible')) revealSkipBtn();
    } else {
      momDadLine.addEventListener('transitionend', (e) => {
        if(e.target !== momDadLine || e.propertyName !== 'opacity') return;
        // only the fade-IN direction should arm the button, not the wither-
        // out one (is-visible is removed before the wither transition
        // starts, so this check tells the two apart)
        if(momDadLine.classList.contains('is-visible')) revealSkipBtn();
      });
    }

    /* the letter's opening line, not the section wrapper - watching the
       section itself would only fire once, right at the very top of the
       scroll-into-view; this needs to keep reporting in/out every time the
       reader crosses it in either direction, for as long as the epilogue
       is being read. Deliberately NOT using entry.isIntersecting directly -
       that's true the moment the line is anywhere on screen, including the
       instant it first scrolls up from below (i.e. "about to be read"),
       which would arm the button too early. What actually matters is which
       EDGE it's crossing: boundingClientRect.bottom <= 0 means the whole
       line has scrolled up past the top of the viewport - only then have
       we truly moved on from it. Scrolling back up re-crosses that same
       line the other way and flips it back to false. */
    const leadLine = document.querySelector('.epilogue-lead');
    if(leadLine){
      const leadLineObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          scrolledPastLeadLine = entry.boundingClientRect.bottom <= 0;
          refreshSkipBtnArmedState();
        });
      }, { threshold: 0 });
      leadLineObserver.observe(leadLine);
    }

    /* the letter's very last line (the signature, "—") - once it's actually
       finished revealing, the letter is done and there's nothing left below
       to skip to, so the button disarms itself (via refreshSkipBtnArmedState,
       letterComplete gates shouldBeArmed). The reset back to false lives in
       revealSkipBtn() above, not here - same pattern (reduceMotion class
       watcher vs. transitionend) as the achievement toast's own completion
       detection just below this IIFE. */
    const lastLine = epilogueLines[epilogueLines.length - 1];
    if(lastLine){
      function markLetterComplete(){
        if(letterComplete) return;
        letterComplete = true;
        refreshSkipBtnArmedState();
      }
      if(reduceMotion){
        const lastLineClassObserver = new MutationObserver(() => {
          if(lastLine.classList.contains('is-visible')) markLetterComplete();
        });
        lastLineClassObserver.observe(lastLine, { attributes:true, attributeFilter:['class'] });
        if(lastLine.classList.contains('is-visible')) markLetterComplete();
      } else {
        lastLine.addEventListener('transitionend', (e) => {
          if(e.target !== lastLine || e.propertyName !== 'opacity') return;
          if(lastLine.classList.contains('is-visible')) markLetterComplete();
        });
      }
    }

    skipBtn.addEventListener('click', () => {
      if(skipBtn.disabled) return;
      skipBtn.classList.add('is-clicked');
      skipBtn.addEventListener('animationend', () => skipBtn.classList.remove('is-clicked'), { once:true });
      skipBtn.disabled = true;
      skipBtnArmed = false;
      syncSkipBtnVisibility(); // withers away the same way the letter's own lines do

      /* is-visible gets added to EVERY line the moment the epilogue first
         scrolls into view - the reading-paced feel comes entirely from each
         line's own transition-delay, not from the class being added one at
         a time. So classList.contains('is-visible') can't tell us which
         lines have actually finished appearing on screen yet; their live
         computed opacity can. Same stagger mechanism the wither/replay
         sequence above uses (remove -> reflow -> new delay -> reflow ->
         re-add, so the transition is genuinely re-triggered instead of
         silently ignored because the class never left), just a touch slower
         than that effect's own 0.035s-per-line pace. */
      const SKIP_STAGGER = 0.07;
      const pending = epilogueLines.filter(el => parseFloat(getComputedStyle(el).opacity) < 0.98);
      if(!pending.length) return;

      // was native window.scrollTo({behavior:'smooth'}) - its duration is
      // entirely up to the browser (usually a quick ~300ms) with no way to
      // slow it down directly. Switched to the site's own hand-timed
      // smoothScrollTo instead, purely so this quick "locate" hop can be
      // tuned - QUICK_LOCATE_MS controls its speed directly.
      const QUICK_LOCATE_MS = 950; // was 650 - a little slower

      // a beat of held stillness right before the compressed reveal actually
      // kicks off (after the quick-locate hop, if there was one) - was
      // instant, felt too abrupt going straight from "arrived" into the
      // fast stagger
      const SKIP_REVEAL_START_DELAY_MS = 1500; // was 1000 - half a second more

      /* stretches the compressed reveal's own scroll a bit further than the
         text itself takes to finish, so the camera glides at a calmer pace
         throughout rather than racing to keep up with the (faster) text
         reveal. Reveal pacing itself (SKIP_STAGGER) is untouched. Computed
         upfront (not inside beginCompressedReveal) because the "song fades
         out and finishes with the letter" illusion below needs the total
         click-to-finish runtime BEFORE any of the scrolling actually starts. */
      const SCROLL_DURATION_MULTIPLIER = 1.6;
      const textRevealDurationMs = reduceMotion ? 0 : ((pending.length - 1) * SKIP_STAGGER + 1.4) * 1000;
      const revealDurationMs = textRevealDurationMs * SCROLL_DURATION_MULTIPLIER;

      const revealedLines = epilogueLines.filter(el => !pending.includes(el));
      const currentLine = revealedLines[revealedLines.length - 1];
      const willQuickLocate = !reduceMotion && currentLine;

      /* the mute button/volume slider go unresponsive the instant Skip is
         pressed - not just once the long scroll actually starts, so there's
         no gap where a click could sneak in and race the auto-fade/auto-
         end illusion started later in beginCompressedReveal - and stay that
         way until the button itself actually flips to the replay icon (see
         unlockMusicWidgetForSkip, called right alongside skipEndedOverride
         going true). Deliberately NOT a timer sized to match that moment -
         a duplicated duration guess here would silently drift out of sync
         with the real one the instant either timing path changes later. */
      if(lockMusicWidgetForSkip) lockMusicWidgetForSkip();

      /* everything that was previously here (the compressed reveal + the
         long synced scroll to the end) now runs AFTER a quick preliminary
         hop to wherever the reveal currently sits - the last line that's
         already fully visible, i.e. "where the reader actually is" right
         now. That first hop uses the browser's own native smooth-scroll
         (same thing a plain <a href="#section"> jump triggers) rather than
         the hand-rolled one below - it's a short, small nudge where letting
         the browser pick its own quick timing reads better than forcing an
         exact duration on it, and reserves the precisely-timed custom easing
         for the long scroll to the end where staying in sync with the
         reveal actually matters. */
      const beginCompressedReveal = () => {
        const lastPendingLine = pending[pending.length - 1];
        const lastRect = lastPendingLine.getBoundingClientRect();
        const targetY = lastRect.top + window.scrollY - (window.innerHeight / 2) + (lastRect.height / 2);

        /* Auto-fade + auto-finish illusion: kicked off right here, at the
           exact moment the downward scroll to the end actually begins (not
           back when Skip was first clicked, which could've been a whole
           quick-locate hop earlier) - a "current state" keyframe for both
           the volume bar and the progress bar, animating to their "track
           over" state over exactly the time this scroll itself takes
           (revealDurationMs), so both land right as the letter finishes.
           Runs immediately, same as the scroll below - only the lines'
           own withering/reveal stagger (below) is held back a beat. */
        if(triggerSkipAheadMusicEnding) triggerSkipAheadMusicEnding(revealDurationMs);

        smoothScrollTo(targetY, revealDurationMs);

        /* just the withering/reveal itself held back a beat before it
           starts - was instant, felt too abrupt going straight from
           "arrived" into the fast stagger. Scroll and the music illusion
           above are untouched by this, they still start right away. */
        window.setTimeout(() => {
          pending.forEach(el => el.classList.remove('is-visible'));
          void document.body.offsetWidth;
          pending.forEach((el, i) => {
            el.style.transitionDelay = reduceMotion ? '0s' : `${i * SKIP_STAGGER}s`;
          });
          void document.body.offsetWidth;
          pending.forEach(el => el.classList.add('is-visible'));

          /* once each line's compressed-delay transition has actually finished
             playing, put its transitionDelay back the way it really was -
             otherwise the leftover compressed value sits in the inline style
             forever, and a later replayEpilogue() would mistake it for the
             line's true original pacing (that's the "blank lines after
             replay" bug). Restored from epilogueOriginalDelays, the one
             immutable record captured before skip ever touched anything. */
          window.setTimeout(() => {
            pending.forEach(el => {
              el.style.transitionDelay = epilogueOriginalDelays.get(el) || '';
            });
          }, textRevealDurationMs);
        }, SKIP_REVEAL_START_DELAY_MS);
      };

      if(!willQuickLocate){
        beginCompressedReveal();
        return;
      }

      const curRect = currentLine.getBoundingClientRect();
      const curTargetY = curRect.top + window.scrollY - (window.innerHeight / 2) + (curRect.height / 2);
      smoothScrollTo(curTargetY, QUICK_LOCATE_MS, beginCompressedReveal);
    });
  })();

  /* ---------- Epilogue: "The Perfect Portfolio" achievement ----------
     Fires off the LAST line's own transitionend (same pattern as the skip
     button's mom-dad-line arming above) instead of a fixed timer guessed
     from the normal reading pace - a fixed timer would fire at the wrong
     moment (or not fire correctly at all) whenever the skip button
     compresses the reveal instead of letting it run at its scheduled pace.
     This listener is never removed, so it also fires again every time a
     replay re-reveals the last line - but fireEpilogueAchievement() itself
     guards on epilogueAchievementFired, so no matter how many times this
     underlying condition re-triggers, the toast can only ever actually
     spawn once for the whole page load. */
  (function(){
    const lastLine = epilogueLines[epilogueLines.length - 1];
    if(!lastLine) return;
    function onLastLineRevealed(){
      window.setTimeout(fireEpilogueAchievement, 2000); // was 1000 - triggers 1s later
    }
    if(reduceMotion){
      const lastLineObserver = new MutationObserver(() => {
        if(lastLine.classList.contains('is-visible')) onLastLineRevealed();
      });
      lastLineObserver.observe(lastLine, { attributes:true, attributeFilter:['class'] });
      if(lastLine.classList.contains('is-visible')) onLastLineRevealed();
    } else {
      lastLine.addEventListener('transitionend', (e) => {
        if(e.target !== lastLine || e.propertyName !== 'opacity') return;
        if(lastLine.classList.contains('is-visible')) onLastLineRevealed();
      });
    }
  })();

  let musicWidgetUnlocked = false;

  const epilogueLetterEl = document.querySelector('.epilogue-letter');
  if(epilogueLetterEl){
    const musicWidget = document.querySelector('.music-widget');
    const musicArt = document.getElementById('musicArt');
    const musicStatus = document.getElementById('musicStatus');
    const epilogueAudio = document.querySelector('.epilogue-audio');

    /* userVolume IS the volume bar's own value, and is the single holder for
       "what the volume currently is" - there's no separate shadow copy of it
       anywhere else. lastVolume just remembers the most recent non-zero
       value userVolume has held, updated automatically in the one function
       (setVolume, below) that's allowed to change userVolume at all - drag,
       keyboard, mute-click and replay all route through it, so there's no
       second code path that could set the volume without also keeping
       lastVolume in sync (that split bookkeeping was the mute button's bug).
       displayedVolume is separate again - it's fadeVolume()'s own live
       "where the audio's *actual* volume is right now, mid-fade" tracker. */
    let scoreMuted = true;
    let fadeRaf = null;
    let userVolume = 1;
    let lastVolume = 1;
    let displayedVolume = 0;
    /* forced true by the skip-ahead "song fades out and ends with the
       letter" illusion (see triggerSkipAheadMusicEnding below) - the real
       epilogueAudio element never actually reaches its own end when the
       reader skips ahead (it just keeps quietly playing in the
       background), so updateMusicState() needs a second way to know the
       song should be TREATED as ended - button flips to the replay icon,
       "Ended" status text, etc. Cleared the moment a replay actually starts. */
    let skipEndedOverride = false;
    /* while true, renderMusicProgress (below) leaves the progress bar alone -
       set for the duration of the skip-ahead "fill up to 100%" illusion so
       the real currentTime/duration-driven timeupdate updates don't fight
       the forced CSS transition to 100% mid-flight. */
    let skipProgressOverrideActive = false;
    /* true for the whole duration of the skip sequence (quick-locate hop +
       compressed reveal scroll) - every interactive handler below (mute
       click, volume drag, volume keyboard nudge, the global "m" shortcut)
       bails out immediately while this is set, so nothing can touch the
       music mid-skip. Mirrored by the .is-skip-locked class (pointer-
       events:none) as a second, CSS-level line of defense for plain mouse
       clicks/drags. */
    let musicInteractionLocked = false;
    const musicIndicator = document.getElementById('musicIndicator');
    const musicVolume = document.getElementById('musicVolume');
    const musicVolumeTrack = musicVolume ? musicVolume.querySelector('.music-volume-track') : null;
    const musicVolumeFill = document.getElementById('musicVolumeFill');
    /* left-pill twin of the top bar's own controls (see the HTML comment
       above #epilogueMusicLeft) - same markup/classes, new IDs. Every
       function below that used to touch a single element now iterates the
       matching *Els array instead, so both controls stay mirrored with no
       duplicated logic anywhere - "act exactly like the top bar" means
       they're driven by the literal same code path, not a copy of it. */
    const musicIndicatorLeft = document.getElementById('musicIndicatorLeft');
    const musicVolumeLeft = document.getElementById('musicVolumeLeft');
    const musicVolumeTrackLeft = musicVolumeLeft ? musicVolumeLeft.querySelector('.music-volume-track') : null;
    const musicVolumeFillLeft = document.getElementById('musicVolumeFillLeft');
    const epilogueMusicLeftEl = document.getElementById('epilogueMusicLeft');
    const musicIndicatorEls = [musicIndicator, musicIndicatorLeft].filter(Boolean);
    const musicVolumeEls = [musicVolume, musicVolumeLeft].filter(Boolean);
    const musicVolumeFillEls = [musicVolumeFill, musicVolumeFillLeft].filter(Boolean);

    function renderVolume(){
      musicVolumeFillEls.forEach(el => { el.style.width = (userVolume * 100) + '%'; });
      musicVolumeEls.forEach(el => el.setAttribute('aria-valuenow', Math.round(userVolume * 100)));
    }

    /* the ONE place allowed to change userVolume (the bar) - everything else
       (drag, keyboard, the mute button, replay) calls this instead of poking
       userVolume/scoreMuted/epilogueAudio directly, so the "last known
       volume to restore on unmute" can never drift out of sync with what the
       bar is actually showing. */
    function setVolume(v, opts){
      opts = opts || {};
      if(!epilogueAudio) return;
      const clamped = Math.max(0, Math.min(1, v));
      const wasMuted = scoreMuted;
      userVolume = clamped;
      /* the bar itself remembers the last real (non-zero) level it held -
         "use the volume bar as the holder" instead of a separate variable
         that only gets updated in some of the places volume can change */
      if(clamped > 0.001) lastVolume = clamped;
      scoreMuted = clamped <= 0.001;
      renderVolume();

      if(opts.animate){
        musicVolumeFillEls.forEach(el => el.classList.add('is-fading'));
        // unmuting: audible immediately, volume ramps up from 0 - muting:
        // hard-mute only once the fade-out has actually finished (below),
        // so it doesn't cut off mid-fade
        if(!scoreMuted) epilogueAudio.muted = false;
        fadeVolume(displayedVolume, clamped, opts.duration || 400, () => {
          if(scoreMuted) epilogueAudio.muted = true;
        });
      } else {
        musicVolumeFillEls.forEach(el => el.classList.remove('is-fading'));
        if(fadeRaf){ cancelAnimationFrame(fadeRaf); fadeRaf = null; }
        displayedVolume = clamped;
        epilogueAudio.volume = clamped;
        epilogueAudio.muted = scoreMuted;
      }

      if(!scoreMuted && wasMuted){
        const p = epilogueAudio.play();
        if(p && typeof p.catch === 'function') p.catch(() => {});
      }
      updateMusicState();
    }

    /* single path for any direct volume set (pointer drag OR keyboard) -
       cancels an in-flight mute/unmute fade and applies the value 1:1 */
    function setUserVolume(v){
      setVolume(v, { animate:false });
    }

    /* trackEl defaults to the top bar's own track for backwards
       compatibility, but the left pill's pointer handlers below pass their
       own track explicitly - each slider measures against its OWN current
       on-screen position, not a shared one, since the two pills sit in
       completely different places. */
    function applyPointerVolume(e, trackEl){
      const track = trackEl || musicVolumeTrack;
      if(!track) return;
      const rect = track.getBoundingClientRect();
      setUserVolume((e.clientX - rect.left) / rect.width);
    }

    /* Replay: wither the whole letter away bottom-to-top (reusing the exact
       fade transition it revealed with, just run in reverse with a fast
       stagger instead of the slow reading-paced one), scroll back to the
       top of the epilogue, then replay the reveal at its original pacing
       and restart the score from 0 - the whole "read the letter" moment
       again, not just the audio. */
    let replayInProgress = false;
    function replayEpilogue(){
      // ignore repeat clicks while a replay is already animating - see below
      // for why the button would otherwise look "stuck" and keep re-firing this
      if(replayInProgress) return;
      replayInProgress = true;

      /* The wither+scroll sequence now takes a few seconds (0.5s start delay
         + the wither itself + settle time) before restartPlayback() actually
         runs. epilogueAudio.ended stays true that whole time, which used to
         leave the button visually stuck on its "replay" icon and mean every
         click just called replayEpilogue() again instead of toggling mute -
         "the mute button doesn't work after it's polymorphed once". Seeking
         away from the end immediately (playback stays paused; nothing
         audible changes) clears `ended` right away and updates the button
         back to its normal mute/unmute look before the animation even starts,
         so clicks during the wither correctly go through the mute toggle.
         Also clears skipEndedOverride, for the same reason - if the last
         "ended" state was faked by the skip button rather than the audio
         genuinely finishing, that fake flag needs to drop too or the
         button would stay stuck on the replay icon through the whole
         wither/replay sequence. */
      skipEndedOverride = false;
      /* same idea for the fake "filled to 100%" progress bar from a skipped
         ending - drop the override and snap the bar back down immediately
         (currentTime is being reset to 0 on the next line anyway) instead
         of leaving it visually stuck at 100% through the whole wither. */
      skipProgressOverrideActive = false;
      if(musicProgressFill){
        musicProgressFill.style.transitionDuration = '';
        musicProgressFill.style.width = '0%';
      }
      /* same again for the volume bar - the skip-ahead fade-out (below)
         sets an inline transitionDuration sized to the whole skip sequence
         (often several seconds) and never had anywhere to clear it back to
         the CSS default afterward, so it was silently sticking around and
         making every fade AFTER a skip - including this replay ramp-up -
         inherit that multi-second duration instead of the real 0.4s. */
      musicVolumeFillEls.forEach(el => { el.style.transitionDuration = ''; });
      epilogueAudio.currentTime = 0;
      updateMusicState();

      const restartPlayback = () => {
        epilogueAudio.currentTime = 0;
        displayedVolume = 0;
        epilogueAudio.volume = 0;
        setVolume(lastVolume || 1, { animate:true, duration:400 });
        const p = epilogueAudio.play();
        if(p && typeof p.catch === 'function') p.catch(() => {});
        replayInProgress = false;
      };

      /* Everything that used to run immediately on click now runs through
         this instead, so it can be deferred until AFTER the fast scroll to
         the last line (below) actually finishes - starting the wither's own
         scroll-to-top while that first scroll is still mid-flight would just
         cancel it early (both drive the same rAF-based smoothScrollTo). */
      const runWitherAndScrollSequence = () => {
        if(reduceMotion){
          epilogueLines.forEach(el => el.classList.remove('is-visible'));
          const epilogueSectionRM = document.getElementById('epilogue');
          if(epilogueSectionRM){
            const targetYRM = epilogueSectionRM.getBoundingClientRect().top + window.scrollY + 90;
            scrollInstant(targetYRM);
          }
          epilogueLines.forEach(el => el.classList.add('is-visible'));
          restartPlayback();
          return;
        }

        const n = epilogueLines.length;
        // was 0.035 - slowed to match the calmer pace the skip button's own
        // scroll now runs at, so both "batch" effects on this page read as
        // the same deliberate speed instead of the wither feeling rushed
        // next to it
        const WITHER_STAGGER = 0.07;
        const originalDelays = epilogueLines.map(el => el.style.transitionDelay);
        const WITHER_START_DELAY_MS = 1300; // was 500 - delayed an extra 0.8s
        const SCROLL_START_DELAY_MS = 1000;
        const witherTotalMs = (n * WITHER_STAGGER + 1.4) * 1000;

        /* scroll duration is directly derived from witherTotalMs, so slowing
           WITHER_STAGGER above automatically stretches this scroll to match
           - the two were always tied together, they just both needed to be
           slower together, which is exactly what changing WITHER_STAGGER
           alone now achieves. Scroll still waits a second before it starts;
           the wither still waits its own separate 1.3s before the lines
           start fading. Scroll duration still matches witherTotalMs (how
           long the wither takes once it gets going), so the wither finishes
           ~500ms after the scroll does rather than the two landing together
           - that's the intended effect here, not a bug. */
        const epilogueSection = document.getElementById('epilogue');
        window.setTimeout(() => {
          if(epilogueSection){
            const targetY = epilogueSection.getBoundingClientRect().top + window.scrollY + 90;
            smoothScrollTo(targetY, witherTotalMs);
          }
        }, SCROLL_START_DELAY_MS);

        window.setTimeout(() => {
          // wither bottom-to-top: last line starts fading first
          epilogueLines.forEach((el, i) => {
            el.style.transitionDelay = ((n - 1 - i) * WITHER_STAGGER) + 's';
            el.classList.remove('is-visible');
          });

          window.setTimeout(() => {
            window.setTimeout(() => {
              // restore each line's original reading-paced delay before revealing again
              epilogueLines.forEach((el, i) => { el.style.transitionDelay = originalDelays[i]; });
              void document.body.offsetWidth; // flush the delay change before re-triggering the transition
              epilogueLines.forEach(el => el.classList.add('is-visible'));
              restartPlayback();
            }, 1700); // upward reveal (translateY back to 0) - was 700ms, held 1s longer
          }, witherTotalMs);
        }, WITHER_START_DELAY_MS);
      };

      /* jump to the last line first - a fast-but-smooth scroll (not instant)
         so the "just finished reading" moment is visibly reasserted before
         the wither + scroll-back-to-top sequence takes over. Reduced-motion
         users skip straight to the sequence above, which already lands them
         on the right spot instantly on its own. */
      if(epilogueLines.length && !reduceMotion){
        const lastLine = epilogueLines[epilogueLines.length - 1];
        const lastLineRect = lastLine.getBoundingClientRect();
        const lastLineY = lastLineRect.top + window.scrollY - (window.innerHeight / 2) + (lastLineRect.height / 2);
        const LAST_LINE_SCROLL_MS = 450;
        smoothScrollTo(lastLineY, LAST_LINE_SCROLL_MS, runWitherAndScrollSequence);
      } else {
        runWitherAndScrollSequence();
      }
    }

    /* one-time poetic nudge to unmute - points up at the mute button the
       first time the widget itself becomes visible (scrolled past the
       epilogue heading, score unlocked), as long as it's still muted.
       Dismissed the instant the button is actually clicked, or after a
       few seconds on its own if it's ignored. */
    const musicHintEl = document.getElementById('musicHint');
    const musicHintLayerEl = musicHintEl ? musicHintEl.querySelector('.music-hint-layer') : null;
    const musicHintGlowEl = musicHintEl ? musicHintEl.querySelector('.music-hint-glow') : null;
    let musicHintVisible = false;
    let musicHintShowTimer = null;  // the "2s after the widget appears" delay
    let musicHintAutoHideTimer = null; // the "20s after it's shown" auto-dismiss
    let musicHintShownOnce = false; // the 2s delay above only applies before this is true
    let musicHintSettleCleanup = null; // cancels the "wait for widget's own slide-in" wait below
    let musicHintRaf = null;
    let musicHintDismissedForever = false; // set once the user touches the mute button or volume bar - hint never shows again this page load
    let musicHintFirstShownAt = null; // timestamp of the very first time it appeared - the 20s budget is measured from here, not from each individual reappearance

    function positionMusicHint(){
      if(!musicHintEl || !musicIndicator || !musicWidget) return;
      /* anchored to the WIDGET's own outer edge (not just the button's),
         with only a hairline gap - so the arrow visually touches the pill
         instead of floating below it with a noticeable gap. Horizontal
         position tracks the mute button (now the rightmost element in
         .music-side after the volume bar / button swap). */
      const buttonRect = musicIndicator.getBoundingClientRect();
      const widgetRect = musicWidget.getBoundingClientRect();
      /* the hint is translateX(-50%)-centred on this point and its arrow art
         is ~214px wide - on narrow screens centring on the mute button (far
         right of the widget) pushed the arrow's left edge off-screen, so
         clamp the centre point to keep the whole hint visible */
      const halfHintW = (musicHintEl.offsetWidth || 214) / 2;
      const desiredLeft = buttonRect.left + buttonRect.width / 2;
      musicHintEl.style.left = Math.min(Math.max(desiredLeft, halfHintW + 8), window.innerWidth - halfHintW - 8) + 'px';
      musicHintEl.style.top = (widgetRect.bottom + 2) + 'px';
    }

    /* Drives the hint's whole appear/disappear directly via rAF, rather than
       toggling a class and hoping a CSS transition fires - CSS transitions
       here kept silently snapping straight to the end state instead of
       animating (the browser coalescing the element's very-first paint with
       the state change), even with forced reflows. This is the exact same
       "set the value explicitly every frame" technique already proven
       reliable elsewhere in this file (fadeVolume, smoothScrollTo). */
    function runMusicHintTransition(showing){
      if(musicHintRaf) cancelAnimationFrame(musicHintRaf);
      const duration = 1000;
      const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; // easeInOutCubic
      /* arrow + text now live on one shared layer, animated together as a
         single unit (opacity/blur/translateY) so they can't visually desync -
         only the glow's own zoom (scale) still animates separately, since
         that's a detail unique to it, not part of the shared appear motion */
      const layerFrom = showing ? { op:0, blur:10, y:14 }  : { op:1, blur:0,  y:0 };
      const layerTo   = showing ? { op:1, blur:0,  y:0 }   : { op:0, blur:10, y:-14 };
      const glowFrom  = showing ? { scale:0 } : { scale:1 };
      const glowTo    = showing ? { scale:1 } : { scale:0 };
      const lerp = (a, b, t) => a + (b - a) * t;

      const start = performance.now();
      function frame(now){
        const raw = Math.min(1, (now - start) / duration);
        const t = ease(raw);
        if(musicHintLayerEl){
          musicHintLayerEl.style.opacity = lerp(layerFrom.op, layerTo.op, t);
          musicHintLayerEl.style.filter = `blur(${lerp(layerFrom.blur, layerTo.blur, t)}px)`;
          musicHintLayerEl.style.transform = `translateY(${lerp(layerFrom.y, layerTo.y, t)}px)`;
        }
        if(musicHintGlowEl){
          const glowScale = lerp(glowFrom.scale, glowTo.scale, t);
          musicHintGlowEl.style.transform = `translate(-50%,-50%) scale(${glowScale})`;
        }
        if(raw < 1){
          musicHintRaf = requestAnimationFrame(frame);
        } else {
          musicHintRaf = null;
        }
      }
      musicHintRaf = requestAnimationFrame(frame);
    }

    /* cancels whichever timer/listener is pending (the pre-show delay, the
       "wait for the widget to settle" wait, or the auto-hide countdown) and
       fades the hint out if it's currently showing - used both for the
       mute-button click and for the widget disappearing on scroll-up */
    function hideMusicHint(){
      if(musicHintShowTimer){ clearTimeout(musicHintShowTimer); musicHintShowTimer = null; }
      if(musicHintAutoHideTimer){ clearTimeout(musicHintAutoHideTimer); musicHintAutoHideTimer = null; }
      if(musicHintSettleCleanup){ musicHintSettleCleanup(); musicHintSettleCleanup = null; }
      if(!musicHintVisible) return;
      musicHintVisible = false;
      runMusicHintTransition(false);
    }

    // user touched the mute button or volume bar - hide it now and make sure
    // it can never come back for the rest of this page load (only a refresh
    // resets musicHintDismissedForever)
    function dismissMusicHintForever(){
      musicHintDismissedForever = true;
      hideMusicHint();
      if(musicHintObserver) musicHintObserver.disconnect();
    }

    function showMusicHintNow(){
      if(musicHintDismissedForever) return;
      if(musicHintVisible || !musicHintEl || !musicWidget) return;
      if(scoreMuted === false) return;
      /* the widget may have scrolled back out of view again during the wait
         below - don't pop the hint in over an already-hidden widget */
      if(!musicWidget.classList.contains('nav-slot-visible')) return;

      /* the 20s budget is measured from the very first time the hint ever
         appeared, not restarted on every reappearance - previously each
         scroll-away (which hides it) + scroll-back (which re-shows it) got
         its own fresh 20000ms timer, so repeatedly scrolling up and back
         down to the epilogue could keep the hint alive indefinitely even
         though its total on-screen budget had long since run out. */
      const now = Date.now();
      if(musicHintFirstShownAt === null) musicHintFirstShownAt = now;
      const remaining = 20000 - (now - musicHintFirstShownAt);
      if(remaining <= 0){
        dismissMusicHintForever();
        return;
      }

      musicHintVisible = true;
      musicHintShownOnce = true;
      positionMusicHint();
      runMusicHintTransition(true);
      musicHintAutoHideTimer = window.setTimeout(dismissMusicHintForever, remaining);
    }

    /* the widget itself slides/fades in over 0.5s (see .music-widget.nav-slot-
       visible above) - measuring its position before that finishes is what
       put the hint in the wrong place (up near the nav bar, mid-slide) every
       time it reappeared after the first show. This waits for that slide to
       actually finish (via transitionend, with a timeout fallback in case it
       never fires) before positioning + showing the hint. */
    function afterWidgetSettled(callback){
      if(musicHintSettleCleanup) musicHintSettleCleanup();
      let done = false;
      const finish = () => {
        if(done) return;
        done = true;
        musicWidget.removeEventListener('transitionend', onEnd);
        clearTimeout(fallback);
        musicHintSettleCleanup = null;
        callback();
      };
      const onEnd = (e) => {
        if(e.target === musicWidget && e.propertyName === 'transform') finish();
      };
      musicWidget.addEventListener('transitionend', onEnd);
      const fallback = window.setTimeout(finish, 550);
      musicHintSettleCleanup = () => {
        done = true;
        musicWidget.removeEventListener('transitionend', onEnd);
        clearTimeout(fallback);
      };
    }

    /* triggered off the widget's own class change (via MutationObserver)
       rather than the scroll event - previously the hint only got checked
       on every 'scroll' firing, so if the user stopped scrolling at the
       exact moment the widget appeared, nothing ever re-checked and the
       hint could just never show. Stays linked to the widget for its whole
       lifetime (instead of disconnecting after the first show): every time
       the widget disappears again (scrolling back up towards the nav bar)
       the hint fades out immediately right along with it, and every time it
       reappears the hint fades back in - but the 2s delay before it first
       fades in only applies the very first time; every reappearance after
       that shows it as soon as the widget's own slide-in settles, instead of
       waiting another 2s. */
    let musicHintObserver = null;
    if(musicWidget){
      const syncMusicHintWithWidget = () => {
        if(musicHintDismissedForever){
          if(musicHintObserver) musicHintObserver.disconnect();
          return;
        }
        if(musicWidget.classList.contains('nav-slot-visible')){
          if(musicHintVisible || musicHintShowTimer || musicHintSettleCleanup) return;
          if(musicHintShownOnce){
            afterWidgetSettled(showMusicHintNow);
          } else {
            musicHintShowTimer = window.setTimeout(() => {
              musicHintShowTimer = null;
              showMusicHintNow();
            }, 2000);
          }
        } else {
          hideMusicHint();
        }
      };
      syncMusicHintWithWidget();
      musicHintObserver = new MutationObserver(syncMusicHintWithWidget);
      musicHintObserver.observe(musicWidget, { attributes:true, attributeFilter:['class'] });
    }
    window.addEventListener('resize', () => {
      if(musicHintVisible) positionMusicHint();
    });

    /* wired identically for both the top bar's indicator AND the left
       pill's - same click handler body, attached twice, rather than two
       copies of the logic. This is what "acts exactly like the music bar"
       actually means in code: one code path, two DOM targets. */
    function wireMusicIndicator(indicatorEl){
      if(!indicatorEl) return;
      let lastClick = 0;
      indicatorEl.addEventListener('click', () => {
        const clickNow = performance.now();
        /* just enough to swallow accidental double-clicks - the scoreMuted/
           displayedVolume state machine handles rapid re-toggles safely, so
           anything longer only makes the button feel unresponsive */
        if(clickNow - lastClick < 250) return;
        if(musicInteractionLocked) return; // skip-ahead sequence is mid-flight - ignore
        lastClick = clickNow;
        dismissMusicHintForever();
        if(!epilogueAudio) return;
        // same button doubles as "replay" once the track has ended (for
        // real, or faked by the skip-ahead "ends with the letter" illusion)
        // - restart from the top instead of the usual mute/unmute toggle
        if(epilogueAudio.ended || skipEndedOverride){
          replayEpilogue();
          return;
        }
        /* both directions just route through setVolume() now - the bar
           (userVolume) is the single holder of the current level, and
           lastVolume (kept in sync by setVolume itself) is what unmute
           restores. scoreMuted is derived from userVolume rather than set
           by hand, so it can never end up out of step with what the bar is
           actually showing. */
        if(!scoreMuted){
          /* mute: slash draws across, slider drops to 0, fade out then hard-mute */
          setVolume(0, { animate:true, duration:400 });
        } else {
          /* unmute: slash retracts, restore the last held level, fade in */
          setVolume(lastVolume || 1, { animate:true, duration:400 });
        }
      });
    }
    musicIndicatorEls.forEach(wireMusicIndicator);

    /* "m" toggles mute - only while EITHER control is actually visible on
       screen (the top bar only shows once you've scrolled past the
       epilogue and the score has unlocked; the left pill shows for the
       rest of the time, while you're still reading), and only in its
       normal mute/unmute role - not while the button has morphed into the
       replay icon (track ended), where a stray "m" press shouldn't
       restart the track. Both indicators are always kept in sync (same
       classes, via updateMusicState), so checking either one's state and
       clicking either one has the same effect - musicIndicator is used as
       the representative here purely because it's guaranteed to exist. */
    document.addEventListener('keydown', (e) => {
      if(e.key !== 'm' && e.key !== 'M') return;
      if(e.metaKey || e.ctrlKey || e.altKey) return;
      if(!musicIndicator) return;
      const topBarVisible = Boolean(musicWidget && musicWidget.classList.contains('nav-slot-visible'));
      const leftPillVisible = Boolean(epilogueMusicLeftEl && epilogueMusicLeftEl.classList.contains('is-visible'));
      if(!topBarVisible && !leftPillVisible) return;
      if(musicIndicator.classList.contains('is-ended')) return;
      if(musicInteractionLocked) return; // skip-ahead sequence is mid-flight - ignore
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      if(activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
      e.preventDefault();
      musicIndicator.click();
    });

    /* same "one code path, two DOM targets" idea as wireMusicIndicator -
       trackEl is passed through to applyPointerVolume so each slider
       measures against its OWN current on-screen track, not a shared one. */
    function wireMusicVolumeControl(volumeEl, trackEl){
      if(!volumeEl) return;
      volumeEl.addEventListener('pointerdown', (e) => {
        if(musicInteractionLocked) return; // skip-ahead sequence is mid-flight - ignore
        e.preventDefault();
        dismissMusicHintForever();
        // dragging should always be instant/1:1 with the cursor - drop the
        // mute/unmute fade animation the instant a manual drag starts
        musicVolumeFillEls.forEach(el => el.classList.remove('is-fading'));
        volumeEl.setPointerCapture(e.pointerId);
        applyPointerVolume(e, trackEl);
      });
      volumeEl.addEventListener('pointermove', (e) => {
        if(musicInteractionLocked) return; // skip-ahead sequence is mid-flight - ignore
        if(e.buttons) applyPointerVolume(e, trackEl);
      });
      /* keyboard support for the role="slider": arrows nudge the volume in
         5% steps (10% with Shift), matching the pointer path exactly - so
         stepping up from silence also unmutes, and stepping down to 0 counts
         as muted, same as a drag would */
      volumeEl.addEventListener('keydown', (e) => {
        if(musicInteractionLocked) return; // skip-ahead sequence is mid-flight - ignore
        const step = (e.shiftKey ? 0.10 : 0.05);
        let delta = 0;
        if(e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step;
        else if(e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step;
        else if(e.key === 'Home') { e.preventDefault(); dismissMusicHintForever(); musicVolumeFillEls.forEach(el => el.classList.remove('is-fading')); setUserVolume(0); return; }
        else if(e.key === 'End') { e.preventDefault(); dismissMusicHintForever(); musicVolumeFillEls.forEach(el => el.classList.remove('is-fading')); setUserVolume(1); return; }
        if(!delta) return;
        e.preventDefault();
        dismissMusicHintForever();
        // same as pointerdown: keyboard nudges are instant, not eased
        musicVolumeFillEls.forEach(el => el.classList.remove('is-fading'));
        setUserVolume(userVolume + delta);
      });
    }
    wireMusicVolumeControl(musicVolume, musicVolumeTrack);
    wireMusicVolumeControl(musicVolumeLeft, musicVolumeTrackLeft);
    /* Volume-scaled version of the old fixed @keyframes musicArtPulse - a
       continuous sine wave (same 0.9s period) drives the glow ring's
       blur/spread/alpha every frame, all three scaled by displayedVolume
       (read live, so dragging the volume slider while it's playing changes
       the pulse size in real time). At volume 100% the peak matches exactly
       what the old CSS animation looked like (11px blur, 4px spread, 0.6
       alpha) - that's the ceiling everything else scales down from. */
    let artPulseRaf = null;
    let artPulseAudible = false;
    /* true until the observer below reports otherwise, so nothing changes
       before it's had its first chance to fire. Same "only pay for render
       work that's actually visible" idea as the blizzard's is-in-view gate
       and the hero eye's opacity check - this loop can otherwise run
       continuously for the entire length of the song (minutes), including
       while the widget has scrolled off-screen or collapsed into the small
       nav-pill version, computing a sine wave and writing box-shadow every
       single frame for no visible result. */
    let artPulseOnScreen = true;
    function refreshArtPulse(){
      if(artPulseAudible && artPulseOnScreen){
        if(artPulseRaf || reduceMotion || !musicArt) return;
        const start = performance.now();
        const PEAK_BLUR = 11, PEAK_SPREAD = 4, PEAK_ALPHA = 0.6;
        function frame(now){
          if(!artPulseAudible || !artPulseOnScreen){ artPulseRaf = null; return; }
          const phase = ((now - start) / 900) % 1;
          // 0 at rest, 1 at the swell peak - smooth sine easing, matches the old ease-in-out feel
          const wave = (1 - Math.cos(phase * Math.PI * 2)) / 2;
          const v = Math.max(0, Math.min(1, displayedVolume));
          const amp = wave * v;
          musicArt.style.boxShadow =
            `0 4px 12px -4px rgba(91,33,182,0.6), 0 0 ${(PEAK_BLUR * amp).toFixed(1)}px ${(PEAK_SPREAD * amp).toFixed(1)}px rgba(139,92,246,${(PEAK_ALPHA * amp).toFixed(2)})`;
          artPulseRaf = requestAnimationFrame(frame);
        }
        artPulseRaf = requestAnimationFrame(frame);
      } else if(artPulseRaf){
        cancelAnimationFrame(artPulseRaf);
        artPulseRaf = null;
        if(musicArt) musicArt.style.boxShadow = '';
      }
    }
    function setArtPulse(audible){
      artPulseAudible = audible;
      refreshArtPulse();
    }
    if(musicWidget){
      const artPulseVisibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          artPulseOnScreen = entry.isIntersecting;
          refreshArtPulse();
        });
      }, { threshold: 0 });
      artPulseVisibilityObserver.observe(musicWidget);
    }

    function fadeVolume(from, to, ms, done){
      if(!epilogueAudio) return;
      if(fadeRaf) cancelAnimationFrame(fadeRaf);
      const start = performance.now();
      displayedVolume = from;
      epilogueAudio.volume = from;
      function step(now){
        const p = Math.min(1, (now - start) / ms);
        displayedVolume = from + (to - from) * p;
        epilogueAudio.volume = displayedVolume;
        if(p < 1){
          fadeRaf = requestAnimationFrame(step);
        } else {
          fadeRaf = null;
          displayedVolume = to;
          epilogueAudio.volume = to;
          if(done) done();
        }
      }
      fadeRaf = requestAnimationFrame(step);
    }

    function updateMusicState(){
      const ended = skipEndedOverride || Boolean(epilogueAudio && epilogueAudio.ended);
      const playing = Boolean(epilogueAudio && !epilogueAudio.paused);
      const audible = playing && !scoreMuted && userVolume > 0.001;
      const indMuted = scoreMuted || userVolume <= 0.001;
      const lvl = indMuted ? 0 : (userVolume > 0.75 ? 3 : (userVolume > 0.4 ? 2 : (userVolume > 0.001 ? 1 : 0)));
      musicIndicatorEls.forEach(el => {
        el.classList.toggle('muted', indMuted);
        el.classList.toggle('is-ended', ended);
        el.setAttribute('aria-label', ended ? 'Replay' : (indMuted ? 'Unmute' : 'Mute'));
        el.querySelectorAll('.mi-wave').forEach((w, i) => w.classList.toggle('on', i < lvl));
      });
      if(musicWidget) musicWidget.classList.toggle('is-playing', audible);
      setArtPulse(audible);
      if(musicStatus) musicStatus.textContent = 'DeVotchKa · ' + (ended ? 'Ended' : (audible ? 'Now playing' : (playing ? 'Muted' : 'Paused')));
    }

    function startEpilogueScore(){
      if(!epilogueAudio || !epilogueAudio.paused) return;
      /* Always start muted — the visitor opts into sound */
      epilogueAudio.muted = true;
      const attempt = epilogueAudio.play();
      if(attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
      updateMusicState();
    }

    if(epilogueAudio){
      epilogueAudio.addEventListener('play', updateMusicState);
      epilogueAudio.addEventListener('pause', updateMusicState);
      epilogueAudio.addEventListener('ended', updateMusicState);
      epilogueAudio.addEventListener('volumechange', updateMusicState);
    }
    updateMusicState();

    /* Play bar - driven by the audio element's own timeupdate events (~4Hz)
       instead of a permanent rAF loop; the CSS width transition smooths the
       coarser updates out visually */
    const musicProgressFill = document.getElementById('musicProgressFill');
    if(musicProgressFill && epilogueAudio){
      const renderMusicProgress = () => {
        if(skipProgressOverrideActive) return;
        if(epilogueAudio.duration){
          musicProgressFill.style.width = ((epilogueAudio.currentTime / epilogueAudio.duration) * 100) + '%';
        }
      };
      epilogueAudio.addEventListener('timeupdate', renderMusicProgress);
      epilogueAudio.addEventListener('seeked', renderMusicProgress);
      renderMusicProgress();
    }

    /* ---------- Skip-ahead: "the song fades out and ends with the letter" ----------
       Called by the skip button (defined earlier in the file, via the
       triggerSkipAheadMusicEnding hook it can't otherwise reach into this
       block to call directly) the instant Skip is pressed. Two keyframes,
       both starting from wherever things actually currently sit and
       animating to their "track over" state over the same durationMs the
       compressed reveal itself takes to finish:
         - volume bar: current level -> 0 (and the audio itself fades out
           alongside it, exactly like the mute button's own fade)
         - progress bar: current position -> 100% (so it visually finishes
           reading its own runtime right as the letter finishes)
       Once durationMs elapses, the song is treated as ended - same button
       morph, same status text, as if it had played out and stopped on its
       own; skipEndedOverride is what tells updateMusicState() to treat it
       that way even though the real <audio> element is just quietly
       sitting there mid-track, still audible-volume-zero, underneath. */
    function runSkipAheadMusicEnding(durationMs){
      if(!epilogueAudio) return;
      const ms = Math.max(0, durationMs || 0);

      /* volume bar + actual audio volume: current level -> 0. Deliberately
         does NOT touch userVolume/scoreMuted (the values updateMusicState
         reads to decide "is this muted") while the fade is still running -
         doing that immediately used to flip the icon to its muted-slash
         look and the status text to "Muted" the instant Skip was pressed,
         well before the song had actually finished. lastVolume is left
         alone too, so it still holds the level to restore to. Only the
         raw visuals (bar width, actual audio.volume) move during the fade;
         the "this is over now" state flip happens once, at the very end. */
      musicVolumeFillEls.forEach(el => {
        el.classList.add('is-fading');
        el.style.transitionDuration = ms + 'ms';
        void el.offsetWidth; // commit the current width before animating, same reflow trick as the progress bar below
        el.style.width = '0%';
      });
      fadeVolume(displayedVolume, 0, ms, () => {});

      // progress bar: current position -> 100%, independent of real currentTime/duration
      skipProgressOverrideActive = true;
      if(musicProgressFill){
        musicProgressFill.style.transitionDuration = ms + 'ms';
        void musicProgressFill.offsetWidth; // force the current width to commit before animating, same reflow trick used elsewhere
        musicProgressFill.style.width = '100%';
      }

      window.setTimeout(() => {
        // NOW - and only now - is the track actually treated as over
        userVolume = 0;
        scoreMuted = true;
        epilogueAudio.muted = true;
        renderVolume();
        skipEndedOverride = true;
        // drop the inline duration override on both bars now that the
        // skip's own fade has finished - anything that fades them next
        // (a stray mute click, or a later replay) should use the normal
        // CSS-defined 0.4s again, not this fade's stretched-out duration
        musicVolumeFillEls.forEach(el => { el.style.transitionDuration = ''; });
        if(musicProgressFill) musicProgressFill.style.transitionDuration = '';
        updateMusicState();
        // this IS the moment the mute button actually flips to the replay
        // icon (updateMusicState above just applied is-ended) - releasing
        // the click-lock right here instead of on a separately-computed
        // timer means it can never drift out of sync with the button's own
        // state, no matter how the timing above changes later
        unlockMusicWidgetForSkip();
      }, ms);
    }
    // hands the function above to the outer (top-level) hook variable the
    // skip button actually calls - see its declaration for why the indirection
    triggerSkipAheadMusicEnding = runSkipAheadMusicEnding;

    function runLockMusicWidgetForSkip(){
      musicInteractionLocked = true;
      musicIndicatorEls.forEach(el => el.classList.add('is-skip-locked'));
      musicVolumeEls.forEach(el => el.classList.add('is-skip-locked'));
    }
    function unlockMusicWidgetForSkip(){
      musicInteractionLocked = false;
      musicIndicatorEls.forEach(el => el.classList.remove('is-skip-locked'));
      musicVolumeEls.forEach(el => el.classList.remove('is-skip-locked'));
    }
    lockMusicWidgetForSkip = runLockMusicWidgetForSkip;

    const epilogueObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          epilogueLines.forEach(el => el.classList.add('is-visible'));
          /* Unlock the music widget 1s after the opening line has fully revealed
             (reveal transition is 1.4s, so 1.4s + 1s = 2.4s) */
          window.setTimeout(() => {
            musicWidgetUnlocked = true;
            updateNavVisibility();
            startEpilogueScore();
          }, 2400);
          epilogueObserver.unobserve(entry.target);
        }
      });
      /* threshold 0 + a bottom rootMargin instead of a fractional threshold:
         the letter is thousands of px tall, so "10% of it visible" depended
         on the viewport being tall enough to ever show that much at once.
         This fires as soon as the letter's top crosses 80% down the viewport,
         regardless of how tall the letter (or the screen) is. */
    }, { threshold:0, rootMargin:'0px 0px -20% 0px' });
    epilogueObserver.observe(epilogueLetterEl);
  }

  const revealEls = Array.from(document.querySelectorAll('[data-reveal]')).filter(el => !el.closest('.epilogue-letter'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold:0.25 });
  revealEls.forEach(el => io.observe(el));

  /* ---------- Act II: hind-text parallax (drifts slower than scroll) ---------- */
  const parallaxEls = document.querySelectorAll('[data-parallax]');
  function updateParallax(){
    const scrollY = window.scrollY;
    parallaxEls.forEach(el => {
      const rect = el.parentElement.getBoundingClientRect();
      const offset = (rect.top) * 0.12;
      el.style.transform = `translateY(${offset}px)`;
    });
  }
  if(!reduceMotion){
    window.addEventListener('scroll', updateParallax, { passive:true });
    updateParallax();
  }

  /* ---------- Fade out the fixed hero canvas once scrolled past the hero ---------- */
  /* ---------- Keep the eye background fully visible through scroll, theme
     toggles, and the About section — only fade it out as the Stats section
     approaches, rather than fading arbitrarily early within the hero. ---------- */
  const statsSection = document.getElementById('stats');
  function updateCanvasVisibility(){
    let opacity = 1;
    if(statsSection){
      const statsTop = statsSection.getBoundingClientRect().top + window.scrollY;
      const fadeStart = statsTop - window.innerHeight * 0.5;
      const fadeEnd = statsTop;
      const y = window.scrollY;
      if(y > fadeStart){
        opacity = 1 - Math.min(1, (y - fadeStart) / Math.max(1, fadeEnd - fadeStart));
      }
    }
    wrap.style.opacity = opacity;
  }
  window.addEventListener('scroll', updateCanvasVisibility, { passive:true });
  updateCanvasVisibility();

  /* ---------- Pull the nav bar up once we scroll past the Epilogue header ---------- */
  const navbarEl = document.querySelector('.navbar');
  const musicWidgetEl = document.getElementById('musicWidget');
  /* same element the epilogue block's own epilogueMusicLeftEl points to -
     re-fetched here under a top-level binding because this function lives
     outside that block's scope and can't see its consts. See the HTML
     comment above #epilogueMusicLeft and the JS comment above
     musicIndicatorEls for the full picture of how the two controls (top
     bar, left pill) mirror each other. */
  const epilogueMusicLeftEl = document.getElementById('epilogueMusicLeft');
  const epilogueHeading = document.querySelector('#epilogue .section-head');
  const epilogueSectionForPillEl = document.getElementById('epilogue');
  const aboutSectionEl = document.getElementById('about');
  /* Sticky, one-way flag: flips true the first time the epilogue section is
     reached and never resets. The left pill is only ever eligible to show
     once this has happened - before that (fresh page load, still up in
     hero/about/projects/achievements on a first visit) it stays hidden, even
     though those are all "above" the epilogue where it's otherwise allowed
     to appear. */
  let epilogueReached = false;
  function updateNavVisibility(){
    if(!navbarEl || !epilogueHeading) return;
    const pastEpilogue = epilogueHeading.getBoundingClientRect().top <= 150;
    /* nav pops down only once the user has stepped into the About section */
    const inAbout = aboutSectionEl ? aboutSectionEl.getBoundingClientRect().top <= window.innerHeight * 0.45 : true;
    navbarEl.classList.toggle('nav-hidden', !inAbout || pastEpilogue);
    const topBarShown = pastEpilogue && musicWidgetUnlocked;
    if(musicWidgetEl) musicWidgetEl.classList.toggle('nav-slot-visible', topBarShown);
    /* the left pill lives everywhere ABOVE the epilogue (hero through
       achievements, including scrolling back up after visiting the
       epilogue) but must never render while the epilogue section itself is
       actually in view - that's the top bar/skip button's own territory. */
    let epRect = null;
    if(epilogueSectionForPillEl) epRect = epilogueSectionForPillEl.getBoundingClientRect();
    const inEpilogue = epRect ? (epRect.top <= window.innerHeight * 0.75 && epRect.bottom > 0) : false;
    if(inEpilogue) epilogueReached = true;
    if(epilogueMusicLeftEl) epilogueMusicLeftEl.classList.toggle('is-visible', epilogueReached && !inEpilogue);
  }
  window.addEventListener('scroll', updateNavVisibility, { passive:true });
  updateNavVisibility();

  /* ---------- Cursor trail (epilogue section only) - sparkle/stardust ---------- */
  const epilogueSectionEl = document.getElementById('epilogue');
  const SPARKLE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c0 6.2 1.9 10.3 6 12-4.1 1.7-6 5.8-6 12 0-6.2-1.9-10.3-6-12 4.1-1.7 6-5.8 6-12Z"/></svg>';
  if(epilogueSectionEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    let lastTrailTime = 0;
    epilogueSectionEl.addEventListener('mousemove', (e) => {
      const now = performance.now();
      if(now - lastTrailTime < 45) return;
      lastTrailTime = now;
      const dot = document.createElement('div');
      dot.className = 'cursor-trail-dot ' + (Math.random() > 0.5 ? 'hue-white' : 'hue-violet');
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      const size = 8 + Math.random() * 9;
      dot.style.width = size + 'px';
      dot.style.height = size + 'px';
      const rot0 = Math.random() * 40 - 20;
      dot.style.setProperty('--rot0', rot0 + 'deg');
      dot.style.setProperty('--rot1', (rot0 + 35 + Math.random() * 30) + 'deg');
      dot.style.setProperty('--dx', (Math.random() * 26 - 13) + 'px');
      dot.style.setProperty('--dy', (-12 - Math.random() * 20) + 'px');
      dot.innerHTML = SPARKLE_SVG;
      document.body.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());

      // one or two stardust motes shaken loose from each sparkle, falling
      // and fading independently of the sparkle's own upward drift
      const moteCount = 1 + Math.floor(Math.random() * 2);
      for(let i = 0; i < moteCount; i++){
        const mote = document.createElement('div');
        mote.className = 'stardust-mote ' + (Math.random() > 0.5 ? 'hue-white' : 'hue-violet');
        mote.style.left = `${e.clientX + (Math.random() * 12 - 6)}px`;
        mote.style.top = `${e.clientY + (Math.random() * 12 - 6)}px`;
        mote.style.setProperty('--fall-dur', (0.8 + Math.random() * 0.6) + 's');
        mote.style.setProperty('--fall-dx', (Math.random() * 22 - 11) + 'px');
        mote.style.setProperty('--fall-dy', (45 + Math.random() * 55) + 'px');
        const moteRot0 = Math.random() * 360;
        mote.style.setProperty('--mote-rot0', moteRot0 + 'deg');
        mote.style.setProperty('--mote-rot1', (moteRot0 + 100 + Math.random() * 140) + 'deg');
        mote.innerHTML = SPARKLE_SVG;
        document.body.appendChild(mote);
        mote.addEventListener('animationend', () => mote.remove());
      }
    });
  }

  /* ---------- "Resume under construction" popup ---------- */
  /* runs on DOMContentLoaded: the popup's markup sits after this script in
     the document (with the other overlay layers), so it doesn't exist yet
     at script-execution time */
  document.addEventListener('DOMContentLoaded', function initResumePopup(){
    const resumeBtn = document.querySelector('.resume-btn');
    const popup = document.getElementById('resumePopup');
    const backdrop = document.getElementById('resumeBackdrop');
    const okBtn = document.getElementById('resumeOk');
    const progressFill = document.querySelector('.resume-progress-fill');
    const RESUME_PROGRESS_TARGET = '73%';
    if(!resumeBtn || !popup || !backdrop) return;

    let lastFocused = null;

    function onResumeKeydown(e){
      if(e.key === 'Escape'){ closeResumePopup(); return; }
      /* keep Tab inside the little dialog */
      if(e.key === 'Tab'){
        const focusables = popup.querySelectorAll('button, a[href]');
        if(!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if(e.shiftKey){
          if(active === first || !popup.contains(active)){ e.preventDefault(); last.focus(); }
        } else if(active === last || !popup.contains(active)){
          e.preventDefault(); first.focus();
        }
      }
    }

    function openResumePopup(){
      lastFocused = document.activeElement;
      lockBodyScroll();
      backdrop.classList.add('is-open');
      popup.classList.add('is-open');
      if(okBtn) okBtn.focus({ preventScroll:true });
      document.addEventListener('keydown', onResumeKeydown);
      if(progressFill){
        if(reduceMotion){
          progressFill.style.width = RESUME_PROGRESS_TARGET;
        } else {
          /* the fill was reset to 0 (transition disabled) when the popup last
             closed - re-enable the transition and kick it up to target on
             the next frame so the fill-in motion actually replays every
             time the popup opens, not just the first time */
          progressFill.style.transition = 'none';
          progressFill.style.width = '0%';
          void progressFill.offsetWidth;
          progressFill.style.transition = '';
          requestAnimationFrame(() => {
            requestAnimationFrame(() => { progressFill.style.width = RESUME_PROGRESS_TARGET; });
          });
        }
      }
    }

    function closeResumePopup(){
      backdrop.classList.remove('is-open');
      popup.classList.remove('is-open');
      unlockBodyScroll();
      document.removeEventListener('keydown', onResumeKeydown);
      /* Safari doesn't focus buttons on click, so lastFocused can be <body> -
         fall back to the resume button itself rather than dropping focus */
      const target = (lastFocused && lastFocused !== document.body && document.contains(lastFocused)) ? lastFocused : resumeBtn;
      target.focus({ preventScroll:true });
      /* reset instantly (no transition) so the next open starts from 0 again */
      if(progressFill){
        progressFill.style.transition = 'none';
        progressFill.style.width = '0%';
        void progressFill.offsetWidth;
        progressFill.style.transition = '';
      }
    }

    resumeBtn.addEventListener('click', openResumePopup);
    backdrop.addEventListener('click', closeResumePopup);
    if(okBtn) okBtn.addEventListener('click', closeResumePopup);
  });

  /* ---------- Chevron page-transition (ported) ---------- */
  const chevronTransitionDurationMs = 1500;
  const returnChevronPauseMs = 500;
  const returnChevronExitMaxMs = 1120;

  /* Reopens a project card instantly (no fly-in FLIP animation, no bounding-rect
     math) - used when landing back on index.html from the placeholder page so
     the visitor returns straight to the same zoomed-in apple card they left,
     instead of just the tree. Skips animateCardArc entirely since it doesn't
     depend on layout/scroll timing - the modal is position:fixed and centred
     by CSS regardless of scroll position, so it can be set up immediately,
     even while the return chevrons are still covering the screen. */
  function reopenProjectOnReturn(idx){
    if(!appleForIdx(idx)) return;
    if(treeScene){
      treeScene.classList.add('is-grown');
      treeObserver.unobserve(treeScene);
    }
    lockBodyScroll();
    currentOpenIdx = idx;
    selectProject(idx);
    modalBackdrop.classList.add('is-visible');
    const originEl = appleForIdx(idx);
    if(originEl) originEl.style.visibility = 'hidden';
    if(projectDisplay){ projectDisplay.classList.add('is-open'); centerModalScroll(); }
    lastFocusedBeforeModal = document.activeElement;
    if(projectDisplay) projectDisplay.focus({ preventScroll:true });
    document.addEventListener('keydown', handleModalKeydown);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const navEntry = performance.getEntriesByType('navigation')[0];
    const isReload = Boolean(navEntry && navEntry.type === 'reload');
    if(isReload){
      scrollInstant(0);
    }

    const chevronTransitionEl = document.querySelector('.chevron-transition');
    const hashTarget = !isReload && window.location.hash && window.location.hash.length > 1
      ? document.querySelector(window.location.hash)
      : null;
    if(!chevronTransitionEl){
      document.documentElement.classList.remove('pre-return');
      if(hashTarget){ scrollInstant(hashTarget); }
      return;
    }
    if(sessionStorage.getItem('chevronReturnToIndex') !== '1'){
      document.documentElement.classList.remove('pre-return');
      if(hashTarget){ scrollInstant(hashTarget); }
      return;
    }

    sessionStorage.removeItem('chevronReturnToIndex');

    const returnParams = new URLSearchParams(window.location.search);
    const reopenIdx = returnParams.get('openProject');
    let reopenedProject = false;
    if(reopenIdx !== null){
      /* scroll to the tree FIRST (still fully hidden behind the covering
         chevrons) so the background position lands correctly - lockBodyScroll()
         inside reopenProjectOnReturn() then captures *this* scroll position to
         restore later when the card is closed */
      if(hashTarget){ scrollInstant(hashTarget); }
      reopenProjectOnReturn(reopenIdx);
      reopenedProject = true;
      /* strip the param so a manual refresh later doesn't reopen it again */
      returnParams.delete('openProject');
      const cleanQuery = returnParams.toString();
      const cleanUrl = window.location.pathname + (cleanQuery ? '?' + cleanQuery : '') + window.location.hash;
      window.history.replaceState(null, '', cleanUrl);
    }

    chevronTransitionEl.classList.add('active', 'return-intro');
    window.setTimeout(() => {
      document.documentElement.classList.remove('pre-return');
    }, 40);

    window.setTimeout(() => {
      chevronTransitionEl.classList.add('return-phase3');
    }, returnChevronPauseMs);

    window.setTimeout(() => {
      chevronTransitionEl.classList.remove('active', 'return-intro', 'return-phase3');
      /* skip this if a project card was reopened - the background is now
         scroll-locked (position:fixed) and was already scrolled into place
         above, so re-running scrollIntoView here would fight the lock */
      if(hashTarget && !reopenedProject){ scrollInstant(hashTarget); }
    }, returnChevronPauseMs + returnChevronExitMaxMs + 140);
  });

  document.addEventListener('click', (event) => {
    /* chevron page-transition is scoped to the Projects section's own
       redirect buttons ("Open Project" links) only - every other link on
       the site (nav hashes, socials, mailto, external) navigates plainly */
    const link = event.target instanceof Element ? event.target.closest('a.apple-card-btn[href]') : null;
    if(!link) return;

    if(
      event.defaultPrevented ||
      link.target === '_blank' ||
      link.hasAttribute('download') ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ){
      return;
    }

    const href = link.getAttribute('href');
    if(!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    event.preventDefault();
    const chevronTransitionEl = document.querySelector('.chevron-transition');
    if(!chevronTransitionEl){
      window.location.href = link.href;
      return;
    }
    chevronTransitionEl.classList.remove('return-intro', 'return-phase3');
    chevronTransitionEl.classList.add('active');

    window.setTimeout(() => {
      window.location.href = link.href;
    }, chevronTransitionDurationMs);
  });

  /* ---------- Mail template popup ---------- */
  document.addEventListener('DOMContentLoaded', function initMailPopup(){
    const MAIL_TO = 'aniruddha911xd@gmail.com';
    const MAIL_TEMPLATES = [
      {
        label: 'Potential Opportunity',
        subject: 'Regarding a Potential Opportunity',
        body: "Hi Aniruddha,\n\nI came across your portfolio and would like to get in touch regarding a potential opportunity/collaboration.\n\nPlease let me know a good time to connect.\n\nBest regards,"
      },
      {
        label: 'Project Inquiry',
        subject: 'Project Inquiry',
        body: "Hi Aniruddha,\n\nI'm reaching out regarding a project I think you'd be a great fit for. I'd love to share more details and discuss further.\n\nLooking forward to your response.\n\nBest regards,"
      },
      {
        label: 'Work Together',
        subject: 'Interested in Working Together',
        body: "Hi Aniruddha,\n\nI viewed your portfolio and was impressed by your work. I'd like to explore the possibility of working together.\n\nHappy to share more details whenever convenient for you.\n\nBest regards,"
      },
      {
        label: 'General Inquiry',
        subject: 'General Inquiry',
        body: "Hi Aniruddha,\n\nI'm writing to learn more about your work and availability. Could we set up a time to discuss further?\n\nThank you,"
      },
      {
        label: 'Collaboration Request',
        subject: 'Collaboration Request',
        body: "Hi Aniruddha,\n\nI'd like to discuss a possible collaboration based on the work showcased in your portfolio. Let me know if you're open to a conversation.\n\nBest regards,"
      },
      { label: 'Write your own…', subject: '', body: '' }
    ];

    const triggers = Array.from(document.querySelectorAll('[data-mail-trigger]'));
    const popup = document.getElementById('mailPopup');
    if(!triggers.length || !popup) return;

    function buildGmailUrl(subject, body){
      const params = new URLSearchParams({ view:'cm', fs:'1', to: MAIL_TO });
      if(subject) params.set('su', subject);
      if(body) params.set('body', body);
      return 'https://mail.google.com/mail/?' + params.toString();
    }

    /* items are staggered outward from whichever edge touches the trigger, so
       the list visually "unrolls" out of the button - stagger index 0 is the
       item nearest the button (last one in the popup when placed above it) */
    MAIL_TEMPLATES.forEach((tpl, idx) => {
      const item = document.createElement('a');
      item.className = 'mail-popup-item';
      item.setAttribute('role', 'menuitem');
      item.target = '_blank';
      item.rel = 'noopener';
      item.href = buildGmailUrl(tpl.subject, tpl.body);
      item.textContent = tpl.label;
      item.style.setProperty('--stagger', String(MAIL_TEMPLATES.length - 1 - idx));
      item.addEventListener('click', closeMailPopup);
      popup.appendChild(item);
    });

    let activeTrigger = null;
    let hideTimer = null;
    const EXIT_ANIM_MS = 140; /* keep in sync with the .mail-popup clip-path transition duration */

    function clearHideTimer(){
      if(hideTimer){ clearTimeout(hideTimer); hideTimer = null; }
    }

    const MAIL_POPUP_MIN_WIDTH = 210; /* narrowest the menu can be and still fit its text comfortably */

    function positionMailPopup(trigger){
      const rect = trigger.getBoundingClientRect();

      /* the "merge into the button" treatment (matched near-corner radius +
         slight overlap) only makes sense when the trigger is already close
         to the popup's own minimum width - e.g. the wide "LET'S CONNECT"
         pill. A small round icon button (60-ish px) can never be as wide as
         a 210px text menu, so forcing a merged edge there just left a big,
         un-closeable gap on both sides no matter how the corners were
         curved - this was a real width mismatch, not a radius/gap tuning
         problem. Below that width, it falls back to a normal small floating
         menu (uniform corners, a real gap, no attempted seam) instead. */
      const canMerge = rect.width >= MAIL_POPUP_MIN_WIDTH * 0.8;
      const width = Math.min(Math.max(rect.width, MAIL_POPUP_MIN_WIDTH), 340);
      popup.style.width = width + 'px';

      let gap;
      if(canMerge){
        /* matches the trigger's own corner radius as closely as possible (a
           pill button's radius is exactly half its height) so the two edges'
           curves actually meet instead of diverging into a visible gap */
        const nearRadius = Math.min(rect.height / 2, 40);
        popup.style.setProperty('--pop-radius-near', nearRadius + 'px');
        /* slight NEGATIVE gap - overlaps the trigger by a couple px instead
           of merely touching it, so there's no seam left for the curves'
           mismatch (however small) to show through as a gap at the corners */
        gap = -2;
      } else {
        /* plain floating menu: same radius on every corner, no merge attempt */
        popup.style.setProperty('--pop-radius-near', '20px');
        gap = 10;
      }
      popup.style.setProperty('--pop-radius-far', '20px');

      const popupRect = popup.getBoundingClientRect();
      const viewportGutter = 8;

      let top = rect.top - popupRect.height - gap;
      let placement = 'above';
      if(top < viewportGutter){
        top = rect.bottom + gap;
        placement = 'below';
      }

      let left = rect.left + (rect.width / 2) - (popupRect.width / 2);
      const maxLeft = Math.max(window.innerWidth - popupRect.width - viewportGutter, viewportGutter);
      left = Math.min(Math.max(left, viewportGutter), maxLeft);

      popup.style.top = top + 'px';
      popup.style.left = left + 'px';
      popup.classList.toggle('placement-below', placement === 'below');
    }

    function onDocClick(e){
      const target = e.target;
      if(popup.contains(target)) return;
      if(target.closest && target.closest('[data-mail-trigger]')) return;
      closeMailPopup();
    }

    function onMailKeydown(e){
      if(e.key === 'Escape'){
        const trigger = activeTrigger;
        closeMailPopup();
        if(trigger) trigger.focus({ preventScroll:true });
        return;
      }
      /* role="menu"/"menuitem" implies arrow-key navigation between items,
         not just Escape - wire up Up/Down to actually move focus, wrapping
         at both ends. */
      if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
        const items = Array.from(popup.querySelectorAll('.mail-popup-item'));
        if(!items.length) return;
        e.preventDefault();
        const currentIndex = items.indexOf(document.activeElement);
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = currentIndex === -1
          ? (delta === 1 ? 0 : items.length - 1)
          : (currentIndex + delta + items.length) % items.length;
        items[nextIndex].focus({ preventScroll:true });
      }
    }

    function closeMailPopup(){
      if(!activeTrigger) return;
      const trigger = activeTrigger;
      activeTrigger = null;
      trigger.setAttribute('aria-expanded', 'false');
      /* drop 'is-visible' first so the opacity/transform transition plays;
         'is-open' (display:flex) stays until the transition finishes so the
         popup actually animates out instead of disappearing instantly */
      popup.classList.remove('is-visible');
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onMailKeydown);
      window.removeEventListener('scroll', closeMailPopup, true);
      window.removeEventListener('resize', closeMailPopup);
      clearHideTimer();
      hideTimer = setTimeout(() => {
        popup.classList.remove('is-open', 'placement-below');
        hideTimer = null;
      }, EXIT_ANIM_MS);
    }

    function openMailPopup(trigger){
      if(activeTrigger === trigger){ closeMailPopup(); return; }
      if(activeTrigger){ closeMailPopup(); }
      clearHideTimer();
      activeTrigger = trigger;
      popup.classList.add('is-open');
      positionMailPopup(trigger);
      requestAnimationFrame(() => {
        positionMailPopup(trigger);
        popup.classList.add('is-visible');
        /* move keyboard focus into the menu, matching its role="menu"
           semantics - otherwise a keyboard user has to Tab past the other
           footer social icons to reach the first item instead of landing
           on it directly when the menu opens. */
        const firstItem = popup.querySelector('.mail-popup-item');
        if(firstItem) firstItem.focus({ preventScroll:true });
      });
      trigger.setAttribute('aria-expanded', 'true');
      document.addEventListener('click', onDocClick, true);
      document.addEventListener('keydown', onMailKeydown);
      window.addEventListener('scroll', closeMailPopup, true);
      window.addEventListener('resize', closeMailPopup);
    }

    triggers.forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        openMailPopup(trigger);
      });
    });
  });
