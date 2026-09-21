import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {createCatalogGateway} from '../server/catalog';
import {FEATURED_PRODUCTS} from '../../src/lib/catalog/merchandising';

async function main() {
  const generic = Array.from({length: 135}, (_, i) => ({id: `generic-${i}`, name: `А ${String(i).padStart(3, '0')}`, priceKgs: i + 1, images: i % 2 ? ['https://images.example/product.jpg'] : [], category: 'Остальные'}));
  const featured = FEATURED_PRODUCTS.map((p, i) => ({id: p.id, name: p.name, priceKgs: 500 + i, imageUrl: `https://images.example/${p.id}.jpg`, category: 'Избранные'}));
  const items = [...generic, ...featured.toReversed()];
  const gateway = createCatalogGateway('https://catalog.fixture.invalid', 'fixture-token', async input => {
    const page = Number(new URL(String(input)).searchParams.get('page'));
    return Response.json({items: items.slice((page - 1) * 100, page * 100), total: items.length});
  });
  const query = async (params: Record<string, string> = {}) => await gateway('/products', new URLSearchParams({sort: 'recommended', pageSize: '15', ...params})) as {items: typeof items; total: number};
  const first = await query();
  assert.deepEqual(first.items.map(p => p.id), FEATURED_PRODUCTS.map(p => p.id));
  const all: typeof items = [];
  for (let page = 1; page <= 10; page++) all.push(...(await query({page: String(page)})).items);
  assert.equal(all.length, items.length);
  assert.equal(new Set(all.map(p => p.id)).size, items.length);
  const hasImage = (p: typeof items[number]) => Boolean('imageUrl' in p ? p.imageUrl : p.images.length);
  const firstMissing = all.findIndex(p => !hasImage(p));
  assert.equal(firstMissing, 15 + 67);
  assert.ok(all.slice(firstMissing).every(p => !hasImage(p)));
  assert.deepEqual((await query()).items, first.items);
  assert.equal((await query({sort: 'price_asc'})).items[0].id, 'generic-0');
  assert.equal((await query({sort: 'price_desc'})).items[0].id, featured.at(-1)!.id);
  assert.equal((await query({sort: 'name'})).items[0].id, 'generic-0');
  assert.equal((await query({search: 'Гибкий шланг'})).items[0].id, FEATURED_PRODUCTS[2].id);
  assert.ok((await query({search: 'А 00'})).items.every(p => p.name.startsWith('А 00')));
  assert.equal((await query({id: FEATURED_PRODUCTS[8].id})).items[0].id, FEATURED_PRODUCTS[8].id);
  const legacy = await gateway('/products', new URLSearchParams({pageSize: '15'})) as {items: typeof items};
  assert.equal(legacy.items[0].id, 'generic-0');
  const noPhoto = {...featured[0], imageUrl: ''};
  const negativeGateway = createCatalogGateway('https://catalog.fixture.invalid', 'fixture', async () => Response.json({items: [noPhoto, generic[0], generic[1]], total: 3}));
  const negative = await negativeGateway('/products', new URLSearchParams({sort: 'recommended'})) as {items: typeof items};
  assert.equal(negative.items[0].id, 'generic-1');
  assert.equal(negative.items.length, 3); // No absent featured products invented.
  const result = {status: 'PASS', scenarios: ['15 exact featured IDs promoted from late source pages in owner order', 'remaining images before placeholders across 10 pages', 'no duplicates or omissions', 'deterministic repeated request', 'explicit ascending/descending price and name preserved', 'search and ID filtering before ordering', 'legacy source order unchanged', 'featured without image does not outrank actual image', 'absent IDs do not create invented products'], total: items.length};
  const dir = process.env.REGRESSION_EVIDENCE_DIR || 'artifacts/device-20260921/';
  mkdirSync(dir, {recursive:true}); writeFileSync(dir + 'catalog-merchandising.json', JSON.stringify(result, null, 2)); console.log(result);
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
