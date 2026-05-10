'use strict';

/* =============================================================
 * geoExperiences.js
 *
 * Single source of truth for the globe-hero markers.
 *
 * To ADD a new experience:    push a new object below.
 * To EDIT an existing one:    update its fields in place.
 * To REMOVE:                  delete the matching object.
 *
 * Field guide
 *   id            unique slug, used for DOM ids and selection state
 *   title         headline shown on hover/click (role, project, paper)
 *   organization  institution / lab / venue
 *   type          one of TYPES below — drives marker color + category tag
 *   locationName  human-readable place string
 *   lat, lng      decimal degrees (verified against the listed institution)
 *   dateRange     free-text date span ("Aug 2023 — Present", "2024", etc.)
 *   description   short paragraph (1–2 sentences)
 *   tags          short skill / topic chips
 *   link          hash linking to the matching tabbed section in index.html
 *                 (one of #about #education #skills #projects #publications #contact)
 *   targetId      OPTIONAL — id of a specific element inside that section
 *                 (e.g., "pub-spie-dcs-2024", "proj-rtcrawler"). When set,
 *                 clicking the marker scrolls past the hero AND zooms in
 *                 to that exact card / publication / project. If the target
 *                 is a project card, it is also auto-expanded.
 *
 * Notes on coordinates
 *   - Iowa State University, Ames IA: campus center 42.0267, -93.6465
 *   - SSN College of Engineering, Kalavakkam (Chennai metro): 12.7519, 80.1996
 *   - IIT Madras (Centre for NDE), Chennai: 12.9915, 80.2337
 *   - ARi Private Limited, Chennai HQ: 13.0827, 80.2707 (city-level coord;
 *     no public street address used here to avoid exposing private info)
 *   - SPIE Photonics West is held in San Francisco (37.7749, -122.4194)
 *   - SPIE Defense + Commercial Sensing (DCS) 2024 was in National Harbor,
 *     Maryland (38.7846, -76.9956)
 *   - IEEE ITSC 2025 host city: Gold Coast, Australia (-28.0167, 153.4000)
 * ============================================================= */

// Marker categories. Each has a color + a short label.
// Colors are tuned for a dark globe; they remain distinguishable to viewers
// with common color-vision differences, but we always also show the category
// label in tooltips and cards (do not rely on color alone).
const GEO_TYPES = {
  'Current Location':       { color: '#22d3ee', label: 'Current Location' },
  'Education':              { color: '#a78bfa', label: 'Education' },
  'Research Experience':    { color: '#60a5fa', label: 'Research' },
  'Internship':             { color: '#34d399', label: 'Internship' },
  'Teaching Experience':    { color: '#fbbf24', label: 'Teaching' },
  'Mentorship':             { color: '#f472b6', label: 'Mentorship' },
  'Project':                { color: '#fb923c', label: 'Project' },
  'Publication':            { color: '#f87171', label: 'Publication' },
  'Conference / Publication': { color: '#f87171', label: 'Conference' },
  'Affiliation':            { color: '#94a3b8', label: 'Affiliation' }
};

