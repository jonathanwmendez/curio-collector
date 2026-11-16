'use client';
import { CATEGORIES, CONDITIONS } from './constants';
import { today } from './format';

const KEY = 'curio.anthropicKey';
const MODEL = 'curio.anthropicModel';

export function getClaudeKey() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } }
export function setClaudeKey(k: string) { try { k ? localStorage.setItem(KEY, k) : localStorage.removeItem(KEY); } catch {} }
export function getClaudeModel() { try { return localStorage.getItem(MODEL) || 'claude-sonnet-5-5'; } catch { return 'claude-sonnet-5-5'; } }
export function setClaudeModel(m: string) { try { localStorage.setItem(MODEL, m); } catch {} }

export function parseJSON(text: string) {
  const t = String(text || '').replace(/```json|```/g, '');
  const a = t.indexOf('{'), b = t.indexOf('[');
  const start = a === -1 ? b : b === -1 ? a : Math.min(a, b);
  if (start === -1) return null;
  const end = t.lastIndexOf(t[start] === '{' ? '}' : ']');
  try { return JSON.parse(t.slice(start, end + 1)); } catch { return null; }
}

/** Calls the Anthropic API straight from the browser with the user's own key. The key never touches our server. */
async function callClaude(content: any[], maxTokens = 1400) {
  const key = getClaudeKey();
  if (!key) throw new Error('Add your Anthropic API key in Settings first.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model: getClaudeModel(), max_tokens: maxTokens, messages: [{ role: 'user', content }] })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message || `Claude request failed (${res.status})`);
  return { text: (j.content || []).map((c: any) => c.text || '').join(''), usage: j.usage };
}

export const IDENTIFY_PROMPT = (hint: string) => `You are an expert appraiser of collectibles: sports and trading cards, coins, comics, stamps, toys, memorabilia, video games, records, magazines, newspapers and ornaments. Identify the item in the attached photo(s) (front first, then back if provided) and estimate its current US market value for ONE unit in the condition shown, based on recent sold prices you know of. Today is ${today()}.
Owner's note: ${hint ? hint.slice(0, 300) : 'none'}
Reply with ONLY a JSON object, no other text, with these keys:
{"name": short catalog-style title like "1989 Upper Deck Ken Griffey Jr. #1",
"category": one of ${JSON.stringify(CATEGORIES)},
"year": "", "brand": "maker, publisher or mint", "set_name": "set, series or issue", "number": "card, issue or catalog number", "subject": "player, character or person", "variant": "parallel, edition, printing or variety",
"condition": one of ${JSON.stringify(CONDITIONS)}, "grader": "", "grade": "", "cert_number": "", "sealed": boolean,
"value_low": number, "value_mid": number, "value_high": number,
"confidence": number from 0 to 1,
"notes": "1 or 2 sentences on the key identifiers and what drives the value",
"alternates": [{"name":"","year":"","set_name":""}],
"tags": ["up to 5 short tags"]}
Use "" for unknown text. Values are USD. Give up to 3 alternates only when the match is uncertain. If the photo is not a collectible or is unreadable, set confidence below 0.2 and say why in notes.`;

export async function identifyWithKey(imagesBase64: string[], hint: string) {
  const content: any[] = imagesBase64.map(data => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }));
  content.push({ type: 'text', text: IDENTIFY_PROMPT(hint) });
  const { text } = await callClaude(content);
  const r = parseJSON(text);
  if (!r || typeof r !== 'object') throw new Error('Claude replied but the result could not be read. Try again.');
  return r;
}

export async function estimateWithKey(items: any[]) {
  const out = new Map<string, any>();
  for (let i = 0; i < items.length; i += 12) {
    const batch = items.slice(i, i + 12).map(x => ({
      id: x.id, name: x.name, category: x.category, year: x.year, brand: x.brand, set_name: x.set_name, number: x.number,
      subject: x.subject, variant: x.variant, condition: x.condition, grader: x.grader, grade: x.grade, sealed: x.sealed,
      ebay_asking_median: x.ask_median ?? null, ebay_asking_listings: x.ask_count ?? null
    }));
    const prompt = `You are an expert collectibles appraiser. Estimate the current US market value in USD for ONE unit of each item below, in its stated condition or grade, based on recent sold prices you know of. Today is ${today()}. Where ebay_asking_median is given, it is the median current eBay asking price; sold prices usually run below asking, so use it as a cross-check, not the answer.
Items: ${JSON.stringify(batch)}
Reply with ONLY a JSON array, no other text: [{"id":"same id","value_low":0,"value_mid":0,"value_high":0,"note":"one short sentence on what drives the value"}]`;
    const { text } = await callClaude([{ type: 'text', text: prompt }], 2000);
    const arr = parseJSON(text);
    if (Array.isArray(arr)) arr.forEach(r => { if (r?.id && Number(r.value_mid) > 0) out.set(String(r.id), r); });
  }
  return out;
}
