import { db } from '../utils/db'

const DEFAULT_RESTRICTIONS: Record<string, string> = {
  Vegetarian:
    'No meat, poultry, or fish. Common traps: chicken broth in soups and rice, gelatin, fish sauce, lard in beans or pastry, pepperoni toppings.',
  Vegan:
    'No animal products at all — no meat, fish, dairy, eggs, or honey. Common traps: butter in buns and pastry, cheese, mayo, milk in dough, honey glazes, egg wash.',
  'Gluten-free':
    'No wheat, barley, or rye. Common traps: soy sauce, breading and croutons, pasta, pizza crust, many sauces and dressings, shared fryers (cross-contamination).',
  'Dairy-free':
    'No milk products. Common traps: butter, cheese, cream sauces, ranch dressing, many breads and desserts, whey in processed foods.',
  'Nut allergy':
    'No peanuts or tree nuts — can be severe, take cross-contamination seriously. Common traps: pesto, peanut sauce and peanut oil in Asian dishes, baked goods, granola, "may contain traces" items.',
  'Shellfish allergy':
    'No shrimp, crab, lobster, and usually mussels/clams — can be severe. Common traps: shared fryers, fish sauce, seafood broths and paella, surimi.',
  Halal:
    'No pork or alcohol; meat should be halal-certified. Common traps: gelatin, pepperoni and bacon bits, marshmallows, alcohol in sauces and desserts.',
  Kosher:
    'No pork or shellfish; meat and dairy are not mixed. Common traps: cheeseburgers, gelatin, non-certified meat, hidden dairy in meat dishes.',
  'No pork':
    'No pork or pork products. Common traps: pepperoni, bacon bits, ham, many sausages, gelatin, lard in refried beans and pastry.',
  'No beef':
    'No beef or beef products. Common traps: beef broth in soups and rice, burgers, meatballs and mixed-meat dishes, beef gelatin.'
}

export default defineNitroPlugin(async () => {
  try {
    for (const [name, description] of Object.entries(DEFAULT_RESTRICTIONS)) {
      const existing = await db.restriction.findUnique({ where: { name } })
      if (!existing) {
        await db.restriction.create({ data: { name, description } })
      } else if (!existing.description) {
        // backfill the default description once, but never overwrite admin edits
        await db.restriction.update({ where: { name }, data: { description } })
      }
    }
  } catch (e) {
    console.error('Seeding restrictions failed (db not ready?):', e)
  }
})
