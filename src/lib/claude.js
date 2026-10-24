import { KEYS, readAll, writeAll } from './storageKeys'

// The key is pasted by the user in Settings and stays on this device. It is
// never bundled into the build (VITE_* env vars end up in the public JS).
export function getAnthropicApiKey() {
  return readAll(KEYS.anthropicApiKey) || ''
}

export function setAnthropicApiKey(key) {
  const trimmed = key.trim()
  if (trimmed) writeAll(KEYS.anthropicApiKey, trimmed)
  else localStorage.removeItem(KEYS.anthropicApiKey)
}

export function hasAnthropicApiKey() {
  return Boolean(getAnthropicApiKey())
}

export async function askClaude(messages, systemPrompt) {
  const apiKey = getAnthropicApiKey()
  if (!apiKey) {
    throw new Error('No Anthropic API key set. Add your key in Settings → AI Import.')
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Claude API error ${res.status}`)
  }
  const data = await res.json()
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('')
}
