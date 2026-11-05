type IllustrationGroup = {
  group: string;
  entries: readonly (readonly [asset: string, label: string, ...aliases: string[]])[];
};

const groups: readonly IllustrationGroup[] = [
  {
    group: '채소·버섯',
    entries: [
      ['onion', '양파', '적양파', '양파가루'],
      ['garlic', '마늘', '깐마늘', '다진마늘', '마늘가루'],
      ['potato', '감자'],
      ['carrot', '당근'],
      ['leek', '대파', '쪽파', '실파', '파'],
      ['chives', '부추', '영양부추'],
      ['perilla', '깻잎'],
      ['spinach', '시금치'],
      ['mushroom', '버섯', '양송이', '팽이', '새송이', '표고', '느타리', '목이'],
      ['cabbage', '양배추', '적채', '적양배추'],
      ['napa-cabbage', '배추', '알배추', '알배기배추', '얼갈이'],
      ['lettuce', '상추', '양상추', '로메인', '쌈채소', '치커리'],
      ['bok-choy', '청경채'],
      ['bean-sprout', '콩나물', '숙주', '숙주나물'],
      ['cucumber', '오이', '백오이', '취청오이'],
      ['zucchini', '애호박', '쥬키니', '주키니', '쥬키니호박', '주키니호박'],
      ['pumpkin', '단호박', '늙은호박', '호박'],
      ['eggplant', '가지'],
      ['radish', '무', '무우', '열무', '알타리무', '총각무', '단무지', '무말랭이'],
      ['sweet-potato', '고구마', '밤고구마', '호박고구마'],
      ['broccoli', '브로콜리', '브로컬리', '콜리플라워'],
      ['bell-pepper', '파프리카', '피망'],
      ['chili', '고추', '청양고추', '풋고추', '홍고추', '꽈리고추'],
      ['ginger', '생강'],
      ['lotus-root', '연근'],
      ['burdock', '우엉'],
      ['bracken', '고사리', '고구마줄기', '고구마순'],
      ['corn', '옥수수', '스위트콘', '콘옥수수'],
      ['minari', '미나리', '돌미나리'],
    ],
  },
  {
    group: '과일',
    entries: [
      ['apple', '사과'],
      ['pear', '배', '신고배'],
      ['mandarin', '귤', '감귤', '한라봉', '천혜향', '레드향'],
      ['orange', '오렌지'],
      ['banana', '바나나'],
      ['grapes', '포도', '샤인머스캣', '거봉'],
      ['strawberry', '딸기'],
      ['blueberry', '블루베리'],
      ['watermelon', '수박'],
      ['melon', '참외', '멜론', '메론'],
      ['peach', '복숭아', '천도복숭아'],
      ['persimmon', '감', '단감', '홍시', '곶감', '대봉감', '감말랭이'],
      ['kiwi', '키위', '참다래'],
      ['lemon', '레몬', '라임'],
      ['tomato', '토마토', '방울토마토'],
      ['avocado', '아보카도'],
      ['pineapple', '파인애플'],
      ['mango', '망고'],
      ['cherry', '체리'],
    ],
  },
  {
    group: '육류·달걀·가공 재료',
    entries: [
      ['pork', '돼지고기', '돼지', '돈육', '삼겹살', '목살', '앞다리살', '뒷다리살', '항정살'],
      ['beef', '소고기', '쇠고기', '한우', '우육', '차돌박이', '우삼겹', '소갈비'],
      ['chicken', '닭고기', '닭', '닭가슴살', '닭다리살', '닭안심'],
      ['duck', '오리고기', '오리', '훈제오리'],
      ['egg', '계란', '달걀', '메추리알'],
      ['ham', '햄', '스팸', '베이컨'],
      ['sausage', '소시지', '소세지', '비엔나', '프랑크'],
      ['fishcake', '어묵', '오뎅', '맛살', '크래미'],
      [
        'dumpling',
        '만두',
        '왕만두',
        '교자',
        '고기만두',
        '김치만두',
        '새우만두',
        '돼지고기만두',
        '소고기만두',
        '닭고기만두',
      ],
      ['cutlet', '돈가스', '돈까스', '치킨가스', '치킨까스', '생선가스', '생선까스'],
      ['canned-tuna', '참치캔', '참치통조림', '참치', '고추참치', '야채참치', '기름참치'],
      [
        'kimchi',
        '김치',
        '배추김치',
        '깍두기',
        '총각김치',
        '열무김치',
        '파김치',
        '갓김치',
        '겉절이',
        '배추겉절이',
      ],
      ['tofu', '두부', '순두부', '연두부', '유부', '콩비지'],
    ],
  },
  {
    group: '생선·해산물·해조류',
    entries: [
      [
        'fish',
        '생선',
        '고등어',
        '갈치',
        '삼치',
        '조기',
        '꽁치',
        '가자미',
        '임연수',
        '광어',
        '우럭',
        '도미',
        '참치회',
        '생참치',
      ],
      ['salmon', '연어'],
      ['shrimp', '새우', '칵테일새우'],
      ['squid', '오징어', '한치', '진미채'],
      ['octopus', '문어', '낙지', '주꾸미', '쭈꾸미', '갑오징어'],
      ['clam', '조개', '바지락', '모시조개', '가리비', '꼬막', '전복', '굴', '생굴'],
      ['mussel', '홍합'],
      ['crab', '게', '꽃게', '대게', '킹크랩', '랍스터'],
      ['anchovy', '멸치', '국물멸치', '잔멸치', '중멸치'],
      ['pollock', '명태', '동태', '생태', '황태', '북어', '코다리', '황태채', '북어채', '먹태'],
      ['laver', '김', '조미김', '김가루', '김밥김', '돌김', '재래김', '김조미'],
      ['seaweed', '미역', '마른미역', '물미역', '미역줄기', '톳', '매생이', '파래'],
      ['kelp', '다시마'],
    ],
  },
  {
    group: '유제품·곡물·면',
    entries: [
      ['milk', '우유', '두유', '생크림', '휘핑크림', '연유'],
      ['yogurt', '요구르트', '요거트', '그릭요거트', '요플레'],
      ['cheese', '치즈', '모짜렐라', '모차렐라', '파마산', '체다'],
      ['butter', '버터', '마가린'],
      ['rice', '쌀', '밥', '멥쌀', '찹쌀', '현미', '흑미', '백미', '볶음밥', '즉석밥'],
      ['bread', '빵', '식빵', '바게트', '베이글', '빵가루', '또띠아'],
      [
        'noodles',
        '국수',
        '소면',
        '중면',
        '칼국수',
        '우동',
        '당면',
        '스파게티',
        '파스타',
        '쌀국수',
        '메밀면',
        '냉면',
        '쫄면',
      ],
      ['ramen', '라면', '라멘'],
      ['ricecake', '떡', '떡볶이떡', '떡국떡', '가래떡', '조랭이떡'],
      ['flour', '밀가루', '쌀가루', '찹쌀가루', '부침가루', '튀김가루', '통밀가루'],
      ['starch', '전분', '감자전분', '고구마전분', '옥수수전분', '녹말'],
      [
        'beans',
        '콩',
        '검은콩',
        '서리태',
        '대두',
        '강낭콩',
        '완두콩',
        '병아리콩',
        '팥',
        '보리',
        '귀리',
        '잡곡',
        '렌틸콩',
        '녹두',
      ],
    ],
  },
  {
    group: '양념·소스',
    entries: [
      ['tuna-sauce', '참치액', '참치액젓'],
      ['soy-sauce', '간장', '진간장', '국간장', '양조간장', '쯔유', '맛간장'],
      ['sesame-oil', '참기름', '들기름'],
      [
        'cooking-oil',
        '식용유',
        '콩기름',
        '올리브유',
        '올리브오일',
        '카놀라유',
        '포도씨유',
        '옥수수유',
        '옥수수기름',
        '해바라기유',
        '고추기름',
      ],
      ['gochujang', '고추장', '청양고추장'],
      ['doenjang', '된장', '청국장', '미소된장'],
      ['ssamjang', '쌈장'],
      ['chili-powder', '고춧가루', '고추가루', '청양고춧가루', '청양고추가루'],
      ['salt', '소금', '천일염', '맛소금', '꽃소금', '구운소금'],
      ['sugar', '설탕', '흑설탕', '황설탕'],
      ['pepper', '후추', '통후추', '후춧가루'],
      ['sesame', '깨', '참깨', '통깨', '흰깨', '들깨', '깨소금', '깨가루', '들깨가루', '흑임자'],
      ['vinegar', '식초', '사과식초', '발사믹', '현미식초'],
      ['syrup', '물엿', '올리고당', '조청', '요리당', '알룰로스'],
      ['cooking-wine', '맛술', '미림', '청주', '요리술'],
      ['fish-sauce', '액젓', '멸치액젓', '까나리액젓', '새우젓', '피시소스'],
      ['oyster-sauce', '굴소스'],
      ['ketchup', '케첩', '케찹', '토마토소스'],
      ['mayonnaise', '마요네즈', '마요'],
      ['honey', '꿀', '벌꿀'],
      [
        'stock',
        '육수',
        '분말조미료',
        '다시다',
        '멸치다시다',
        '소고기다시다',
        '치킨스톡',
        '코인육수',
        '미원',
        '조미료',
      ],
    ],
  },
];

