import Image from 'next/image';
const categories: [RegExp, string][] = [
  [/두부/, 'tofu'],
  [/버섯/, 'mushroom'],
  [/시금치|상추|양배추|청경채/, 'spinach'],
  [/계란|달걀|알/, 'egg'],
  [/대파|쪽파|부추|파/, 'leek'],
  [/밥|쌀|만두|떡/, 'rice'],
];
export function IngredientArt({ name }: { name: string }) {
  const asset = categories.find(([pattern]) => pattern.test(name))?.[1] ?? 'jar';
  return (
    <Image
      className="ingredient-art"
      src={'/illustrations/' + asset + '.svg'}
      width={64}
      height={64}
      alt=""
      unoptimized
    />
  );
}
