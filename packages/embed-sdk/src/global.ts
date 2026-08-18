import { create, type ShieldEmbed, type ShieldEmbedOptions } from './index'

export { create }
export * from './protocol'

/**
 * Script-tag entry point. Reads its own `data-*` attributes so the simplest
 * integration is a single tag with no companion script:
 *
 *   <script src="https://shield.human.tech/embed.js"
 *           data-partner="acme" data-auto-open></script>
 *
 * Anything richer (events, navigate, inline mount) uses `Shield.create(...)`.
 * `document.currentScript` is only readable while this bundle is executing
 * synchronously, so the dataset is captured here at module top level.
 */
const script = typeof document !== 'undefined' ? (document.currentScript as HTMLScriptElement | null) : null
const data = script?.dataset

function scriptOptions(): ShieldEmbedOptions | null {
  if (!data) return null
  const options: ShieldEmbedOptions = {
    partnerId: data.partner,
    mode: data.target ? 'inline' : 'modal',
    target: data.target,
    defaults: { token: data.token, amount: data.amount },
    // The loader is served from the Shield origin, so default the app URL to
    // wherever this script came from — staging and local dev then need no flag.
    appUrl: script?.src ? new URL(script.src).origin : undefined,
  }
  if (data.height) options.height = Number(data.height)
  return options
}

const options = scriptOptions()

/** The auto-created widget, when the tag carried data-* attributes. */
export const instance: ShieldEmbed | null = options ? create(options) : null

// Inline already mounted inside create(); a modal only opens if the tag asked.
if (instance && options?.mode === 'modal' && data && 'autoOpen' in data) instance.open()
