import Image from 'next/image';
import { resolveIngredientArt } from './ingredient-art-catalog';

export function IngredientArt({ name }: { name: string }) {
  const asset = resolveIngredientArt(name);
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
