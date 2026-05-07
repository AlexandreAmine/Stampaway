import { supabase } from "@/integrations/supabase/client";
import type { Language } from "@/i18n/translations";

/**
 * Lightweight DOM-level auto-translator.
 *
 * Key design choices for performance:
 * - We DO NOT observe `characterData` (React text updates fire this very
 *   frequently and would cause cascading work). We only watch `childList`.
 * - We mark every text node we have already seen with a Symbol-keyed expando
 *   so re-scans are O(new-nodes), not O(all-nodes).
 * - DOM scanning + applying is debounced (rAF-coalesced) so bursts of React
 *   renders only trigger one pass.
 * - Translation API calls are batched + chunked + cached in localStorage.
 *
 * To exclude user-generated content (reviews, bios, list names, place names
 * entered by users, usernames, etc.), wrap the element with
 * `data-no-translate` (or any ancestor).
 */

const STORAGE_KEY = "stampaway_dom_t_v3";
const SEEN = Symbol("stampaway_seen");
const ORIG = Symbol("stampaway_orig");

type CacheMap = Record<string, Record<string, string>>;

let cache: CacheMap = {};
try {
  cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
} catch {}

let saveTimer: number | null = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch {}
  }, 800);
}

const knownNodes: Set<Text> = new Set();
let currentLang: Language = "en";
let observer: MutationObserver | null = null;

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT",
  "SVG", "CANVAS", "MATH", "IFRAME",
]);

function isSkipped(el: Element | null): boolean {
  let cur: Element | null = el;
  while (cur) {
    if (SKIP_TAGS.has(cur.tagName)) return true;
    if (cur.hasAttribute("data-no-translate")) return true;
    if (cur.getAttribute("contenteditable") === "true") return true;
    cur = cur.parentElement;
  }
  return false;
}

// Exact-string blocklist: never send these texts to DeepL. Used for proper
// nouns (place names, brand words) so DeepL does not mistranslate e.g. "Riga".
const noTranslateExact: Set<string> = new Set([
  // Brand / product
  "StampAway", "Stampaway", "Tags", "Map",
]);
export function addNoTranslateStrings(values: Iterable<string>) {
  for (const v of values) {
    if (v && v.trim()) noTranslateExact.add(v.trim());
  }
}

function shouldTranslate(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  if (/^[\d.,:/\s\-+%]+$/.test(trimmed)) return false;
  if (noTranslateExact.has(trimmed)) return false;
  return true;
}

function applyTranslation(node: Text) {
  const original: string = (node as any)[ORIG] ?? node.nodeValue ?? "";
  if ((node as any)[ORIG] === undefined) (node as any)[ORIG] = original;

  if (currentLang === "en") {
    if (node.nodeValue !== original) node.nodeValue = original;
    return;
  }
  const langCache = cache[currentLang];
  if (!langCache) return;
  const trimmed = original.trim();
  const translated = langCache[trimmed];
  if (!translated || translated === trimmed) return;
  const lead = original.match(/^\s*/)?.[0] ?? "";
  const trail = original.match(/\s*$/)?.[0] ?? "";
  const next = lead + translated + trail;
  if (node.nodeValue !== next) node.nodeValue = next;
}

let pendingByLang: Map<Language, Set<string>> = new Map();
let flushTimer: number | null = null;

async function flush() {
  flushTimer = null;
  for (const [lang, set] of pendingByLang.entries()) {
    if (!set.size) continue;
    const texts = Array.from(set);
    set.clear();
    const CHUNK = 50;
    for (let i = 0; i < texts.length; i += CHUNK) {
      const slice = texts.slice(i, i + CHUNK);
      try {
        const { data, error } = await supabase.functions.invoke("translate-deepl", {
          body: { texts: slice, language: lang },
        });
        if (error || !data?.translations) continue;
        const translations: string[] = data.translations;
        if (!cache[lang]) cache[lang] = {};
        slice.forEach((src, idx) => {
          cache[lang][src] = translations[idx] ?? src;
        });
        scheduleSave();
      } catch {}
    }
  }
  // Re-apply only nodes whose text is now known
  if (currentLang !== "en") {
    const langCache = cache[currentLang] || {};
    knownNodes.forEach((n) => {
      if (!n.isConnected) {
        knownNodes.delete(n);
        return;
      }
      const orig = ((n as any)[ORIG] || "").trim();
      if (langCache[orig]) applyTranslation(n);
    });
  }
  // Re-apply attribute targets too
  if (currentLang !== "en") {
    const langCache = cache[currentLang] || {};
    knownAttrs.forEach((rec) => {
      if (!rec.el.isConnected) { knownAttrs.delete(rec); return; }
      const t = langCache[rec.orig.trim()];
      if (t) rec.el.setAttribute(rec.attr, t);
    });
  }
}

