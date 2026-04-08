export async function dispatchWebhook (event, payload) {
  const webhookSettings = await WIKI.db.settings.query().findOne({ key: 'webhooks' })
  if (!webhookSettings?.value?.endpoints) return

  for (const endpoint of webhookSettings.value.endpoints) {
    if (!endpoint.active || !endpoint.events.includes(event)) continue
    try {
      await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CloudWiki-Event': event },
        body: JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload }),
        signal: AbortSignal.timeout(5000)
      })
    } catch (err) {
      WIKI.logger.warn(`[Webhooks] Failed to deliver ${event} to ${endpoint.url}: ${err.message}`)
    }
  }
}
