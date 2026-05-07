import { supabase } from "@/integrations/supabase/client";
import type { Language } from "@/i18n/translations";

/**
 * DOM-level auto-translator.
 *
 * Scans visible text nodes under <body>, batches them through DeepL via the
 * `translate-deepl` edge function, and replaces nodeValue with the translation.
 * Original English is preserved per-node so we can restore on language change.
 *
 * To exclude user-generated content (reviews, bios, list/place names entered
 * by users), wrap the element with `data-no-translate` (or any ancestor).
 *
 * Skips: SCRIPT, STYLE, CODE, PRE, NOSCRIPT, TEXTAREA, INPUT, SELECT,
 * [contenteditable], [data-no-translate].
 */

const STORAGE_KEY = "stampaway_dom_t_v1";

type CacheMap = Record<string, Record<string, string>>; // lang -> en -> translated

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
  }, 500);
}

// Per-node original English text
const originalText = new WeakMap<Text, string>();
// All known nodes (so we can re-apply on language change)
const knownNodes = new Set<Text>();

let currentLang: Language = "en";
let observer: MutationObserver | null = null;

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT",
  "SVG", "CANVAS", "MATH",
]);

function isSkipped(el: Element | null): boolean {
  let cur = el;
  while (cur) {
    if (cur.nodeType === 1) {
      const e = cur as Element;
      if (SKIP_TAGS.has(e.tagName)) return true;
      if (e.hasAttribute("data-no-translate")) return true;
      if (e.getAttribute("contenteditable") === "true") return true;
    }
    cur = cur.parentElement;
  }
  return false;
}

// Heuristic: skip text that's clearly not natural language
function shouldTranslate(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  // No letters at all (numbers, punctuation, emoji)
  if (!/[A-Za-z]/.test(trimmed)) return false;
  // Pure numeric/date-ish like "2024", "12:30", "3.5"
  if (/^[\d.,:/\\s-]+$/.test(trimmed)) return false;
  return true;
}

function collectTextNodes(root: Node, out: Text[]) {
  if (root.nodeType === 3) {
    const tn = root as Text;
    const v = tn.nodeValue || "";
    if (!shouldTranslate(v)) return;
    if (isSkipped(tn.parentElement)) return;
    out.push(tn);
    return;
  }
  if (root.nodeType !== 1) return;
  const el = root as Element;
  if (SKIP_TAGS.has(el.tagName)) return;
  if (el.hasAttribute("data-no-translate")) return;
  if (el.getAttribute("contenteditable") === "true") return;
  for (const child of Array.from(root.childNodes)) collectTextNodes(child, out);
}

function applyTranslation(node: Text) {
  const original = originalText.get(node) ?? node.nodeValue ?? "";
  if (!originalText.has(node)) originalText.set(node, original);
  knownNodes.add(node);

  if (currentLang === "en") {
    if (node.nodeValue !== original) node.nodeValue = original;
    return;
  }
  const langCache = cache[currentLang] || {};
  const trimmed = original.trim();
  const translated = langCache[trimmed];
  if (translated) {
    // Preserve leading/trailing whitespace
    const lead = original.match(/^\s*/)?.[0] ?? "";
    const trail = original.match(/\s*$/)?.[0] ?? "";
    const next = lead + translated + trail;
    if (node.nodeValue !== next) node.nodeValue = next;
  } else if (node.nodeValue !== original) {
    // Reset to English while waiting
    node.nodeValue = original;
  }
}

let pendingByLang = new Map<Language, Set<string>>();
let flushTimer: number | null = null;

async function flush() {
  flushTimer = null;
  const tasks: Array<Promise<void>> = [];
  for (const [lang, set] of pendingByLang.entries()) {
    if (!set.size) continue;
    const texts = Array.from(set);
    set.clear();
    tasks.push(
      (async () => {
        // Chunk to keep payloads manageable
        const CHUNK = 40;
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
          } catch {
            /* ignore */
          }
        }
      })(),
    );
  }
  await Promise.all(tasks);
  // Re-apply across all known nodes
  knownNodes.forEach((n) => {
    if (!n.isConnected) {
      knownNodes.delete(n);
      return;
    }
    applyTranslation(n);
  });
}

function enqueue(lang: Language, text: string) {
  if (!pendingByLang.has(lang)) pendingByLang.set(lang, new Set());
  pendingByLang.get(lang)!.add(text);
  if (flushTimer) return;
  flushTimer = window.setTimeout(flush, 60);
}

function processNode(node: Node) {
  const nodes: Text[] = [];
  collectTextNodes(node, nodes);
  for (const n of nodes) {
    if (!originalText.has(n)) originalText.set(n, n.nodeValue || "");
    knownNodes.add(n);
    applyTranslation(n);
    if (currentLang !== "en") {
      const original = originalText.get(n)!.trim();
      const langCache = cache[currentLang] || {};
      if (!langCache[original]) enqueue(currentLang, original);
    }
  }
}

export function startDomTranslator(lang: Language) {
  currentLang = lang;
  // Initial scan
  if (typeof document !== "undefined") {
    processNode(document.body);
  }
  // Observe future mutations
  if (!observer && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") {
          const node = m.target as Text;
          // Reset original if user edited the DOM directly
          if (!isSkipped(node.parentElement) && shouldTranslate(node.nodeValue || "")) {
            // If we previously translated this node, keep the original mapping
            // Otherwise treat current value as new English source
            if (!originalText.has(node)) {
              originalText.set(node, node.nodeValue || "");
            }
            knownNodes.add(node);
            // Heuristic: if value differs from our last applied translation,
            // update original baseline
            const original = originalText.get(node)!;
            const langCache = cache[currentLang]?.[original.trim()];
            if (
              currentLang !== "en" &&
              langCache &&
              node.nodeValue?.trim() !== langCache &&
              node.nodeValue?.trim() !== original.trim()
            ) {
              originalText.set(node, node.nodeValue || "");
            }
            applyTranslation(node);
            if (currentLang !== "en") {
              const orig = originalText.get(node)!.trim();
              if (!cache[currentLang]?.[orig]) enqueue(currentLang, orig);
            }
          }
        } else if (m.type === "childList") {
          m.addedNodes.forEach((n) => processNode(n));
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

export function setDomTranslatorLanguage(lang: Language) {
  currentLang = lang;
  // Re-apply translations for all known nodes; queue any missing
  knownNodes.forEach((n) => {
    if (!n.isConnected) {
      knownNodes.delete(n);
      return;
    }
    applyTranslation(n);
    if (lang !== "en") {
      const original = (originalText.get(n) || "").trim();
      if (original && !(cache[lang] && cache[lang][original])) {
        enqueue(lang, original);
      }
    }
  });
}
