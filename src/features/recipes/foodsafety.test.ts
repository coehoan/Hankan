import { afterEach, expect, it, vi } from 'vitest';
import { createFoodSafetyCatalog, foodSafetyRecipe, FOODSAFETY_PROVIDER } from './foodsafety';

const raw = {
  RCP_SEQ: '28',
  RCP_NM: '새우 두부 계란찜',
  RCP_PARTS_DTLS:
    '새우두부계란찜\n연두부 75g(3/4모), 칵테일새우 20g(5마리), 달걀 30g(1/2개)\n고명\n시금치 10g(3줄기)',
  MANUAL01: '1. 재료를 준비한다.',
  MANUAL02: '',
  MANUAL03: '3. 충분히 익힌다.',
};
const page = (rows: unknown[], total = rows.length) =>
  Response.json({
    COOKRCP01: { total_count: String(total), RESULT: { CODE: 'INFO-000' }, row: rows },
  });
afterEach(() => vi.restoreAllMocks());

it('preserves_source_text_and_steps_without_invented_time_or_servings', () => {
  expect(foodSafetyRecipe(raw)).toMatchObject({
    id: 'foodsafety:28',
    name: raw.RCP_NM,
    ingredientsText: raw.RCP_PARTS_DTLS,
    ingredients: [
      { name: '연두부', amountText: '75g(3/4모)' },
      { name: '칵테일새우', amountText: '20g(5마리)' },
      { name: '달걀', amountText: '30g(1/2개)' },
      { name: '시금치', amountText: '10g(3줄기)' },
    ],
    steps: [raw.MANUAL01, raw.MANUAL03],
    prepMinutes: null,
    servings: null,
    origin: { kind: 'catalog', provider: FOODSAFETY_PROVIDER, recordId: '28' },
  });
});
it('handles_group_labels_parenthesized_amounts_and_commas_inside_parentheses', () => {
  const recipe = foodSafetyRecipe({
    ...raw,
    RCP_PARTS_DTLS:
      '주재료 > 소고기(등심) 70g, 감자(100g), 소금, 다진 마늘(10g)\n- 소스 : 간장 20g(1큰술, 저염), 물 약간',
  });
  expect(recipe?.ingredients).toEqual([
    { name: '소고기(등심)', amountText: '70g' },
    { name: '감자', amountText: '(100g)' },
    { name: '소금', amountText: '원문 참고' },
    { name: '다진 마늘', amountText: '(10g)' },
    { name: '간장', amountText: '20g(1큰술, 저염)' },
    { name: '물', amountText: '약간' },
  ]);
});
it('handles_real_html_labels_fractional_quantities_and_embedded_sauce_sections', () => {
  const recipe = foodSafetyRecipe({
    ...raw,
    RCP_PARTS_DTLS:
      '[ 2인분 ] [주재료] 닭(1마리), 소고기(불고기용, 60g), 미나리(½줌), 후추(약간)<br />양념 소금(1g) [소스소개] 소스:간장 3g, 마늘 2g',
  });
  expect(recipe?.ingredients).toEqual([
    { name: '닭', amountText: '(1마리)' },
    { name: '소고기(불고기용)', amountText: '60g' },
    { name: '미나리', amountText: '(½줌)' },
    { name: '후추', amountText: '(약간)' },
    { name: '소금', amountText: '(1g)' },
    { name: '간장', amountText: '3g' },
    { name: '마늘', amountText: '2g' },
  ]);
});
it.each([
  '얼갈이 배추 60g, 홍고추 0.6g [소스소개저나트륨 무침양념:두부 30g, 된장 3.5g, 마늘 1.5g',
  '바지락(모시조개( 200g(30개), 양파 15g(2*4cm), 마늘 10g(2쪽), 후추 약간',
  '꼬막 40g, 떡볶이떡 40g 고추장 8g, 마늘 2g',
  '물 120g 간장 2g, 두부 30g',
  '두부 30g, ' + '확인불가재료'.repeat(30) + ' 10g',
])('excludes_ambiguous_records_instead_of_silently_omitting_ingredients: %s', (text) => {
  expect(foodSafetyRecipe({ ...raw, RCP_PARTS_DTLS: text })).toBeNull();
});
it.each([
  { ...raw, RCP_PARTS_DTLS: '' },
  { ...raw, MANUAL01: '', MANUAL03: '' },
  { ...raw, RCP_SEQ: '../secret' },
])('excludes_incomplete_or_invalid_records', (value) => {
  expect(foodSafetyRecipe(value)).toBeNull();
});
it('paginates_deduplicates_and_caches_concurrent_requests_for_24_hours', async () => {
  let now = 0;
  const firstPage = Array.from({ length: 1000 }, () => raw);
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(page(firstPage, 1001))
    .mockResolvedValueOnce(page([{ ...raw, RCP_SEQ: '29' }], 1001))
    .mockResolvedValueOnce(page([raw]));
  const catalog = createFoodSafetyCatalog({ apiKey: 'test-only-key', fetchImpl, now: () => now });
  const [first, concurrent] = await Promise.all([catalog(), catalog()]);
  expect(first).toHaveLength(2);
  expect(concurrent).toEqual(first);
  expect(fetchImpl.mock.calls.map((call) => String(call[0]))).toEqual([
    'https://openapi.foodsafetykorea.go.kr/api/test-only-key/COOKRCP01/json/1/1000',
    'https://openapi.foodsafetykorea.go.kr/api/test-only-key/COOKRCP01/json/1001/2000',
  ]);
  await catalog();
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  now = 86_400_001;
  expect(await catalog()).toHaveLength(1);
  expect(fetchImpl).toHaveBeenCalledTimes(3);
});
it('does_not_cache_a_partial_catalog_and_allows_retry_without_leaking_key', async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(
      page(
        Array.from({ length: 1000 }, () => raw),
        1001,
      ),
    )
    .mockRejectedValueOnce(new Error('https://example.invalid/test-only-key'))
    .mockResolvedValueOnce(page([raw]));
  const catalog = createFoodSafetyCatalog({ apiKey: 'test-only-key', fetchImpl });
  await expect(catalog()).rejects.toMatchObject({ code: 'provider_failed' });
  expect(await catalog()).toHaveLength(1);
  expect(fetchImpl).toHaveBeenCalledTimes(3);
});
it.each([
  () => Response.json({ RESULT: { CODE: 'ERROR-300', MSG: 'test-only-key' } }),
  () => new Response('<html>unavailable</html>', { status: 503 }),
  () => page([]),
  () => page([raw], 10001),
  () =>
    Response.json({ COOKRCP01: { total_count: '2', RESULT: { CODE: 'INFO-000' }, row: 'bad' } }),
])('fails_safely_for_api_errors_or_empty_catalog', async (response) => {
  const catalog = createFoodSafetyCatalog({
    apiKey: 'test-only-key',
    fetchImpl: vi.fn().mockResolvedValue(response()),
  });
  try {
    await catalog();
    expect.fail('Expected catalog failure');
  } catch (error) {
    expect(error).toMatchObject({ code: 'provider_failed' });
    expect(String(error)).not.toContain('test-only-key');
  }
});
it('requires_server_key_before_any_fetch', async () => {
  const fetchImpl = vi.fn();
  await expect(createFoodSafetyCatalog({ apiKey: '', fetchImpl })()).rejects.toMatchObject({
    code: 'provider_unconfigured',
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});
