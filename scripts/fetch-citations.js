#!/usr/bin/env node
'use strict';

/* =============================================================
 * fetch-citations.js
 *
 * Builds assets/data/citations.json from OpenAlex.
 *
 * Run:    node scripts/fetch-citations.js
 *
 * Pipeline:
 *   1. Resolve each publication (DOI / arXiv / known OpenAlex W-ID)
 *      to a single canonical OpenAlex Work ID.
 *   2. For each work, page through `cites:<W>` to get every citing work.
 *   3. Drop self-citations (works whose authorship list contains any of
 *      USER_AUTHOR_IDS — i.e. works *you* authored).
 *   4. Collect every unique citing institution, with the list of which
 *      of your papers each institution has cited.
 *   5. Batch-fetch the institution records to get country + lat/lng.
 *   6. Write a clean JSON snapshot the browser can load directly.
 *
 * No API key, no scraping. Uses OpenAlex's polite pool by passing a
 * `mailto=` parameter on every request.
 * ============================================================= */

const fs = require('fs');
const path = require('path');

const OPENALEX = 'https://api.openalex.org';
const MAILTO   = 'anushlakshmansivaraman@gmail.com';

// Every OpenAlex Author ID we've seen for Anush. Citing works that include
// any of these in their authorship list are dropped as self-citations.
const USER_AUTHOR_IDS = new Set([
  'A5111206754', // "Anush Lakshman S" (Iowa State / FPP / corrosion era)
  'A5060707173', // "S. Anush Lakshman" (SSN era)
  'A5129584801', // orphan fragment
]);

// Your publication list. For each entry the script tries `openalex` first
// (fastest, no resolution call), then `doi`, then `arxiv` (resolved by ID
// search), then `title` (fuzzy fallback).
//
// To add a new paper: drop another { label, doi } entry. Re-run the script.
const PUBLICATIONS = [
  // Pre-resolved (verified during the design conversation):
  { label: 'IoT and drones (Materials Today, 2021)',
    openalex: 'W3163961961' },
  { label: 'Corrosion characterization FPP (MST, 2024)',
    openalex: 'W4398144997' },
  { label: 'Architecture & Applications of IoT Devices (SN Comp Sci, 2024)',
    openalex: 'W4401967617' },
  { label: 'Unsupervised classification of corrosion (ASME JNDE, 2025)',
    openalex: 'W4410949307' },

  // Resolved by DOI:
  { label: '3D printability via fringe projection (SPJ ADI, 2025)',
    doi: '10.34133/adi.0116' },
  { label: 'Autonomous robotic 3D scanning (SPIE DCS, 2024)',
    doi: '10.1117/12.3014169' },
  { label: 'AI principles in mechanical engineering (IOP Conf Series, 2020)',
    doi: '10.1088/1757-899X/912/3/032075' },
  { label: '3D Printing & Regulatory Considerations (Springer chapter, 2023)',
    doi: '10.1007/978-3-031-34119-9_3' },

  // Resolved by title (no DOI in the page links):
  { label: 'Fog removal system using ANSYS Fluent (Materials Today, 2023)',
    title: 'Design analysis of fog removal system using ANSYS Fluent' },

  // arXiv preprints — search by title since arXiv-only works may be in
  // OpenAlex under different identifiers:
  { label: 'ClearVision (IEEE ITSC, 2025)',
    title: 'ClearVision: Leveraging CycleGAN and SigLIP-2 for robust all-weather classification' },
  { label: 'FPP-ML-Bench (SPIE Photonics West, 2026)',
    title: 'Comprehensive Machine Learning Benchmarking for Fringe Projection Profilometry' },
  { label: 'VIRTUS-FPP (arXiv preprint, 2025)',
    title: 'VIRTUS-FPP: Virtual sensor modeling for fringe projection profilometry' },
];

// ----------------------- HTTP -----------------------

async function api(url) {
  const sep = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${sep}mailto=${encodeURIComponent(MAILTO)}`;
  const resp = await fetch(fullUrl);
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} on ${fullUrl}\n${body.slice(0, 200)}`);
  }
  return resp.json();
}

const stripPrefix = (id) => (id || '').replace('https://openalex.org/', '');

// ----------------------- Resolution -----------------------

