/*
  QUICK LINKS — configuration for the "Quick Links" nav dropdown.
  ---------------------------------------------------------------
  Edit this list any time — every page (index.html, about.html, etc.)
  reads from here and rebuilds its "Quick Links" menu automatically.
  No other file needs to change.

  Each entry is one of:
    { label: "Text shown in the menu", href: "page.html#anchor" }
  or, for an item with a submenu (like "Architecture Grid"):
    { label: "Text shown in the menu", children: [ {label, href}, ... ] }

  Rules:
    - Keep every entry wrapped in { } and separated by commas.
    - "href" can point to another page ("committee.html"), a section on
      another page ("committee.html#steering"), or a section on the same
      page ("#somewhere").
    - Order here is the order it appears in the menu, top to bottom.
    - To remove an item, delete its whole { ... } block (and the comma
      before or after it, don't leave two commas in a row).
    - To add an item, copy an existing { ... } block and edit it.
*/
window.QUICK_LINKS = [
  { label: "Technical & Software Sessions", href: "sessions.html" },
  {
    label: "Your REEV 4.0 Journey",
    children: [
      { label: "Why Participate?",        href: "index.html#why-participate" },
      { label: "Learn → Build & Prove",   href: "index.html#stages" },
      { label: "Technical Challenge",     href: "index.html#challenge" },
      { label: "2026–27 Timeline",        href: "index.html#timeline" },
      { label: "CCE — How You're Evaluated", href: "index.html#cce" },
      { label: "REEV Journey (History)",  href: "about.html#reev-journey" }
    ]
  },
  { label: "Awards & Recognition",   href: "about.html#awards" },
  { label: "Faculty & Institutions", href: "about.html#faculty" },
  { label: "Contact Us",             href: "about.html#contact" },
  { label: "Steering Committee",     href: "committee.html#steering" },
  { label: "Organizing Committee",   href: "committee.html#organizing" },
  { label: "Technical Committee",    href: "committee.html#technical" },
  { label: "Alumni Committee",       href: "committee.html#alumni" },
  { label: "Event Support Team",     href: "committee.html#support" },
  { label: "Rulebook & Resources",   href: "resources.html#rulebook" },
  { label: "How to Participate",     href: "resources.html#participate" },
  { label: "Press Releases",         href: "news.html" },
  { label: "Image Gallery",          href: "gallery.html" },
  { label: "Forum",                  href: "resources.html#forum" },
  { label: "Live Streaming",         href: "resources.html#live" },
  {
    label: "Architecture Grid",
    children: [
      { label: "Propulsion",       href: "architecture.html#propulsion" },
      { label: "Standardization",  href: "architecture.html#standardization" },
      { label: "Energy",           href: "architecture.html#energy" },
      { label: "Software",         href: "architecture.html#software" },
      { label: "Mentorship",       href: "architecture.html#mentorship" }
    ]
  }
];
