export const OSAKA_KYOTO_COUPLE_PRESET = {
  id: 'osaka-kyoto-couple-3n4d',
  title: '오사카·교토 부부 3박4일',
  subtitle: '아침·점심·저녁, 하루 카페 1곳, 간식 1곳, 핵심 관광지만 묶은 현실형 여행 프리셋',
  country: 'japan',
  destinationSearch: '오사카 교토',
  destinationRegions: ['오사카', '교토'],
  preferredSourceRefs: [
    'OSAKA-002',
    'OSAKA-006',
    'OSAKA-003',
    'OSAKA-001',
    'OSAKA-010',
    'OSAKA-004',
    'KYOTO-002',
    'KYOTO-003',
    'KYOTO-001',
    'KYOTO-009',
    'KYOTO-005',
    'KYOTO-004'
  ],
  destinationKeywords: [
    '오사카성',
    '구로몬시장',
    '신사이바시스지',
    '도톤보리',
    '기타하마',
    '우메다 스카이빌딩',
    '후시미이나리',
    '니시키시장',
    '기요미즈데라',
    '니넨자카',
    '기온',
    '아라시야마'
  ],
  days: 4,
  travelers: '커플',
  travelerCount: 2,
  transportType: '대중교통',
  pace: '여유',
  budget: '보통',
  mealPreference: '지역 맛집',
  restPreference: '카페 1곳과 이동 완충',
  dayStartTime: '08:30',
  dayEndTime: '20:30',
  interests: ['맛집', '역사', '카페', '커플', '사진'],
  mustVisit: '아내와 함께 가는 3박4일 오사카·교토 여행. 아침·점심·저녁을 기준으로 하고, 하루 카페 1곳과 간식 1곳만 넣기. 도톤보리 야경, 오사카성, 기요미즈데라, 후시미이나리, 아라시야마는 포함하기.',
  avoid: '하루에 사찰을 너무 많이 몰아넣기, 카페를 여러 곳 넣기, 2시간 이상 긴 도보, 웨이팅만 긴 식당, 밤 늦은 장거리 이동은 피하기.',
  notes: [
    'LocalTrip preset: osaka-kyoto-couple-3n4d',
    '숙소는 1~2박 난바/신사이바시, 3박 교토역 또는 가와라마치 기준으로 잡으면 이동이 단순합니다.',
    '오사카에서 교토 이동일은 짐 보관 또는 호텔 이동 시간을 60~90분 확보합니다.',
    '교토 인기 장소는 오전 일찍 시작하고, 오후에는 간식, 카페, 짧은 산책으로 속도를 낮춥니다.'
  ].join('\n'),
  dayRoutes: [
    {
      day: 1,
      theme: '오사카 도착 · 난바 먹거리 · 도톤보리 야경',
      startPlace: '간사이국제공항',
      startAddress: '大阪府泉佐野市泉州空港北1',
      endPlace: '난바 숙소',
      endAddress: '大阪府大阪市中央区難波',
      focus: ['구로몬시장', '신사이바시스지', '도톤보리']
    },
    {
      day: 2,
      theme: '오사카성 · 기타하마 카페 · 우메다 야경',
      startPlace: '난바 숙소',
      startAddress: '大阪府大阪市中央区難波',
      endPlace: '난바 숙소',
      endAddress: '大阪府大阪市中央区難波',
      focus: ['오사카성 공원', '나카노시마·기타하마', '우메다 스카이빌딩']
    },
    {
      day: 3,
      theme: '교토 이동 · 후시미이나리 · 기요미즈·기온',
      startPlace: '난바 숙소',
      startAddress: '大阪府大阪市中央区難波',
      endPlace: '교토 숙소',
      endAddress: '京都府京都市下京区',
      focus: ['후시미이나리 타이샤', '니시키시장', '기요미즈데라', '기온']
    },
    {
      day: 4,
      theme: '아라시야마 산책 · 교토역 마무리',
      startPlace: '교토 숙소',
      startAddress: '京都府京都市下京区',
      endPlace: '간사이국제공항 또는 교토역',
      endAddress: '京都府京都市下京区東塩小路町',
      focus: ['아라시야마 대나무숲', '도게츠교', '교토역 빌딩']
    }
  ],
  highlights: [
    { label: '식사', value: '아침·점심·저녁 고정' },
    { label: '휴식', value: '카페 1곳 + 간식 1곳' },
    { label: '동선', value: '오사카 2일 + 교토 2일' }
  ],
  checklist: [
    '난바/신사이바시 숙소와 교토 숙소 위치 확정',
    '간사이공항 왕복 이동과 오사카-교토 이동권 확인',
    '기요미즈데라, 후시미이나리, 아라시야마는 오전 혼잡 전 방문',
    '도톤보리와 우메다는 야경 시간에 맞춰 배치',
    '식당/카페는 영업시간과 휴무일을 출발 전 다시 확인'
  ],
  sourceLinks: [
    {
      label: 'Osaka Info · Dotonbori',
      url: 'https://osaka-info.jp/en/spot/dotonbori/'
    },
    {
      label: 'JNTO · Osaka Castle',
      url: 'https://www.japan.travel/en/spot/1087/'
    },
    {
      label: 'Osaka Info · Entertainment',
      url: 'https://osaka-info.jp/en/osaka/basic/entertainment/'
    },
    {
      label: 'Kyoto Travel · Fushimi',
      url: 'https://kyoto.travel/en/areas/fushimi/'
    },
    {
      label: 'Kyoto Travel · Gion & Kiyomizu',
      url: 'https://kyoto.travel/en/areas/gion-kiyomizu/'
    },
    {
      label: 'Kyoto Travel · Saga & Arashiyama',
      url: 'https://www.kyoto.travel/en/areas/saga-arashiyama/'
    },
    {
      label: 'The KANSAI Guide · Nishiki Market',
      url: 'https://www.the-kansai-guide.com/en/directory/item/11673/'
    }
  ]
};