async function resolvePublication(pub) {
  if (pub.openalex) return { ...pub, workId: pub.openalex };

  if (pub.doi) {
    const data = await api(`${OPENALEX}/works/doi:${pub.doi}?select=id,doi,title`);
    return { ...pub, workId: stripPrefix(data.id), resolvedTitle: data.title };
  }

  if (pub.title) {
    const q = encodeURIComponent(pub.title);
    const data = await api(`${OPENALEX}/works?search=${q}&per-page=1&select=id,doi,title`);
    if (!data.results || !data.results.length) {
      throw new Error(`Could not resolve "${pub.title}"`);
    }
    const top = data.results[0];
    return { ...pub, workId: stripPrefix(top.id), resolvedTitle: top.title };
  }

  throw new Error(`No resolver for ${pub.label}`);
}

// ----------------------- Citing-work fetch -----------------------

async function fetchAllCitingWorks(workId) {
  const out = [];
  let cursor = '*';
  while (cursor) {
    const url = `${OPENALEX}/works?filter=cites:${workId}&per-page=200&cursor=${encodeURIComponent(cursor)}` +
                `&select=id,title,publication_year,type,authorships,doi`;
    const data = await api(url);
    out.push(...(data.results || []));
    cursor = data.meta && data.meta.next_cursor;
    if (!cursor) break;
  }
  return out;
}

function isSelfCite(work) {
  return (work.authorships || []).some((a) => {
    const aid = stripPrefix(a.author && a.author.id);
    return USER_AUTHOR_IDS.has(aid);
  });
}

// ----------------------- Institution geo lookup -----------------------

async function fetchInstitutionsGeo(institutionIds) {
  const out = {};
  const ids = [...institutionIds];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const filter = `ids.openalex:${chunk.join('|')}`;
    const url = `${OPENALEX}/institutions?filter=${filter}&per-page=50` +
                `&select=id,display_name,country_code,geo,ror,type`;
    const data = await api(url);
    for (const inst of (data.results || [])) {
      const id = stripPrefix(inst.id);
      out[id] = {
        ror: inst.ror || null,
        name: inst.display_name,
        country: inst.country_code || null,
        lat: (inst.geo && inst.geo.latitude) ?? null,
        lng: (inst.geo && inst.geo.longitude) ?? null,
        type: inst.type || null,
      };
    }
  }
  return out;
}

// ----------------------- Aggregation -----------------------

function aggregate(citingByPub) {
  const instMap = new Map(); // openalex inst id -> { papers_cited: Set, citing_works: [] }
  let totalCiting = 0;
  let selfFiltered = 0;
  const seenCitingPerPub = new Map();

  for (const { pub, citingWorks } of citingByPub) {
    const seenForThisPub = new Set();
    for (const work of citingWorks) {
      if (isSelfCite(work)) { selfFiltered++; continue; }
      // Same citing work can appear under multiple of *your* papers (if it
      // cites several). For total citing-works count, dedupe per pub but
      // count once globally.
      const wid = stripPrefix(work.id);
      const dedupeKey = `${pub.workId}:${wid}`;
      if (seenForThisPub.has(dedupeKey)) continue;
      seenForThisPub.add(dedupeKey);
      totalCiting++;

      const seenInstThisWork = new Set();
      for (const a of (work.authorships || [])) {
        for (const inst of (a.institutions || [])) {
          const iid = stripPrefix(inst.id);
          if (!iid || seenInstThisWork.has(iid)) continue;
          seenInstThisWork.add(iid);
          if (!instMap.has(iid)) {
            instMap.set(iid, {
              id: iid,
              papers_cited: new Set(),
              citing_works: [],
            });
          }
          const entry = instMap.get(iid);
          entry.papers_cited.add(pub.workId);
          entry.citing_works.push({
            id: wid,
            title: work.title,
            year: work.publication_year,
            paper_cited: pub.workId,
          });
        }
      }
    }
    seenCitingPerPub.set(pub.workId, seenForThisPub.size);
  }

  return { instMap, totalCiting, selfFiltered, seenCitingPerPub };
}

// ----------------------- Main -----------------------

