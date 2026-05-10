'use strict';

/* =============================================================
 * globe-hero.js
 *
 * Bootstraps the rotating-globe landing section using globe.gl
 * (a free, MIT-licensed three.js wrapper) loaded via CDN.
 *
 * Data lives in geoExperiences.js — edit there, not here.
 * Styles live in globe-hero.css.
 *
 * Behavior:
 *   - Auto-rotates slowly when idle.
 *   - Pauses rotation on user interaction (hover/drag/touch),
 *     resumes shortly after interaction ends.
 *   - Hover -> compact tooltip.
 *   - Click  -> detail panel with "Jump to section" deep link
 *     into the existing tabbed portfolio nav.
 *   - Keyboard-accessible fallback list mirrors all markers.
 *   - Falls back gracefully if WebGL is unavailable.
 * ============================================================= */

(function () {
  const heroEl = document.querySelector('[data-globe-hero]');
  if (!heroEl) return;

  const stageEl = heroEl.querySelector('[data-globe-stage]');
  const mountEl = heroEl.querySelector('[data-globe-mount]');
  const tooltipEl = heroEl.querySelector('[data-globe-tooltip]');
  const panelEl = heroEl.querySelector('[data-globe-panel]');
  const fallbackListEl = heroEl.querySelector('[data-globe-fallback-list]');
  const exploreBtn = heroEl.querySelector('[data-globe-explore]');
  const projectsBtn = heroEl.querySelector('[data-globe-projects]');
  const scrollCue = heroEl.querySelector('[data-globe-scroll-cue]');

  // Tag every journey marker so tooltip/panel/layer functions can branch
  // by kind without inspecting field shape.
  const journeyData = (window.geoExperiences || []).map((d) => ({
    ...d, kind: 'journey'
  }));
  const types = window.GEO_TYPES || {};

  // ---------- Clustering ----------
  // Group experiences within CLUSTER_RADIUS_KM of each other into a single
  // marker on the globe. With the 1-3 km offsets I added in geoExperiences.js
  // the Ames items would otherwise overlap into one unhoverable blob.
  const CLUSTER_RADIUS_KM = 80;

  function haversineKm(a, b) {
    const R = 6371;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sin1 = Math.sin(dLat / 2);
    const sin2 = Math.sin(dLng / 2);
    const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Pull a sortable end-date out of a free-text date range. "Present" /
  // "Current" / "Affiliated" sort to the top.
  function endDateOf(item) {
    const r = (item.dateRange || '').trim();
    if (!r) return new Date(0);
    const lc = r.toLowerCase();
    if (lc.includes('present') || lc === 'current' || lc === 'affiliated') {
      return new Date(8640000000000000);
    }
    const parts = r.split(/—|–|--|-/);
    const last = (parts[parts.length - 1] || '').trim();
    const d = new Date(last);
    if (!isNaN(d.getTime())) return d;
    const d2 = new Date(r);
    if (!isNaN(d2.getTime())) return d2;
    return new Date(0);
  }

  function clusterJourney(items, thresholdKm) {
    const n = items.length;
    if (n === 0) return [];
    const parent = items.map((_, i) => i);
    const find = (x) => {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    };
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (haversineKm(items[i], items[j]) <= thresholdKm) {
          const pa = find(i), pb = find(j);
          if (pa !== pb) parent[pa] = pb;
        }
      }
    }
    const groups = new Map();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(items[i]);
    }
    const clusters = [];
    for (const members of groups.values()) {
      members.sort((a, b) => endDateOf(b) - endDateOf(a));
      const lat = members.reduce((s, m) => s + m.lat, 0) / members.length;
      const lng = members.reduce((s, m) => s + m.lng, 0) / members.length;
      const rep = members[0];
      clusters.push({
        // Cluster tag — single-member clusters still render but route through
        // the existing journey paths because isCluster is false.
        kind: 'journey',
        isCluster: members.length > 1,
        members,
        lat, lng,
        // Representative fields used by single-marker tooltip/panel + scaling.
        title: rep.title,
        organization: rep.organization,
        locationName: rep.locationName,
        type: rep.type,
        tags: rep.tags,
        description: rep.description,
        dateRange: rep.dateRange,
        link: rep.link,
        targetId: rep.targetId,
      });
    }
    return clusters;
  }

  const journeyClusters = clusterJourney(journeyData, CLUSTER_RADIUS_KM);

  // Citations layer is loaded lazily on first toggle. citationData ends up
  // looking like the journey-marker shape so existing pointer/scale fns work.
  let citationData = null;
  let citationsRaw = null;
  let citationsOn = false;
  const CITATION_COLOR = '#fb7185';
  const HOME_LATLNG = { lat: 42.0308, lng: -93.6319 }; // Ames, IA — your base
  let globeRef = null;
  let pauseRotateRef = null;
  let scheduleResumeRef = null;
  // Country-code -> human-readable name (e.g. 'IN' -> 'India').
  const countryNamer = (() => {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }); }
    catch (e) { return null; }
  })();
  const countryName = (cc) => (cc && countryNamer && countryNamer.of(cc)) || cc || '';

  // ---------- Build the accessible fallback list (always rendered) ----------
  renderFallbackList(fallbackListEl, journeyData, types, openPanel);

  // ---------- Populate citations badge ASAP if data is already in window ----------
  if (window.CITATIONS_DATA) {
    const badge = heroEl.querySelector('[data-citations-badge]');
    if (badge && window.CITATIONS_DATA.summary) {
      badge.textContent = `${window.CITATIONS_DATA.summary.unique_institutions || 0}`;
    }
  }

  // ---------- WebGL detection ----------
  if (!hasWebGL()) {
    heroEl.classList.add('is-no-webgl');
    wireSecondaryButtons();
    return;
  }

  // ---------- Wait for globe.gl to load (CDN) ----------
  ensureGlobeLib()
    .then(initGlobe)
    .catch((err) => {
      console.warn('[globe-hero] failed to load globe.gl, using fallback list', err);
      heroEl.classList.add('is-no-webgl');
      wireSecondaryButtons();
    });

  function initGlobe() {
    const Globe = window.Globe; // exposed by globe.gl UMD build
    if (!Globe || !mountEl) return;

    const accent = '#60a5fa';

    let globe;
    try {
      globe = buildGlobe();
    } catch (err) {
      // If any chained method on the globe instance is unsupported, the
      // whole builder throws and we end up with no globe. Surface it.
      console.error('[globe-hero] globe builder failed:', err);
      heroEl.classList.add('is-no-webgl');
      return;
    }

    function buildGlobe() {
      return Globe({ animateIn: true })
      // Earth-night texture is small (~1MB) and ships with the unpkg CDN.
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundColor('rgba(0,0,0,0)')
      .atmosphereColor(accent)
      // Atmosphere altitude is a sphere around the globe. The camera should
      // stay outside this shell, otherwise the atmosphere shader bleeds into
      // marker / globe colors. We start small and dynamically thin it more
      // as the user zooms in (see the controls "change" handler below).
      .atmosphereAltitude(0.15)
      // Cylinder points layer is disabled — HTML pins replace it (below).
      .pointsData([])
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(0)
      .pointRadius(0)
      .pointColor(() => 'rgba(0,0,0,0)')
      .pointLabel(() => '')
      // HTML map pins.
      .htmlElementsData([...journeyClusters])
      .htmlLat('lat')
      .htmlLng('lng')
      // Sit just above the surface so they don't z-fight with the bump map.
      .htmlAltitude(0.005)
      .htmlElement((d) => createPinElement(d, types, CITATION_COLOR,
                                          handleHover, handleClick))
      .ringsData(journeyClusters)
      .ringLat('lat')
      .ringLng('lng')
      .ringMaxRadius((d) => d.kind === 'citation' ? 0.9 : 1.6)
      .ringPropagationSpeed(1.5)
      .ringRepeatPeriod((d) => d.kind === 'citation' ? 3400 : 2200)
      .ringColor((d) => {
        const c = d.kind === 'citation'
          ? CITATION_COLOR
          : ((types[d.type] && types[d.type].color) || accent);
        return (t) => hexToRgba(c, 1 - t);
      })
      // Arcs are only used in citations mode (Ames -> top citing institutions).
      .arcsData([])
      .arcStartLat('startLat').arcStartLng('startLng')
      .arcEndLat('endLat').arcEndLng('endLng')
      .arcColor(() => ['rgba(96, 165, 250, 0.05)', 'rgba(251, 113, 133, 0.55)'])
      .arcStroke(0.35)
      .arcDashLength(0.4)
      .arcDashGap(0.18)
      .arcDashAnimateTime(2800)
      .arcAltitudeAutoScale(0.5)
      .onPointHover(handleHover)
      .onPointClick(handleClick)
      (mountEl);
    } // end buildGlobe

    globeRef = globe;

    // Initial framing — used by both the first render and the "reset" button.
    const HOME_POV = { lat: 25, lng: -40, altitude: 2.4 };
    // Minimum altitude must stay safely outside the atmosphere shell
    // (atmosphereAltitude above) so the shader does not muddy colors.
    const MIN_ALTITUDE = 0.45;
    const MAX_ALTITUDE = 3.4;
    globe.pointOfView(HOME_POV, 0);

    // Auto-rotate via OrbitControls (globe.gl exposes them).
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45; // gentle, continuous
    // Enable wheel + pinch zoom; bound it with min/max distance so the
    // user cannot break the framing or fly inside the globe.
    controls.enableZoom = true;
    controls.zoomSpeed = 0.7;
    // OrbitControls distance is in scene units; globe.gl's default radius
    // is 100, and distance = radius * (1 + altitude).
    controls.minDistance = 100 * (1 + MIN_ALTITUDE);
    controls.maxDistance = 100 * (1 + MAX_ALTITUDE);
    controls.enablePan = false;

    // Pause rotation while the user actively interacts; resume after idle.
    let resumeTimer = null;
    const pauseRotate = () => {
      controls.autoRotate = false;
      clearTimeout(resumeTimer);
    };
    const scheduleResume = (ms = 1800) => {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { controls.autoRotate = true; }, ms);
    };
    // Expose to outer scope so toggleCitations (defined outside initGlobe)
    // can use them.
    pauseRotateRef = pauseRotate;
    scheduleResumeRef = scheduleResume;

    mountEl.addEventListener('pointerdown', pauseRotate);
    mountEl.addEventListener('pointerup',   () => scheduleResume(1200));
    mountEl.addEventListener('pointerleave', () => scheduleResume(800));
    mountEl.addEventListener('pointerenter', pauseRotate);
    mountEl.addEventListener('wheel',       () => { pauseRotate(); scheduleResume(2500); }, { passive: true });

    // ---------- Re-tune atmosphere with zoom level ----------
    // As the camera approaches the atmosphere shell, the shader can blend
    // into the globe / markers and shift their colors. Listen to OrbitControls
    // changes (fired on wheel zoom, pinch, drag, and button-driven moves)
    // and shrink the atmosphere proportionally so the close-up view stays
    // crisp. We throttle so we don't rebuild the atmosphere mesh every frame.
    let lastAtmoAlt = 0.15;
    let atmoTuneRaf = null;
    const tuneAtmosphereForZoom = () => {
      atmoTuneRaf = null;
      const pov = globe.pointOfView();
      // Map altitude -> atmosphere thickness. Close in: thin. Far out: thicker.
      // (0.45 -> 0.05, 2.4 -> 0.16, capped at 0.18.)
      const t = Math.min(1, Math.max(0, (pov.altitude - MIN_ALTITUDE) / 1.6));
      const next = +(0.05 + 0.13 * t).toFixed(3);
      if (Math.abs(next - lastAtmoAlt) > 0.01) {
        lastAtmoAlt = next;
        globe.atmosphereAltitude(next);
      }
    };
    controls.addEventListener('change', () => {
      if (atmoTuneRaf) return;
      atmoTuneRaf = requestAnimationFrame(tuneAtmosphereForZoom);
    });

    // ---------- Zoom buttons ----------
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    function zoomBy(factor) {
      pauseRotate();
      const pov = globe.pointOfView();
      const next = clamp(pov.altitude * factor, MIN_ALTITUDE, MAX_ALTITUDE);
      globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: next }, 380);
      scheduleResume(2200);
    }
    function resetView() {
      pauseRotate();
      globe.pointOfView(HOME_POV, 800);
      scheduleResume(2200);
    }

    const zoomInBtn    = heroEl.querySelector('[data-globe-zoom-in]');
    const zoomOutBtn   = heroEl.querySelector('[data-globe-zoom-out]');
    const zoomResetBtn = heroEl.querySelector('[data-globe-zoom-reset]');
    if (zoomInBtn)    zoomInBtn.addEventListener('click',    () => zoomBy(0.7));
    if (zoomOutBtn)   zoomOutBtn.addEventListener('click',   () => zoomBy(1.45));
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetView);

    // Responsive sizing.
    const resize = () => {
      const rect = stageEl.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      globe.width(size).height(size);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stageEl);

    // Mark as ready -> hides the loading spinner.
    requestAnimationFrame(() => stageEl.classList.add('is-ready'));

    // ---------- Interaction handlers ----------
    function handleHover(point) {
      if (!point) {
        hideTooltip();
        mountEl.style.cursor = 'grab';
        scheduleResume(900);
        return;
      }
      pauseRotate();
      mountEl.style.cursor = 'pointer';
      showTooltip(point);
    }

    function handleClick(point) {
      if (!point) return;
      pauseRotate();
      // Glide the camera to focus the marker before opening the card.
      globe.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.8 }, 900);
      openPanel(point);
    }

    // Wire the Citations on/off toggle button.
    const citeToggleBtn = heroEl.querySelector('[data-globe-cite-toggle]');
    if (citeToggleBtn) {
      citeToggleBtn.addEventListener('click', () => toggleCitations());
    }
    // Pre-load citations data so the first click is instant.
    loadCitations().then(populateCitationsBadge).catch(() => {});

    wireSecondaryButtons();
  }

  // ---------- Tooltip ----------
  function showTooltip(point) {
    if (!tooltipEl) return;
    const titleEl = tooltipEl.querySelector('[data-tt-title]');
    const orgEl   = tooltipEl.querySelector('[data-tt-org]');
    const locEl   = tooltipEl.querySelector('[data-tt-loc]');
    const listEl  = tooltipEl.querySelector('[data-tt-list]');

    // Reset
    listEl.hidden = true;
    listEl.innerHTML = '';
    orgEl.style.display = '';
    locEl.style.display = '';

    if (point.isCluster) {
      titleEl.textContent =
        `${point.members.length} experiences at ${point.locationName}`;
      orgEl.style.display = 'none';
      locEl.style.display = 'none';
      // Members are already sorted most-recent-first by clusterJourney().
      point.members.forEach((m) => {
        const li = document.createElement('li');
        const t = document.createElement('strong');
        t.textContent = m.title;
        li.appendChild(t);
        const meta = document.createElement('span');
        meta.textContent = `${m.organization} · ${m.dateRange || ''}`;
        li.appendChild(meta);
        listEl.appendChild(li);
      });
      listEl.hidden = false;
    } else if (point.kind === 'citation') {
      const cnt = point.cite_count || 0;
      titleEl.textContent = point.name;
      orgEl.textContent = countryName(point.country);
      locEl.textContent = `${cnt} citation${cnt === 1 ? '' : 's'}`;
    } else {
      titleEl.textContent = point.title;
      orgEl.textContent = point.organization;
      locEl.textContent = point.locationName;
    }
    tooltipEl.classList.add('is-visible');

    const move = (e) => {
      const x = e.clientX;
      const y = e.clientY;
      tooltipEl.style.left = (x + 14) + 'px';
      tooltipEl.style.top  = (y + 14) + 'px';
    };
    document.addEventListener('mousemove', move);
    tooltipEl._move = move;
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.remove('is-visible');
    if (tooltipEl._move) {
      document.removeEventListener('mousemove', tooltipEl._move);
      tooltipEl._move = null;
    }
  }

  // ---------- Detail panel ----------
  function openPanel(point) {
    if (!panelEl) return;
    if (point.kind === 'citation') {
      renderCitationPanel(point);
    } else if (point.isCluster) {
      renderClusterPanel(point);
    } else {
      renderJourneyPanel(point);
    }
    panelEl.classList.add('is-open');
    panelEl.setAttribute('aria-hidden', 'false');
  }

  function renderJourneyPanel(point) {
    panelEl.classList.remove('is-citation');

    const t = types[point.type] || {};
    panelEl.querySelector('[data-pp-title]').textContent = point.title;
    panelEl.querySelector('[data-pp-org]').textContent = point.organization;
    panelEl.querySelector('[data-pp-desc]').textContent = point.description || '';

    const dateEl = panelEl.querySelector('[data-pp-date]');
    const locEl = panelEl.querySelector('[data-pp-loc]');
    dateEl.textContent = point.dateRange || '';
    locEl.textContent = point.locationName || '';

    const catEl = panelEl.querySelector('[data-pp-category]');
    catEl.textContent = t.label || point.type;
    catEl.style.color = t.color || '#fff';
    const swatch = document.createElement('span');
    swatch.className = 'globe-hero__panel-category-swatch';
    catEl.prepend(swatch);

    const tagsWrap = panelEl.querySelector('[data-pp-tags]');
    tagsWrap.hidden = false;
    tagsWrap.innerHTML = '';
    (point.tags || []).forEach((tag) => {
      const el = document.createElement('span');
      el.className = 'globe-hero__panel-tag';
      el.textContent = tag;
      tagsWrap.appendChild(el);
    });

    const citedListEl = panelEl.querySelector('[data-pp-cited-list]');
    citedListEl.hidden = true;
    citedListEl.innerHTML = '';
    const clusterListEl = panelEl.querySelector('[data-pp-cluster-list]');
    clusterListEl.hidden = true;
    clusterListEl.innerHTML = '';

    const jumpBtn = panelEl.querySelector('[data-pp-jump]');
    jumpBtn.style.display = '';
    jumpBtn.textContent = '';
    jumpBtn.appendChild(document.createTextNode('Jump to section '));
    const arrow = document.createElement('ion-icon');
    arrow.setAttribute('name', 'arrow-forward-outline');
    arrow.setAttribute('aria-hidden', 'true');
    jumpBtn.appendChild(arrow);
    jumpBtn.onclick = () => jumpToSection(point.link, {
      targetId: point.targetId
    });
  }

  function renderCitationPanel(point) {
    panelEl.classList.add('is-citation');

    const cnt = point.cite_count || 0;
    const uniquePapers = point.unique_papers_cited || (point.papers_cited || []).length || 0;

    panelEl.querySelector('[data-pp-title]').textContent = point.name;
    panelEl.querySelector('[data-pp-org]').textContent = countryName(point.country);
    panelEl.querySelector('[data-pp-date]').textContent =
      `${cnt} citation${cnt === 1 ? '' : 's'}`;
    panelEl.querySelector('[data-pp-loc]').textContent = countryName(point.country);
    panelEl.querySelector('[data-pp-desc]').textContent =
      `Cites ${uniquePapers} of your ${citationsRaw && citationsRaw.summary ? citationsRaw.summary.total_publications : 'published'} works.`;

    const catEl = panelEl.querySelector('[data-pp-category]');
    catEl.textContent = 'Cited by';
    catEl.style.color = CITATION_COLOR;
    const swatch = document.createElement('span');
    swatch.className = 'globe-hero__panel-category-swatch';
    catEl.prepend(swatch);

    // Hide the journey "tags" row in citation mode.
    const tagsWrap = panelEl.querySelector('[data-pp-tags]');
    tagsWrap.innerHTML = '';
    tagsWrap.hidden = true;

    // Render the per-citing-work list (top 5).
    const citedListEl = panelEl.querySelector('[data-pp-cited-list]');
    citedListEl.innerHTML = '';
    const works = (point.citing_works || []).slice(0, 5);
    works.forEach((w) => {
      const li = document.createElement('li');
      const t = document.createElement('strong');
      t.textContent = w.title || '(untitled work)';
      li.appendChild(t);
      const meta = document.createElement('span');
      const paperLabel = (citationsRaw && citationsRaw.publications || [])
        .find((p) => p.workId === w.paper_cited);
      meta.textContent = `${w.year || '—'} · cites: ${paperLabel ? paperLabel.label : w.paper_cited}`;
      li.appendChild(meta);
      citedListEl.appendChild(li);
    });
    citedListEl.hidden = works.length === 0;
    const clusterListEl = panelEl.querySelector('[data-pp-cluster-list]');
    clusterListEl.hidden = true;
    clusterListEl.innerHTML = '';

    const jumpBtn = panelEl.querySelector('[data-pp-jump]');
    jumpBtn.style.display = '';
    jumpBtn.textContent = '';
    jumpBtn.appendChild(document.createTextNode('See my publications '));
    const arrow = document.createElement('ion-icon');
    arrow.setAttribute('name', 'arrow-forward-outline');
    arrow.setAttribute('aria-hidden', 'true');
    jumpBtn.appendChild(arrow);
    jumpBtn.onclick = () => jumpToSection('#publications');
  }

  function renderClusterPanel(cluster) {
    panelEl.classList.remove('is-citation');

    const n = cluster.members.length;
    panelEl.querySelector('[data-pp-title]').textContent =
      `${n} experiences at ${cluster.locationName}`;
    panelEl.querySelector('[data-pp-org]').textContent = '';
    panelEl.querySelector('[data-pp-desc]').textContent =
      'Most recent first — click any entry for details.';

    panelEl.querySelector('[data-pp-date]').textContent = '';
    panelEl.querySelector('[data-pp-loc]').textContent = cluster.locationName || '';

    const catEl = panelEl.querySelector('[data-pp-category]');
    catEl.textContent = `Cluster · ${n}`;
    catEl.style.color = '#fff';
    const swatch = document.createElement('span');
    swatch.className = 'globe-hero__panel-category-swatch';
    catEl.prepend(swatch);

    // Hide tags + cited-list slots in cluster mode.
    const tagsWrap = panelEl.querySelector('[data-pp-tags]');
    tagsWrap.innerHTML = '';
    tagsWrap.hidden = true;
    const citedListEl = panelEl.querySelector('[data-pp-cited-list]');
    citedListEl.hidden = true;
    citedListEl.innerHTML = '';

    // Render the clickable member list (already sorted most-recent-first).
    const listEl = panelEl.querySelector('[data-pp-cluster-list]');
    listEl.innerHTML = '';
    cluster.members.forEach((m) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';

      const titleRow = document.createElement('span');
      titleRow.className = 'pcl-title';
      const swatch = document.createElement('span');
      swatch.className = 'pcl-swatch';
      const t = (types[m.type] && types[m.type].color) || '#60a5fa';
      swatch.style.color = t;
      swatch.style.background = t;
      titleRow.appendChild(swatch);
      titleRow.appendChild(document.createTextNode(m.title));

      const meta = document.createElement('span');
      meta.className = 'pcl-meta';
      meta.textContent = `${m.organization} · ${m.dateRange || ''}`;

      btn.appendChild(titleRow);
      btn.appendChild(meta);
      btn.addEventListener('click', () => {
        // Drill into the individual experience's full panel.
        renderJourneyPanel({ ...m, kind: 'journey' });
      });

      li.appendChild(btn);
      listEl.appendChild(li);
    });
    listEl.hidden = false;

    // No single jump target for a cluster; hide the bottom button.
    const jumpBtn = panelEl.querySelector('[data-pp-jump]');
    jumpBtn.style.display = 'none';
  }

  // ---------- Citations layer on/off ----------
  // Toggles the citations layer on top of the journey markers. Journey
  // markers stay visible regardless. Pass `forceState` (true|false) to
  // set explicitly; omit it to flip the current state.
  async function toggleCitations(forceState) {
    if (!globeRef) return;
    const next = (typeof forceState === 'boolean') ? forceState : !citationsOn;
    if (next === citationsOn) return;

    closePanel();
    hideTooltip();

    const btn = heroEl.querySelector('[data-globe-cite-toggle]');

    if (next) {
      // Turning ON — load (cached after first call) and layer atop journey.
      try {
        const cdata = await loadCitations();
        citationData = cdata.institutions.map((i) => ({ ...i, kind: 'citation' }));

        // Both layers live in the same htmlElementsData array; hover/click
        // dispatch by point.kind on each pin element. Rings stay journey-only
        // so 80 ripples don't overwhelm the journey markers.
        globeRef.htmlElementsData([...journeyClusters, ...citationData]);

        // Arcs from your home base to the top citing institutions.
        const TOP_ARCS = 25;
        const arcs = citationData.slice(0, TOP_ARCS).map((p) => ({
          startLat: HOME_LATLNG.lat,
          startLng: HOME_LATLNG.lng,
          endLat:   p.lat,
          endLng:   p.lng,
        }));
        globeRef.arcsData(arcs);

        citationsOn = true;
        if (btn) btn.setAttribute('aria-pressed', 'true');
      } catch (err) {
        console.warn('[globe-hero] citations load failed', err);
        if (btn) btn.setAttribute('aria-pressed', 'false');
        return;
      }
    } else {
      // Turning OFF — strip the citation points and arcs, leave journey alone.
      globeRef.htmlElementsData(journeyClusters);
      globeRef.arcsData([]);
      citationsOn = false;
      if (btn) btn.setAttribute('aria-pressed', 'false');
    }
  }

  async function loadCitations() {
    if (citationsRaw) return citationsRaw;
    // Preferred path: data was injected synchronously via citations.js.
    // Works on file://, http(s)://, GitHub Pages, anywhere.
    if (window.CITATIONS_DATA) {
      citationsRaw = window.CITATIONS_DATA;
      return citationsRaw;
    }
    // Fallback: fetch the JSON snapshot directly. Will fail on file://
    // due to browser CORS rules — that's why citations.js exists.
    const resp = await fetch('./assets/data/citations.json', { cache: 'force-cache' });
    if (!resp.ok) throw new Error(`citations.json HTTP ${resp.status}`);
    citationsRaw = await resp.json();
    return citationsRaw;
  }

  function populateCitationsBadge(cdata) {
    const badge = heroEl.querySelector('[data-citations-badge]');
    if (!badge || !cdata || !cdata.summary) return;
    const n = cdata.summary.unique_institutions || 0;
    badge.textContent = `${n}`;
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.classList.remove('is-open');
    panelEl.setAttribute('aria-hidden', 'true');
  }

  panelEl.querySelector('[data-pp-close]').addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  // ---------- Section deep-linking ----------
  // The portfolio uses a tabbed-page system; clicking the matching navbar
  // button is what actually swaps which article is visible. We then scroll
  // to a specific element (if a targetId was supplied) once the article's
  // 300ms fade-in transition finishes.
  function jumpToSection(hash, options) {
    if (!hash) return;
    options = options || {};

    const sectionName = hash.replace('#', '').toLowerCase();
    const navBtns = document.querySelectorAll('[data-nav-link]');
    let matched = null;
    let needsTabSwap = false;

    navBtns.forEach((btn) => {
      if (btn.innerHTML.trim().toLowerCase() === sectionName) {
        matched = btn;
        needsTabSwap = !btn.classList.contains('active');
      }
    });

    // Tell script.js to skip its own scroll-to-main — we'll do the scroll
    // ourselves so it lands on the precise target element.
    document.body.dataset.suppressNavScroll = '1';
    if (matched) matched.click();

    // If the tab is already active there's no transition to wait for.
    const settleMs = needsTabSwap ? 360 : 0;

    setTimeout(() => {
      delete document.body.dataset.suppressNavScroll;

      let scrollTarget = null;
      if (options.targetId) {
        scrollTarget = document.getElementById(options.targetId);
      }
      if (!scrollTarget) {
        scrollTarget = document.querySelector('main');
      }

      // Auto-expand collapsed project cards so the user lands inside content,
      // not on a closed accordion header.
      if (scrollTarget && scrollTarget.matches('[data-project-card]') &&
          !scrollTarget.classList.contains('expanded')) {
        const header = scrollTarget.querySelector('[data-project-toggle]');
        if (header) header.click();
      }

      smoothScrollTo(scrollTarget);
      flashTarget(scrollTarget);
    }, settleMs);
  }

  function smoothScrollTo(el) {
    if (!el) return;
    const navOffset = window.innerWidth >= 1024 ? 80 : 16;
    const top = el.getBoundingClientRect().top + window.pageYOffset - navOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  // Brief highlight pulse so the user can see exactly which item we landed on.
  function flashTarget(el) {
    if (!el || el.tagName === 'MAIN') return;
    el.classList.add('globe-hero-flash');
    setTimeout(() => el.classList.remove('globe-hero-flash'), 1800);
  }

  function wireSecondaryButtons() {
    if (exploreBtn) {
      exploreBtn.addEventListener('click', () => jumpToSection('#about'));
    }
    if (projectsBtn) {
      projectsBtn.addEventListener('click', () => jumpToSection('#projects'));
    }
    if (scrollCue) {
      scrollCue.addEventListener('click', () => jumpToSection('#about'));
    }
  }

  // ---------- Helpers ----------
  function hasWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  function ensureGlobeLib() {
    if (window.Globe) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-globe-lib]');
      if (existing) {
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', reject);
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/globe.gl@2.34.4/dist/globe.gl.min.js';
      s.async = true;
      s.dataset.globeLib = 'true';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ---------- HTML pin factory ----------
  // Returns a DOM element for one journey marker, journey cluster, or
  // citation institution. globe.gl positions each via lat/lng/altitude.
  function createPinElement(d, typeMap, citationColor, onHover, onClick) {
    if (d.kind === 'citation') {
      return createCitationPin(d, citationColor, onHover, onClick);
    }
    return createJourneyPin(d, typeMap, onHover, onClick);
  }

  // Each pin is wrapped in a 0x0 div that globe.gl positions exactly at
  // the lat/lng. The visible pin sits inside as an absolutely positioned
  // child, anchored via CSS transforms — so we keep full control over the
  // anchor point and hover styling.
  function makePinWrap() {
    const wrap = document.createElement('div');
    wrap.style.width  = '0';
    wrap.style.height = '0';
    return wrap;
  }

  function createJourneyPin(d, typeMap, onHover, onClick) {
    const color = (typeMap[d.type] && typeMap[d.type].color) || '#60a5fa';
    const wrap = makePinWrap();
    const pin = document.createElement('div');
    pin.className = 'gh-pin gh-pin--journey' + (d.isCluster ? ' gh-pin--cluster' : '');
    pin.style.position = 'absolute';
    pin.style.left = '0';
    pin.style.top  = '0';
    pin.style.setProperty('--gh-pin-glow', hexToRgba(color, 0.7));

    // Teardrop SVG. The pin's bottom-center is anchored at the lat/lng
    // via CSS transform: translate(-50%, -100%) on .gh-pin--journey.
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'gh-pin__shape');
    svg.setAttribute('viewBox', '0 0 24 32');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d',
      'M12 0 C5 0 0 5 0 12 C0 22 12 32 12 32 C12 32 24 22 24 12 C24 5 19 0 12 0 Z');
    path.setAttribute('fill', color);
    path.setAttribute('stroke', 'rgba(0, 0, 0, 0.35)');
    path.setAttribute('stroke-width', '0.6');
    svg.appendChild(path);
    pin.appendChild(svg);

    if (d.isCluster) {
      const count = document.createElement('span');
      count.className = 'gh-pin__count';
      count.textContent = String(d.members.length);
      pin.appendChild(count);
      pin.setAttribute('aria-label',
        `${d.members.length} experiences at ${d.locationName}`);
    } else {
      const inner = document.createElement('span');
      inner.className = 'gh-pin__inner';
      pin.appendChild(inner);
      pin.setAttribute('aria-label', `${d.title} — ${d.organization}`);
    }

    attachPinEvents(pin, d, onHover, onClick);
    wrap.appendChild(pin);
    return wrap;
  }

  function createCitationPin(d, citationColor, onHover, onClick) {
    const wrap = makePinWrap();
    const dot = document.createElement('div');
    dot.className = 'gh-pin gh-pin--citation';
    dot.style.position = 'absolute';
    dot.style.left = '0';
    dot.style.top  = '0';
    // Size scales with cite_count, bounded so rare 1-cite pins are still
    // visible and high-cite pins don't overpower journey pins.
    const cnt = d.cite_count || 1;
    const size = 10 + Math.min(14, (cnt - 1) * 3);
    dot.style.width  = size + 'px';
    dot.style.height = size + 'px';
    dot.style.setProperty('--c', citationColor || '#fb7185');
    dot.setAttribute('aria-label',
      `${d.name}: ${cnt} citation${cnt === 1 ? '' : 's'}`);
    attachPinEvents(dot, d, onHover, onClick);
    wrap.appendChild(dot);
    return wrap;
  }

  function attachPinEvents(el, d, onHover, onClick) {
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('pointerenter', () => onHover(d));
    el.addEventListener('pointerleave', () => onHover(null));
    el.addEventListener('click', () => onClick(d));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(d);
      }
    });
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function renderFallbackList(listEl, items, typeMap, onSelect) {
    if (!listEl) return;
    listEl.innerHTML = '';
    items.forEach((item) => {
      const t = typeMap[item.type] || {};
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'globe-hero__fallback-item';
      btn.setAttribute('aria-label',
        `${item.title} — ${item.organization}, ${item.locationName}, ${item.dateRange}`);

      const swatch = document.createElement('span');
      swatch.className = 'globe-hero__fallback-swatch';
      swatch.style.color = t.color || '#60a5fa';
      swatch.style.background = t.color || '#60a5fa';

      const text = document.createElement('span');
      text.className = 'globe-hero__fallback-text';

      const name = document.createElement('p');
      name.className = 'globe-hero__fallback-name';
      name.textContent = item.title;

      const meta = document.createElement('p');
      meta.className = 'globe-hero__fallback-meta';
      meta.textContent = `${t.label || item.type} • ${item.locationName} • ${item.dateRange}`;

      text.appendChild(name);
      text.appendChild(meta);
      btn.appendChild(swatch);
      btn.appendChild(text);

      btn.addEventListener('click', () => onSelect(item));
      listEl.appendChild(btn);
    });
  }
})();
