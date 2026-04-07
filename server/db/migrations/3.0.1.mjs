/**
 * CloudWiki 3.0.1 Migration
 * Migrate legacy Wiki.js references to CloudWiki
 */

export async function up (knex) {
  // Migrate auth audience from urn:wiki.js to urn:cloudwiki
  const authSetting = await knex('settings').where('key', 'auth').first()
  if (authSetting?.value?.audience === 'urn:wiki.js') {
    authSetting.value.audience = 'urn:cloudwiki'
    await knex('settings').where('key', 'auth').update({ value: authSetting.value })
    console.info('[3.0.1] Migrated auth audience from urn:wiki.js to urn:cloudwiki')
  }

  // Migrate security.authJwtAudience from urn:wiki.js to urn:cloudwiki
  const secSetting = await knex('settings').where('key', 'security').first()
  if (secSetting?.value?.authJwtAudience === 'urn:wiki.js') {
    secSetting.value.authJwtAudience = 'urn:cloudwiki'
    await knex('settings').where('key', 'security').update({ value: secSetting.value })
    console.info('[3.0.1] Migrated security authJwtAudience from urn:wiki.js to urn:cloudwiki')
  }
}

export function down (knex) {}
