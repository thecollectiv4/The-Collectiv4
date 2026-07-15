/* =========================================================================
   img — optimizedImage(): right-size heavy images through Supabase Storage's
   render/image transform CDN (on-the-fly resize + re-encode) so the museum
   gallery wall and directory covers ship small bytes instead of full 8 MB
   uploads.

   PURE + DEFENSIVE by design — safe to call on ANY value:
     • only rewrites PUBLIC object URLs from this project's storage
       (…/storage/v1/object/public/…). Foreign URLs, data: URIs, blob:,
       embeds, empty/null all pass through UNTOUCHED.
     • already-transformed URLs pass through (idempotent).
     • gated OFF by default → every call is currently a NO-OP (returns the
       url verbatim). It only starts transforming once VITE_IMG_TRANSFORM=on.

   ⚠ WHY OFF BY DEFAULT (empirical, 2026-07-14): Supabase Storage image
   transformation is a PAID add-on and it is NOT enabled on this project's
   tenant — the render endpoint answers 403 "FeatureNotEnabled". Verified live:
     GET …/storage/v1/render/image/public/worlds/<real-cover>.jpg?width=480
       → 403 {"error":"FeatureNotEnabled"}
   So this helper is deliberately INERT and wired NOWHERE (zero redesign of the
   heavy surfaces — museum gallery wall, directory covers). To switch it on
   later, TWO steps, no code change at call sites:
     1) enable Storage → Image Transformation on the Supabase project (Pato's
        call — it's a plan/billing feature), then
     2) set VITE_IMG_TRANSFORM=on in Vercel env and redeploy.
   Until then, wrapping a src in optimizedImage() is a safe no-op. See the v5
   pre-flight handback in the Build Roadmap for the full contract.
   ========================================================================= */

const OBJECT_MARK = '/storage/v1/object/public/'
const RENDER_MARK = '/storage/v1/render/image/public/'

// OFF by default (the tenant lacks the transform add-on — see header). Flip to
// transforming with VITE_IMG_TRANSFORM=on ONLY after the add-on is enabled.
const ENABLED = ((import.meta?.env?.VITE_IMG_TRANSFORM ?? 'off') + '').toLowerCase() === 'on'

/**
 * @param {string} url    a stored image URL (or anything — non-storage passes through)
 * @param {object} [opts]
 * @param {number} [opts.width]    target width in px
 * @param {number} [opts.height]   target height in px
 * @param {number} [opts.quality]  1–100, default 70
 * @param {'cover'|'contain'|'fill'} [opts.resize] default 'cover'
 * @returns {string|any} a render/image URL for our storage objects; otherwise
 *   the input returned VERBATIM (a null/undefined cover stays null/undefined,
 *   so `<img src={optimizedImage(cover)} />` omits src instead of emitting
 *   src="" and re-requesting the page). Never throws.
 */
export function optimizedImage(url, opts = {}) {
  // Pass anything that isn't a usable string straight through — never coerce
  // null/undefined to '' (that would make JSX render src="" and re-fetch the
  // current page). null→null, undefined→undefined, ''→'', non-string→verbatim.
  if (typeof url !== 'string' || !url) return url

  const at = url.indexOf(OBJECT_MARK)
  // OFF (tenant lacks the transform add-on), not one of our public storage
  // objects, or already a render URL → return the original url unchanged.
  if (!ENABLED || at === -1 || url.includes(RENDER_MARK)) return url

  const { width, height, quality = 70, resize = 'cover' } = opts
  const rendered = url.slice(0, at) + RENDER_MARK + url.slice(at + OBJECT_MARK.length)
  const path = rendered.split('#')[0].split('?')[0] // drop any existing query/hash

  const p = new URLSearchParams()
  if (Number.isFinite(width))   p.set('width',   String(Math.round(width)))
  if (Number.isFinite(height))  p.set('height',  String(Math.round(height)))
  if (Number.isFinite(quality)) p.set('quality', String(Math.round(quality)))
  if (resize)                   p.set('resize',  resize)

  const qs = p.toString()
  return qs ? `${path}?${qs}` : path
}

export default optimizedImage
