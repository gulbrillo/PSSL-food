import { db } from '../utils/db'

const DEFAULT_RESTRICTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-free',
  'Dairy-free',
  'Nut allergy',
  'Shellfish allergy',
  'Halal',
  'Kosher',
  'No pork',
  'No beef'
]

export default defineNitroPlugin(async () => {
  try {
    for (const name of DEFAULT_RESTRICTIONS) {
      await db.restriction.upsert({ where: { name }, create: { name }, update: {} })
    }
  } catch (e) {
    console.error('Seeding restrictions failed (db not ready?):', e)
  }
})