const geoExperiences = [
  // ---------- CURRENT LOCATION ----------
  {
    id: 'current-location-ames',
    title: 'Current Location',
    organization: 'Ames, Iowa, USA',
    type: 'Current Location',
    locationName: 'Ames, Iowa, USA',
    lat: 42.0308,
    lng: -93.6319,
    dateRange: 'Current',
    description: 'Current academic and research base — graduate studies and active research in robotics, computer vision, AI/ML, and digital twin systems.',
    tags: ['Robotics', 'Computer Vision', 'AI/ML', 'Digital Twin'],
    link: '#about'
  },

  // ---------- EDUCATION ----------
  {
    id: 'education-iowa-state',
    title: 'M.S., Mechanical Engineering',
    organization: 'Iowa State University of Science and Technology',
    type: 'Education',
    locationName: 'Ames, Iowa, USA',
    lat: 42.0267,
    lng: -93.6465,
    dateRange: 'Aug 2023 — Dec 2025',
    description: 'Graduate studies in Mechanical Engineering with research across robotics, computer vision, machine learning, 3D optical sensing, and digital twin systems. CGPA 3.91/4.0.',
    tags: ['Mechanical Engineering', 'Robotics', 'Computer Vision', 'Machine Learning'],
    link: '#education',
    targetId: 'edu-isu'
  },
  {
    id: 'education-ssn',
    title: 'B.E., Mechanical Engineering',
    organization: 'Sri Sivasubramaniya Nadar College of Engineering',
    type: 'Education',
    locationName: 'Chennai, Tamil Nadu, India',
    lat: 12.7519,
    lng: 80.1996,
    dateRange: 'Aug 2018 — May 2022',
    description: 'Undergraduate education in Mechanical Engineering. First Rank in Department, Gold Medal for Academic Excellence, and early robotics / NDE work.',
    tags: ['Mechanical Engineering', 'Robotics', 'NDE'],
    link: '#education',
    targetId: 'edu-ssn'
  },

  // ---------- RESEARCH / WORK EXPERIENCE ----------
  {
    id: 'experience-iowa-state-gra',
    title: 'Graduate Research Assistant',
    organization: 'Iowa State University',
    type: 'Research Experience',
    // Slight offset from the M.S. marker so both are individually clickable.
    locationName: 'Ames, Iowa, USA',
    lat: 42.0290,
    lng: -93.6490,
    dateRange: 'Aug 2023 — Present',
    description: 'Graduate Research Assistant across multiple labs working on robotics, computer vision, digital twin systems, AI/ML, and 3D optical sensing.',
    tags: ['Graduate Research', 'Robotics', 'AI/ML', 'Digital Twin'],
    link: '#skills',
    targetId: 'exp-isu-gra'
  },
  {
    id: 'experience-teaching-assistant',
    title: 'Teaching Assistant',
    organization: 'Iowa State University',
    type: 'Teaching Experience',
    locationName: 'Ames, Iowa, USA',
    lat: 42.0245,
    lng: -93.6440,
    dateRange: 'Aug 2024 — Dec 2024',
    description: 'Teaching Assistant at Iowa State University supporting an undergraduate engineering course.',
    tags: ['Teaching', 'Mentorship', 'Engineering Education'],
    link: '#skills',
    targetId: 'exp-ta'
  },
  {
    id: 'experience-lumiere',
    title: 'Research Mentor',
    organization: 'Lumiere Education & Iowa State University',
    type: 'Mentorship',
    locationName: 'Ames, Iowa, USA / Remote',
    lat: 42.0210,
    lng: -93.6390,
    dateRange: 'Jun 2024 — Present',
    description: 'Research mentorship role connected with Lumiere Education and Iowa State University, guiding students through structured research projects.',
    tags: ['Mentorship', 'Research', 'Education'],
    link: '#skills',
    targetId: 'exp-lumiere'
  },
  {
    id: 'experience-cnde-iit-madras',
    title: 'Project Associate',
    organization: 'Centre for Non-Destructive Evaluation, IIT Madras',
    type: 'Research Experience',
    locationName: 'Chennai, Tamil Nadu, India',
    lat: 12.9915,
    lng: 80.2337,
    dateRange: 'Jul 2022 — Aug 2023',
    description: 'Led the development of an intelligent climbing robot for AI-based inspection of hydrogen reformer tubes — sensor fusion (laser, IMU, ultrasonic), LabVIEW DAQ, and MATLAB 2D/3D reconstruction.',
    tags: ['NDE', 'Robotics', 'Inspection', 'Sensor Fusion'],
    // Deep-link to the Reformer Tube Crawler project card — that is the
    // headline output of this role.
    link: '#projects',
    targetId: 'proj-rtcrawler'
  },
  {
    id: 'experience-ari',
    title: 'Research and Development Intern',
    organization: 'ARi Private Limited',
    type: 'Internship',
    locationName: 'Chennai, Tamil Nadu, India',
    lat: 13.0827,
    lng: 80.2707,
    dateRange: 'Mar 2022 — May 2022',
    description: 'Research and development internship in mechanical / engineering analysis.',
    tags: ['R&D', 'Engineering', 'Internship'],
    link: '#skills',
    targetId: 'exp-ari'
  },

  // ---------- PUBLICATIONS / CONFERENCES ----------
  {
    id: 'publication-spie-dcs-2024',
    title: 'Autonomous robotic 3D scanning for smart factory planning',
    organization: 'SPIE Defense + Commercial Sensing 2024',
    type: 'Conference / Publication',
    // SPIE DCS 2024 was held at Gaylord National Resort, National Harbor, MD.
    // TODO: confirm if a future edition's location should be reflected here.
    locationName: 'National Harbor, Maryland, USA',
    lat: 38.7846,
    lng: -76.9956,
    dateRange: 'Jun 2024',
    description: 'Conference paper on autonomous robotic 3D scanning for smart-factory planning, presented in the SPIE Dimensional Optical Metrology track.',
    tags: ['Conference', 'Robotic 3D Scanning', 'Digital Twin'],
    link: '#publications',
    targetId: 'pub-spie-dcs-2024'
  },
  {
    id: 'publication-spie-photonics-west-2026',
    title: 'ML benchmarking for FPP with photorealistic synthetic data',
    organization: 'SPIE Photonics West 2026',
    type: 'Conference / Publication',
    locationName: 'San Francisco, California, USA',
    lat: 37.7749,
    lng: -122.4194,
    dateRange: '2026',
    description: 'Comprehensive machine-learning benchmarking for Fringe Projection Profilometry (FPP) using photorealistic synthetic data generated with VIRTUS-FPP.',
    tags: ['Conference', 'FPP', 'Synthetic Data', 'Machine Learning'],
    link: '#publications',
    targetId: 'pub-spie-pw-2026'
  },
  {
    id: 'publication-ieee-itsc-2025',
    title: 'ClearVision: all-weather classification in traffic camera imagery',
    organization: 'IEEE Intelligent Transportation Systems Conference 2025',
    type: 'Conference / Publication',
    // TODO: IEEE ITSC 2025 host city is Gold Coast, Australia. Verify before publishing.
    locationName: 'Gold Coast, Queensland, Australia',
    lat: -28.0167,
    lng: 153.4000,
    dateRange: '2025',
    description: 'CycleGAN + SigLIP-2 pipeline for robust all-weather classification in traffic camera imagery — published at IEEE ITSC 2025.',
    tags: ['Computer Vision', 'Traffic Cameras', 'AI/ML'],
    link: '#publications',
    targetId: 'pub-ieee-itsc-2025'
  },

  // ---------- AFFILIATIONS ----------
  // (These mirror the "Affiliations" strip on the About page.)
  {
    id: 'affiliation-reactor',
    title: 'REACTOR Lab',
    organization: 'Iowa State University — Center for Transportation Research and Education',
    type: 'Affiliation',
    locationName: 'Ames, Iowa, USA',
    lat: 42.0345,
    lng: -93.6500,
    dateRange: 'Affiliated',
    description: 'Research affiliation with the REACTOR Lab at Iowa State University.',
    tags: ['Affiliation', 'Transportation', 'AI/ML'],
    link: '#about',
    targetId: 'aff-reactor'
  },
  {
    id: 'affiliation-vrac',
    title: 'Virtual Reality Applications Center (VRAC)',
    organization: 'Iowa State University',
    type: 'Affiliation',
    locationName: 'Ames, Iowa, USA',
    lat: 42.0280,
    lng: -93.6520,
    dateRange: 'Affiliated',
    description: 'Research affiliation with the Virtual Reality Applications Center at Iowa State University.',
    tags: ['Affiliation', 'VR', 'HCI'],
    link: '#about',
    targetId: 'aff-vrac'
  },
  {
    id: 'affiliation-cmia',
    title: 'CMIA Lab',
    organization: 'Iowa State University',
    type: 'Affiliation',
    locationName: 'Ames, Iowa, USA',
    lat: 42.0250,
    lng: -93.6555,
    dateRange: 'Affiliated',
    description: 'Research affiliation with the CMIA Lab at Iowa State University.',
    tags: ['Affiliation', 'Imaging', 'Analysis'],
    link: '#about',
    targetId: 'aff-cmia'
  }
];

// Expose globally so globe-hero.js (a plain script tag) can use it.
window.GEO_TYPES = GEO_TYPES;
window.geoExperiences = geoExperiences;