// ---- Attribute translation (placeholder, aria-label, title, alt) ----
const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;
type AttrRec = { el: Element; attr: string; orig: string };
const knownAttrs: Set<AttrRec> = new Set();
const seenAttr: WeakSet<Element> = new WeakSet();

function processAttrs(root: Node) {
  if (typeof document === "undefined") return;
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  const elements: Element[] = [];
  if ((root as Element).nodeType === 1) elements.push(root as Element);
  const all = (root as Element).querySelectorAll?.("[placeholder],[aria-label],[title],[alt]");
  if (all) all.forEach((e) => elements.push(e));
  const langCache = cache[currentLang] || {};
  for (const el of elements) {
    if (isSkipped(el)) continue;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v || !shouldTranslate(v)) continue;
      // De-dupe per element+attr by stamping data attribute
      const stamp = `__t_${a}`;
      if ((el as any)[stamp] === v) continue;
      (el as any)[stamp] = v;
      const rec: AttrRec = { el, attr: a, orig: v };
      knownAttrs.add(rec);
      if (currentLang !== "en") {
        const t = langCache[v.trim()];
        if (t) el.setAttribute(a, t);
        else enqueue(currentLang, v.trim());
      }
    }
  }
}

function enqueue(lang: Language, text: string) {
  if (!pendingByLang.has(lang)) pendingByLang.set(lang, new Set());
  pendingByLang.get(lang)!.add(text);
  if (flushTimer) return;
  flushTimer = window.setTimeout(flush, 120);
}

// Walk subtree collecting NEW text nodes only
function processSubtree(root: Node) {
  if (typeof document === "undefined") return;
  // TreeWalker is far faster than recursive JS for large trees
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node) {
      if ((node as any)[SEEN]) return NodeFilter.FILTER_REJECT;
      const tn = node as Text;
      const v = tn.nodeValue || "";
      if (!shouldTranslate(v)) return NodeFilter.FILTER_REJECT;
      if (isSkipped(tn.parentElement)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  } as any);

  const langCache = cache[currentLang] || {};
  let n: Node | null;
  // eslint-disable-next-line no-cond-assign
  while ((n = walker.nextNode())) {
    const tn = n as Text;
    (tn as any)[SEEN] = true;
    (tn as any)[ORIG] = tn.nodeValue || "";
    knownNodes.add(tn);
    if (currentLang !== "en") {
      const orig = (tn.nodeValue || "").trim();
      if (langCache[orig]) {
        applyTranslation(tn);
      } else {
        enqueue(currentLang, orig);
      }
    }
  }
}

let scanScheduled = false;
const pendingRoots: Set<Node> = new Set();
function scheduleScan(root: Node) {
  pendingRoots.add(root);
  if (scanScheduled) return;
  scanScheduled = true;
  // Coalesce many added nodes from the same React commit
  requestAnimationFrame(() => {
    scanScheduled = false;
    const roots = Array.from(pendingRoots);
    pendingRoots.clear();
    for (const r of roots) {
      if ((r as any).isConnected !== false) processSubtree(r);
    }
  });
}

export function startDomTranslator(lang: Language) {
  currentLang = lang;
  if (typeof document === "undefined") return;
  processSubtree(document.body);
  if (!observer && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== "childList") continue;
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1 || n.nodeType === 11) scheduleScan(n);
          else if (n.nodeType === 3) {
            // Single text node added — process its parent so checks run uniformly
            if (n.parentNode) scheduleScan(n.parentNode);
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

export function setDomTranslatorLanguage(lang: Language) {
  currentLang = lang;
  if (typeof document === "undefined") return;
  // Re-apply all known nodes; queue any missing translations
  const langCache = cache[lang] || {};
  knownNodes.forEach((n) => {
    if (!n.isConnected) {
      knownNodes.delete(n);
      return;
    }
    const orig = (((n as any)[ORIG] as string) || "").trim();
    if (lang === "en") {
      applyTranslation(n);
    } else if (langCache[orig]) {
      applyTranslation(n);
    } else if (orig) {
      enqueue(lang, orig);
    }
  });
}