export const ingredientIllustrations = groups.flatMap(({ group, entries }) =>
  entries.map(([asset, label, ...aliases]) => ({
    asset,
    label,
    group,
    aliases: [label, ...aliases],
  })),
);

const normalize = (name: string) => name.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
const aliases = ingredientIllustrations.flatMap(({ asset, aliases: names }) =>
  names.map((name) => ({ name: normalize(name), asset })),
);

export function resolveIngredientArt(name: string): string {
  const normalized = normalize(name);
  const exact = aliases.find((alias) => alias.name === normalized);
  if (exact) return exact.asset;

  // A longer ingredient name wins: 감자전분, 김치만두, 멸치액젓, 참치액.
  let best = { name: '', asset: 'jar' };
  for (const alias of aliases) {
    if (
      alias.name.length > 1 &&
      alias.name.length > best.name.length &&
      normalized.includes(alias.name)
    ) {
      best = alias;
    }
  }
  if (best.name) return best.asset;

  // Single-character names must stand alone after ordinary handling/packaging words.
  // Matching 파/알/감/배/김 inside another word confuses unrelated ingredients.
  const plain = normalized
    .replace(/[()[\]{}]/g, '')
    .replace(
      /^(?:(?:국내산|국산|수입산|유기농|친환경|제주산|제주|손질|세척|냉동|냉장|다진|볶은|말린|건조|깐|생|썬))+/,
      '',
    )
    .replace(/\d+(?:\.\d+)?(?:kg|g|ml|l|개|봉|팩|통|단|모|마리|쪽|장|병|캔)(?:입)?$/, '');
  return aliases.find((alias) => alias.name.length === 1 && alias.name === plain)?.asset ?? 'jar';
}
