// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { IngredientArt } from './ingredient-art';

afterEach(cleanup);

describe('ingredient illustrations', () => {
  it.each([
    ['깻잎', 'perilla'],
    ['돼지고기 앞다리살', 'pork'],
    ['참치액', 'tuna-sauce'],
    ['양파', 'onion'],
    ['다진 마늘', 'garlic'],
    ['감자', 'potato'],
    ['당근', 'carrot'],
    ['배추김치', 'kimchi'],
    ['다진 대파', 'leek'],
    ['달걀', 'egg'],
    ['파프리카', 'bell-pepper'],
    ['알배기배추', 'napa-cabbage'],
    ['감자전분', 'starch'],
    ['멸치액젓', 'fish-sauce'],
    ['김치만두', 'dumpling'],
    ['이름을 모르는 재료', 'jar'],
  ])('%s uses the appropriate illustration', (name, asset) => {
    const { container } = render(<IngredientArt name={name} />);
    expect(container.querySelector('img')).toHaveAttribute('src', `/illustrations/${asset}.svg`);
  });
});
