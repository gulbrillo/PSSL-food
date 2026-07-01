import { db } from './db'

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await db.appSetting.findUnique({ where: { key } })
  return row?.value ?? fallback
}

export async function setSetting(key: string, value: string) {
  await db.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
}