async function main() {
  console.log(`OpenAlex citation fetch — ${PUBLICATIONS.length} publications`);
  console.log('='.repeat(60));

  // 1. Resolve all publications to canonical Work IDs.
  const resolved = [];
  for (const pub of PUBLICATIONS) {
    process.stdout.write(`Resolving: ${pub.label} ... `);
    try {
      const r = await resolvePublication(pub);
      resolved.push(r);
      console.log(r.workId);
    } catch (err) {
      console.log(`SKIP (${err.message})`);
    }
  }

  // 2. Fetch citing works per publication.
  console.log('\nFetching citing works:');
  const citingByPub = [];
  for (const r of resolved) {
    process.stdout.write(`  ${r.workId} (${r.label}) ... `);
    try {
      const cw = await fetchAllCitingWorks(r.workId);
      console.log(`${cw.length} citing`);
      citingByPub.push({ pub: r, citingWorks: cw });
    } catch (err) {
      console.log(`ERROR (${err.message})`);
    }
  }

  // 3. Aggregate institutions.
  const { instMap, totalCiting, selfFiltered, seenCitingPerPub } = aggregate(citingByPub);

  // 4. Resolve geo for every unique institution.
  console.log(`\nResolving geo for ${instMap.size} unique institutions...`);
  const geo = await fetchInstitutionsGeo([...instMap.keys()]);

  // 5. Build final institution list (drop unresolvable lat/lng).
  const institutions = [];
  let unresolvedGeo = 0;
  for (const [iid, entry] of instMap) {
    const g = geo[iid];
    if (!g || g.lat == null || g.lng == null) { unresolvedGeo++; continue; }
    institutions.push({
      id: iid,
      name: g.name,
      country: g.country,
      ror: g.ror,
      type: g.type,
      lat: g.lat,
      lng: g.lng,
      cite_count: entry.citing_works.length,
      unique_papers_cited: entry.papers_cited.size,
      papers_cited: [...entry.papers_cited],
      // Cap stored citing-work list to keep the JSON light. Tooltips
      // show top entries; full data is one query away if ever needed.
      citing_works: entry.citing_works.slice(0, 10),
    });
  }
  institutions.sort((a, b) =>
    b.cite_count - a.cite_count || a.name.localeCompare(b.name));

  const countries = new Set(institutions.map((i) => i.country).filter(Boolean));

  // Map workId -> short label so the browser can render the per-paper list
  // inside an institution's detail card.
  const pubLookup = {};
  for (const r of resolved) {
    pubLookup[r.workId] = { label: r.label };
  }

  const output = {
    generated_at: new Date().toISOString(),
    source: 'OpenAlex (api.openalex.org)',
    summary: {
      total_publications:        resolved.length,
      total_citing_works:        totalCiting,
      self_citations_filtered:   selfFiltered,
      unique_institutions:       institutions.length,
      institutions_with_no_geo:  unresolvedGeo,
      unique_countries:          countries.size,
    },
    publications: resolved.map((r) => ({
      workId: r.workId,
      label: r.label,
      doi: r.doi || null,
      cites_in_openalex: seenCitingPerPub.get(r.workId) || 0,
    })),
    institutions,
  };

  const outDir = path.join(__dirname, '..', 'assets', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'citations.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  // Also write a JS wrapper so the browser can load it via a plain <script>
  // tag — no fetch(), so the page works identically over http://, https://,
  // GitHub Pages, and even file:// (where fetch is blocked).
  const jsPath = path.join(outDir, 'citations.js');
  const banner =
    '/* Auto-generated by scripts/fetch-citations.js — do not edit by hand. */\n' +
    "'use strict';\n";
  fs.writeFileSync(
    jsPath,
    `${banner}window.CITATIONS_DATA = ${JSON.stringify(output, null, 2)};\n`
  );

  console.log('\n' + '='.repeat(60));
  console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
  console.log(`Wrote ${path.relative(process.cwd(), jsPath)}`);
  console.log(`Citing works (after self-cite filter): ${output.summary.total_citing_works}`);
  console.log(`Self-cites filtered:                   ${output.summary.self_citations_filtered}`);
  console.log(`Unique institutions on map:            ${output.summary.unique_institutions}`);
  console.log(`Unique countries:                      ${output.summary.unique_countries}`);
  if (unresolvedGeo) {
    console.log(`Institutions skipped (no lat/lng):     ${unresolvedGeo}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
