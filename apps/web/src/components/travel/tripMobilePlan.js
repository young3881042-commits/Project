export const TRIP_MOBILE_CATEGORIES = ['관광', '이동', '식사', '쇼핑', '휴식'];

const TICKET_LINKS = [
  {
    name: '간쿠치카토쿠 Ticket',
    type: '공항+Osaka Metro 환승권',
    price: '¥1,020',
    url: 'https://www.nankai.co.jp/en_railway/ticket/',
    note: '간사이공항에서 오사카 메트로 역까지 이동할 때 확인. Nankai 공식 티켓 페이지에서 최신 판매 여부를 확인하세요.'
  },
  {
    name: 'Osaka Metro Enjoy Eco Card',
    type: '오사카 메트로/시티버스 1일권',
    price: '평일 ¥820 / 토·일·공휴일 ¥620',
    url: 'https://subway.osakametro.co.jp/en/guide/page/enjoy-eco.php',
    note: '06.27은 토요일이라 성인 ¥620 기준. Yumeshima 등 제외 구간은 공식 안내 확인.'
  },
  {
    name: 'ICOCA',
    type: '교통 IC 카드',
    price: '충전식',
    url: 'https://www.jr-odekake.net/icoca/',
    note: '교토, USJ, 사철/버스 혼합 이동일에 추천.'
  },
  {
    name: 'Kyoto-Osaka Sightseeing Pass',
    type: '비교용 패스',
    price: '공식 페이지 확인',
    url: 'https://www.keihan.co.jp/travel/en/trains/passes-for-visitors-to-japan/',
    note: '이번 동선은 한큐, 란덴, 교토 시내버스가 섞여 커버가 애매해 비추천.'
  },
  {
    name: 'Hankyu Tourist Pass',
    type: '비교용 패스',
    price: '공식 페이지 확인',
    url: 'https://www.hankyu.co.jp/en/',
    note: '아라시야마·가와라마치 이동에는 일부 맞지만 교토 시내 이동 전체를 커버하지 못해 비추천.'
  },
  {
    name: 'JR Kansai Area Pass',
    type: '비교용 JR 패스',
    price: '1일권 ¥2,800부터',
    url: 'https://www.westjr.co.jp/global/en/ticket/pass/kansai/',
    note: 'HARUKA/JR 중심이면 검토. 이번 동선은 난카이, 한큐, 란덴, 메트로 비중이 커 비추천.'
  },
  {
    name: 'USJ Studio Pass',
    type: '테마파크 입장권',
    price: '날짜별 변동',
    url: 'https://www.usj.co.jp/web/en/us/tickets/studio-pass',
    note: '06.29 방문 전 공식 운영시간, 입장권, 익스프레스 패스 재고를 확인하세요.'
  }
];

const EMPTY_COST = {
  passName: '',
  passCost: '',
  includedByPass: [],
  icOrCashExtra: '',
  transportTotal: '',
  ticket: '',
  food: '',
  shopping: '',
  memo: ''
};

function cost(overrides = {}) {
  return {
    ...EMPTY_COST,
    ...overrides,
    includedByPass: Array.isArray(overrides.includedByPass) ? overrides.includedByPass : []
  };
}

function routeStep(line, direction, board, alight, transfer = '', walkText = '') {
  return { line, direction, board, alight, transfer, walkText };
}

function transport(from, to, durationMinutes, route) {
  return { from, to, durationMinutes, route };
}

function item({
  id,
  category,
  startTime,
  endTime,
  durationText,
  title,
  description,
  location,
  transport: transportInfo = null,
  meal = null,
  cost: costInfo = cost(),
  tips = []
}) {
  return {
    id,
    category,
    startTime,
    endTime,
    durationText,
    title,
    description,
    location,
    transport: transportInfo,
    meal,
    cost: costInfo,
    tips
  };
}

const osakaMetroIncludedCost = cost({
  passName: 'Osaka Metro 1일권',
  passCost: '¥620',
  includedByPass: ['Osaka Metro'],
  icOrCashExtra: '¥0',
  transportTotal: '¥0 추가',
  memo: '패스 포함 구간'
});

const kankuChikatokuCost = cost({
  passName: '간쿠치카토쿠 Ticket',
  passCost: '¥1,020',
  includedByPass: ['Nankai 공항선', 'Osaka Metro'],
  icOrCashExtra: '¥0',
  transportTotal: '¥0 추가',
  memo: '간사이공항-오사카 메트로 역 이동을 한 장으로 처리'
});

const icTransportCost = (amount, memo = 'ICOCA 권장') => cost({
  passName: 'ICOCA',
  passCost: '충전식',
  includedByPass: [],
  icOrCashExtra: amount,
  transportTotal: amount,
  memo
});

export const OSAKA_KYOTO_USJ_MOBILE_PLAN = {
  trip: {
    title: '오사카·교토·USJ 3박 4일',
    startDate: '2026-06-27',
    endDate: '2026-06-30',
    hotel: '아크호텔 오사카 신사이바시',
    people: '2명',
    summary: '간사이공항 입국 후 오사카 도심 야경, 교토 핵심 동선, USJ 하루, 간사이공항 출국까지 모바일에서 바로 확인하는 카드형 일정입니다. 후시미이나리는 밤 이동 부담과 체감 안전 문제로 제외했습니다.'
  },
  daySummaries: [
    {
      day: 1,
      date: '2026-06-27',
      title: '공항 도착과 오사카 야경',
      route: '간사이공항 -> 호텔 짐 맡기기 -> 오사카성 -> 하루카스300 -> 신세카이/츠텐카쿠 -> 도톤보리/호젠지요코초',
      theme: '입국일, 오사카 대표 야경, 지하철 1일권 활용',
      estimatedCost: '1인 약 ¥9,000~¥13,000 + 쇼핑',
      passSummary: '간쿠치카토쿠 ¥1,020 + Osaka Metro Enjoy Eco Card 토요일 ¥620'
    },
    {
      day: 2,
      date: '2026-06-28',
      title: '교토 풀코스',
      route: '호텔 -> 아라시야마 -> 금각사 -> 청수사 -> 산넨자카/니넨자카 -> 야사카신사 -> 하나미코지/기온 -> 오사카',
      theme: '서쪽 아라시야마에서 동쪽 기온까지, 후시미이나리 제외',
      estimatedCost: '1인 약 ¥11,000~¥16,000 + 쇼핑',
      passSummary: '교토는 IC카드 추천'
    },
    {
      day: 3,
      date: '2026-06-29',
      title: 'USJ 하루종일',
      route: '호텔 -> 유니버설시티 -> USJ -> 시티워크 저녁 -> 신사이바시/도톤보리',
      theme: '입장권 별도, 동선 단순화, 밤 쇼핑',
      estimatedCost: '1인 약 ¥20,000~¥32,000 + 쇼핑',
      passSummary: 'USJ는 IC카드 추천'
    },
    {
      day: 4,
      date: '2026-06-30',
      title: '공항 출국',
      route: '호텔 체크아웃 -> 간단식 -> 나가호리바시 -> 덴가차야 -> 간사이공항',
      theme: '출국일, 변수를 줄이는 공항 직행',
      estimatedCost: '1인 약 ¥3,000~¥5,000',
      passSummary: '간쿠치카토쿠 Ticket ¥1,020'
    }
  ],
  days: [
    {
      day: 1,
      date: '2026-06-27',
      title: '공항 도착과 오사카 야경',
      items: [
        item({
          id: 'd1-arrival',
          category: '휴식',
          startTime: '10:30',
          endTime: '11:15',
          durationText: '45분',
          title: '간사이공항 도착·입국 정리',
          description: '수하물 수령, 화장실, 교통권 구매까지 한 번에 처리합니다.',
          location: '간사이국제공항 제1터미널',
          tips: ['Nankai 매표소 위치를 먼저 확인', 'IC카드가 없다면 ICOCA 충전도 같이 처리']
        }),
        item({
          id: 'd1-kix-hotel',
          category: '이동',
          startTime: '11:15',
          endTime: '12:25',
          durationText: '70분',
          title: '간사이공항역에서 호텔까지 이동',
          description: '공항에서 나가호리바시역까지 환승 1회로 이동 후 호텔까지 걷습니다.',
          location: '간사이공항역 -> 아크호텔 오사카 신사이바시',
          transport: transport('간사이공항역', '아크호텔 오사카 신사이바시', 70, [
            routeStep('Nankai 공항선 Airport Express', '난바 방면', '간사이공항역', '덴가차야역', 'Osaka Metro 사카이스지선 환승', ''),
            routeStep('Osaka Metro 사카이스지선', '텐진바시스지6초메 방면', '덴가차야역', '나가호리바시역', '', '2-A 출구 기준 호텔까지 도보 약 5~7분')
          ]),
          cost: kankuChikatokuCost,
          tips: ['라피트 특급권은 별도라 이 일정에서는 일반 Airport Express 기준']
        }),
        item({
          id: 'd1-luggage',
          category: '휴식',
          startTime: '12:25',
          endTime: '12:45',
          durationText: '20분',
          title: '숙소 프런트 짐 맡기기',
          description: '체크인 전 캐리어를 맡기고 가벼운 차림으로 오사카 도심을 이동합니다.',
          location: '아크호텔 오사카 신사이바시',
          tips: ['여권과 지갑, 보조배터리만 작은 가방에 분리']
        }),
        item({
          id: 'd1-lunch',
          category: '식사',
          startTime: '12:55',
          endTime: '13:45',
          durationText: '50분',
          title: '이치란 도톤보리점 점심',
          description: '첫 식사는 주문이 쉬운 라멘으로 빠르게 해결합니다.',
          location: '도톤보리',
          meal: {
            type: '점심',
            restaurant: '이치란 도톤보리점',
            recommendedMenu: '돈코츠 라멘, 반숙달걀',
            expectedCost: '¥1,300~¥1,800',
            note: '한국인 여행객에게 익숙하고 회전이 빠른 편입니다.'
          },
          cost: cost({ food: '¥1,300~¥1,800', memo: '식비 별도' }),
          tips: ['웨이팅이 길면 킨류라멘 또는 도톤보리 이마이로 변경']
        }),
        item({
          id: 'd1-hotel-osakacastle',
          category: '이동',
          startTime: '13:45',
          endTime: '14:20',
          durationText: '35분',
          title: '호텔 권역에서 오사카성으로 이동',
          description: '나가호리바시에서 모리노미야까지 메트로로 이동합니다.',
          location: '나가호리바시역 -> 오사카성 공원',
          transport: transport('나가호리바시역', '오사카성 공원', 35, [
            routeStep('Osaka Metro 나가호리쓰루미료쿠치선', '카도마미나미 방면', '나가호리바시역', '모리노미야역', '', '3-B 출구 기준 오사카성 공원까지 도보 약 10분')
          ]),
          cost: osakaMetroIncludedCost
        }),
        item({
          id: 'd1-osakacastle',
          category: '관광',
          startTime: '14:20',
          endTime: '15:40',
          durationText: '80분',
          title: '오사카성 공원',
          description: '입국일 오후라 천수각 입장보다 공원과 성곽 산책 중심으로 봅니다.',
          location: '오사카성 공원',
          cost: cost({ ticket: '천수각 입장 시 약 ¥600', memo: '공원 산책은 무료' }),
          tips: ['더우면 천수각 내부 관람 대신 미라이자 오사카성에서 휴식']
        }),
        item({
          id: 'd1-castle-harukas',
          category: '이동',
          startTime: '15:40',
          endTime: '16:15',
          durationText: '35분',
          title: '오사카성에서 하루카스300으로 이동',
          description: '모리노미야에서 덴노지까지 메트로 환승으로 이동합니다.',
          location: '오사카성 공원 -> 아베노 하루카스',
          transport: transport('모리노미야역', '덴노지역', 35, [
            routeStep('Osaka Metro 나가호리쓰루미료쿠치선', '타이쇼 방면', '모리노미야역', '타니마치6초메역', '타니마치선 환승', ''),
            routeStep('Osaka Metro 타니마치선', '야오미나미 방면', '타니마치6초메역', '덴노지역', '', '아베노 하루카스까지 도보 약 5분')
          ]),
          cost: osakaMetroIncludedCost
        }),
        item({
          id: 'd1-harukas',
          category: '관광',
          startTime: '16:20',
          endTime: '17:40',
          durationText: '80분',
          title: '하루카스300 전망대',
          description: '해 질 무렵 오사카 도심과 베이 방향 전망을 봅니다.',
          location: '아베노 하루카스',
          cost: cost({ ticket: '약 ¥2,000', memo: '일몰 시간대는 사전 예매 권장' }),
          tips: ['전망대 입장 전 화장실과 음료를 먼저 정리']
        }),
        item({
          id: 'd1-harukas-shinsekai',
          category: '이동',
          startTime: '17:40',
          endTime: '18:00',
          durationText: '20분',
          title: '하루카스에서 신세카이로 이동',
          description: '덴노지에서 도부쓰엔마에까지 한 정거장 이동 후 걸어갑니다.',
          location: '덴노지역 -> 신세카이',
          transport: transport('덴노지역', '신세카이·츠텐카쿠', 20, [
            routeStep('Osaka Metro 미도스지선', '나카모즈 방면', '덴노지역', '도부쓰엔마에역', '', '1번 출구 기준 츠텐카쿠까지 도보 약 7분')
          ]),
          cost: osakaMetroIncludedCost
        }),
        item({
          id: 'd1-shinsekai',
          category: '관광',
          startTime: '18:00',
          endTime: '19:00',
          durationText: '60분',
          title: '신세카이·츠텐카쿠',
          description: '레트로 간판과 츠텐카쿠 주변 야경을 먼저 둘러봅니다.',
          location: '신세카이',
          cost: cost({ ticket: '츠텐카쿠 전망대 입장 시 약 ¥1,200', memo: '거리 산책은 무료' }),
          tips: ['밤에는 큰길 위주로 이동하고 골목 깊숙한 곳은 피하기']
        }),
        item({
          id: 'd1-dinner',
          category: '식사',
          startTime: '19:00',
          endTime: '20:00',
          durationText: '60분',
          title: '쿠시카츠 다루마 신세카이 저녁',
          description: '오사카 대표 쿠시카츠로 입국일 저녁을 마무리합니다.',
          location: '신세카이',
          meal: {
            type: '저녁',
            restaurant: '쿠시카츠 다루마 신세카이 총본점',
            recommendedMenu: '쿠시카츠 세트, 도테야키',
            expectedCost: '¥2,500~¥3,500',
            note: '한국인 여행객에게 유명한 오사카 대표 체인입니다.'
          },
          cost: cost({ food: '¥2,500~¥3,500' })
        }),
        item({
          id: 'd1-shinsekai-dotonbori',
          category: '이동',
          startTime: '20:00',
          endTime: '20:20',
          durationText: '20분',
          title: '신세카이에서 도톤보리로 이동',
          description: '도부쓰엔마에에서 닛폰바시로 이동해 도톤보리 동쪽으로 들어갑니다.',
          location: '도부쓰엔마에역 -> 도톤보리',
          transport: transport('도부쓰엔마에역', '도톤보리·호젠지요코초', 20, [
            routeStep('Osaka Metro 사카이스지선', '텐진바시스지6초메 방면', '도부쓰엔마에역', '닛폰바시역', '', '도톤보리 강변까지 도보 약 8분')
          ]),
          cost: osakaMetroIncludedCost
        }),
        item({
          id: 'd1-dotonbori',
          category: '관광',
          startTime: '20:20',
          endTime: '21:30',
          durationText: '70분',
          title: '도톤보리·호젠지요코초 야경',
          description: '글리코 사인, 도톤보리 강변, 호젠지요코초를 짧은 도보로 묶습니다.',
          location: '도톤보리',
          cost: cost({ memo: '무료 산책' }),
          tips: ['글리코 사인은 에비스바시에서 촬영', '호젠지요코초는 조용히 통행']
        })
      ]
    },
    {
      day: 2,
      date: '2026-06-28',
      title: '교토 풀코스',
      items: [
        item({
          id: 'd2-breakfast',
          category: '식사',
          startTime: '06:55',
          endTime: '07:25',
          durationText: '30분',
          title: '코메다커피 신사이바시 아침',
          description: '교토 이동 전 호텔 근처에서 가볍게 시작합니다.',
          location: '신사이바시',
          meal: {
            type: '아침',
            restaurant: '코메다커피 신사이바시점',
            recommendedMenu: '모닝 토스트 세트, 커피',
            expectedCost: '¥700~¥1,100',
            note: '한국인 여행객도 많이 찾는 안정적인 아침 후보입니다.'
          },
          cost: cost({ food: '¥700~¥1,100' })
        }),
        item({
          id: 'd2-hotel-arashiyama',
          category: '이동',
          startTime: '07:35',
          endTime: '09:05',
          durationText: '90분',
          title: '호텔에서 아라시야마로 이동',
          description: '사카이스지선-한큐-아라시야마선을 이어 타는 서쪽 교토 진입 루트입니다.',
          location: '나가호리바시역 -> 한큐 아라시야마역',
          transport: transport('나가호리바시역', '한큐 아라시야마역', 90, [
            routeStep('Osaka Metro 사카이스지선', '텐진바시스지6초메·한큐 직통 방면', '나가호리바시역', '아와지역', '한큐 교토선 환승', ''),
            routeStep('한큐 교토선', '교토카와라마치 방면', '아와지역', '가쓰라역', '한큐 아라시야마선 환승', ''),
            routeStep('한큐 아라시야마선', '아라시야마 방면', '가쓰라역', '아라시야마역', '', '도게츠교까지 도보 약 8분')
          ]),
          cost: icTransportCost('약 ¥700~¥900', 'Osaka Metro/한큐 혼합이라 ICOCA 추천')
        }),
        item({
          id: 'd2-arashiyama',
          category: '관광',
          startTime: '09:05',
          endTime: '10:20',
          durationText: '75분',
          title: '아라시야마 대나무숲·도게츠교',
          description: '대나무숲을 먼저 걷고 강변 도게츠교까지 이어 봅니다.',
          location: '아라시야마',
          cost: cost({ memo: '대나무숲/도게츠교 산책 무료' }),
          tips: ['혼잡 전 사진을 먼저 찍고, 오래 머물지 않고 다음 권역으로 이동']
        }),
        item({
          id: 'd2-arashiyama-kinkakuji',
          category: '이동',
          startTime: '10:20',
          endTime: '11:15',
          durationText: '55분',
          title: '아라시야마에서 금각사로 이동',
          description: '란덴으로 기타노하쿠바이초까지 간 뒤 금각사 앞 버스로 연결합니다.',
          location: '아라시야마 -> 금각사',
          transport: transport('란덴 아라시야마역', '금각사', 55, [
            routeStep('란덴 아라시야마본선', '시조오미야 방면', '아라시야마역', '가타비라노쓰지역', '란덴 기타노선 환승', ''),
            routeStep('란덴 기타노선', '기타노하쿠바이초 방면', '가타비라노쓰지역', '기타노하쿠바이초역', '교토 시버스 환승', ''),
            routeStep('교토 시버스 204 또는 205번', '금각사 방면', '기타노하쿠바이초 정류장', '금각사미치 정류장', '', '금각사 입구까지 도보 약 5분')
          ]),
          cost: icTransportCost('약 ¥500~¥700', '란덴+교토 시버스는 IC카드 추천')
        }),
        item({
          id: 'd2-kinkakuji',
          category: '관광',
          startTime: '11:15',
          endTime: '12:05',
          durationText: '50분',
          title: '금각사',
          description: '정원 동선이 정해져 있어 50분 안팎으로 보기 좋습니다.',
          location: '교토 기타구',
          cost: cost({ ticket: '약 ¥500', memo: '현장 결제' }),
          tips: ['사진은 연못 건너편 포인트에서 짧게']
        }),
        item({
          id: 'd2-kinkakuji-lunch',
          category: '이동',
          startTime: '12:05',
          endTime: '12:55',
          durationText: '50분',
          title: '금각사에서 가와라마치 점심권으로 이동',
          description: '금각사미치에서 시조카와라마치까지 버스로 내려갑니다.',
          location: '금각사미치 -> 시조카와라마치',
          transport: transport('금각사미치 정류장', '가와라마치', 50, [
            routeStep('교토 시버스 205번', '시조카와라마치·교토역 방면', '금각사미치 정류장', '시조카와라마치 정류장', '', '가츠쿠라 산조 본점까지 도보 약 10분')
          ]),
          cost: icTransportCost('약 ¥230~¥300', '교토 시내버스 IC 결제')
        }),
        item({
          id: 'd2-lunch',
          category: '식사',
          startTime: '13:00',
          endTime: '14:00',
          durationText: '60분',
          title: '가츠쿠라 산조 본점 점심',
          description: '교토에서 한국인 여행객에게 유명한 돈카츠 식당입니다.',
          location: '산조·가와라마치',
          meal: {
            type: '점심',
            restaurant: '가츠쿠라 산조 본점',
            recommendedMenu: '로스카츠 정식, 히레카츠 정식',
            expectedCost: '¥1,800~¥2,800',
            note: '웨이팅이 길면 교토가와라마치역 주변 지점이나 니시키시장 식사로 변경합니다.'
          },
          cost: cost({ food: '¥1,800~¥2,800' })
        }),
        item({
          id: 'd2-lunch-kiyomizu',
          category: '이동',
          startTime: '14:00',
          endTime: '14:30',
          durationText: '30분',
          title: '가와라마치에서 청수사로 이동',
          description: '시조카와라마치에서 기요미즈미치로 버스 이동 후 언덕길을 걷습니다.',
          location: '시조카와라마치 -> 청수사',
          transport: transport('시조카와라마치 정류장', '청수사', 30, [
            routeStep('교토 시버스 207번', '기요미즈데라·도후쿠지 방면', '시조카와라마치 정류장', '기요미즈미치 정류장', '', '청수사 입구까지 오르막 도보 약 12~15분')
          ]),
          cost: icTransportCost('약 ¥230~¥300', '교토 시내버스 IC 결제')
        }),
        item({
          id: 'd2-kiyomizu',
          category: '관광',
          startTime: '14:30',
          endTime: '15:45',
          durationText: '75분',
          title: '청수사',
          description: '교토 대표 사찰과 전망대를 보고 히가시야마 골목으로 내려옵니다.',
          location: '기요미즈데라',
          cost: cost({ ticket: '약 ¥500', memo: '현장 결제' }),
          tips: ['오르막이 있으니 물을 미리 준비']
        }),
        item({
          id: 'd2-sannenzaka',
          category: '관광',
          startTime: '15:45',
          endTime: '16:35',
          durationText: '50분',
          title: '산넨자카·니넨자카',
          description: '청수사에서 내려오며 전통 골목, 기념품, 사진 포인트를 봅니다.',
          location: '히가시야마',
          cost: cost({ shopping: '선택', memo: '기념품 구매 별도' }),
          tips: ['계단이 많아 천천히 이동', '상점 앞 통행을 막지 않기']
        }),
        item({
          id: 'd2-cafe',
          category: '식사',
          startTime: '16:35',
          endTime: '17:10',
          durationText: '35분',
          title: '% Arabica Kyoto Higashiyama 카페',
          description: '히가시야마 동선 중 짧게 쉬어가는 커피 휴식입니다.',
          location: '히가시야마',
          meal: {
            type: '카페',
            restaurant: '% Arabica Kyoto Higashiyama',
            recommendedMenu: '교토 라테, 아메리카노',
            expectedCost: '¥600~¥900',
            note: '한국인에게도 유명한 교토 카페 후보입니다.'
          },
          cost: cost({ food: '¥600~¥900' })
        }),
        item({
          id: 'd2-yasaka',
          category: '관광',
          startTime: '17:25',
          endTime: '18:00',
          durationText: '35분',
          title: '야사카신사',
          description: '기온으로 넘어가기 전 무료로 짧게 들르기 좋은 신사입니다.',
          location: '기온',
          cost: cost({ memo: '무료 관람' }),
          tips: ['해 질 무렵 등롱 분위기가 좋음']
        }),
        item({
          id: 'd2-dinner',
          category: '식사',
          startTime: '18:05',
          endTime: '19:05',
          durationText: '60분',
          title: '기온 덕 누들 저녁',
          description: '기온권에서 동선을 크게 벗어나지 않는 인기 라멘 후보입니다.',
          location: '기온',
          meal: {
            type: '저녁',
            restaurant: 'Gion Duck Noodles',
            recommendedMenu: '오리 라멘, 츠케멘',
            expectedCost: '¥1,500~¥2,500',
            note: '웨이팅이 길면 폰토초/가와라마치 식당가로 변경합니다.'
          },
          cost: cost({ food: '¥1,500~¥2,500' })
        }),
        item({
          id: 'd2-gion-night',
          category: '관광',
          startTime: '19:10',
          endTime: '20:20',
          durationText: '70분',
          title: '하나미코지 & 기온거리 야경',
          description: '후시미이나리는 제외하고, 밝고 사람 많은 기온 중심부 야경만 봅니다.',
          location: '기온·하나미코지',
          cost: cost({ memo: '무료 산책' }),
          tips: ['사유지 촬영 금지 표지 준수', '늦은 골목 이동은 피하고 큰길 중심으로 이동']
        }),
        item({
          id: 'd2-kyoto-osaka',
          category: '이동',
          startTime: '20:20',
          endTime: '21:35',
          durationText: '75분',
          title: '교토 가와라마치에서 오사카 복귀',
          description: '한큐 교토선으로 우메다까지 이동 후 미도스지선으로 신사이바시에 복귀합니다.',
          location: '교토가와라마치역 -> 아크호텔 오사카 신사이바시',
          transport: transport('교토가와라마치역', '아크호텔 오사카 신사이바시', 75, [
            routeStep('한큐 교토선 특급', '오사카우메다 방면', '교토가와라마치역', '오사카우메다역', 'Osaka Metro 미도스지선 환승', ''),
            routeStep('Osaka Metro 미도스지선', '나카모즈 방면', '우메다역', '신사이바시역', '', '호텔까지 도보 약 10분')
          ]),
          cost: icTransportCost('약 ¥650~¥850', '한큐+Osaka Metro 혼합이라 ICOCA 추천')
        })
      ]
    },
    {
      day: 3,
      date: '2026-06-29',
      title: 'USJ 하루종일',
      items: [
        item({
          id: 'd3-breakfast',
          category: '식사',
          startTime: '07:20',
          endTime: '07:50',
          durationText: '30분',
          title: '마츠야 나가호리바시 아침',
          description: 'USJ 입장 전 빠르게 먹는 아침입니다.',
          location: '나가호리바시',
          meal: {
            type: '아침',
            restaurant: '마츠야 나가호리바시점',
            recommendedMenu: '규메시, 조식 정식',
            expectedCost: '¥500~¥900',
            note: '이른 시간 운영 매장이 많아 개장 대기 일정에 맞추기 쉽습니다.'
          },
          cost: cost({ food: '¥500~¥900' })
        }),
        item({
          id: 'd3-hotel-usj',
          category: '이동',
          startTime: '07:55',
          endTime: '08:45',
          durationText: '50분',
          title: '호텔에서 유니버설시티로 이동',
          description: '오사카 도심에서 니시쿠조를 거쳐 유니버설시티역으로 갑니다.',
          location: '나가호리바시역 -> 유니버설시티역',
          transport: transport('나가호리바시역', '유니버설시티역', 50, [
            routeStep('Osaka Metro 나가호리쓰루미료쿠치선', '타이쇼 방면', '나가호리바시역', '돔마에치요자키역', '한신 난바선 환승', '한신 도무마에역까지 도보 환승'),
            routeStep('한신 난바선', '아마가사키 방면', '도무마에역', '니시쿠조역', 'JR 유메사키선 환승', ''),
            routeStep('JR 유메사키선', '사쿠라지마 방면', '니시쿠조역', '유니버설시티역', '', 'USJ 입구까지 도보 약 5분')
          ]),
          cost: icTransportCost('약 ¥500~¥700', 'USJ 이동은 IC카드 추천')
        }),
        item({
          id: 'd3-usj-morning',
          category: '관광',
          startTime: '09:00',
          endTime: '12:20',
          durationText: '200분',
          title: '유니버설 스튜디오 재팬 오전',
          description: '입장 직후 공식 앱에서 에어리어 입장 정리권과 대기시간을 확인합니다.',
          location: 'USJ',
          cost: cost({ ticket: 'Studio Pass 날짜별 변동', memo: '입장권/익스프레스 패스는 공식 구매 권장' }),
          tips: ['슈퍼 닌텐도 월드 정리권 확인', '익스프레스 패스가 있으면 시간 지정부터 역산']
        }),
        item({
          id: 'd3-lunch',
          category: '식사',
          startTime: '12:30',
          endTime: '13:30',
          durationText: '60분',
          title: '키노피오 카페 점심',
          description: '슈퍼 닌텐도 월드 입장이 잡혔을 때 만족도가 높은 점심 후보입니다.',
          location: 'USJ 슈퍼 닌텐도 월드',
          meal: {
            type: '점심',
            restaurant: '키노피오 카페',
            recommendedMenu: '마리오 버거, 오므라이스 메뉴',
            expectedCost: '¥2,500~¥4,000',
            note: '정리권 상황에 따라 파크 내 다른 식당으로 바꿉니다.'
          },
          cost: cost({ food: '¥2,500~¥4,000' })
        }),
        item({
          id: 'd3-usj-afternoon',
          category: '관광',
          startTime: '13:45',
          endTime: '17:20',
          durationText: '215분',
          title: 'USJ 오후 어트랙션',
          description: '해리포터, 미니언, 주라기 구역을 대기시간에 맞춰 순서 조정합니다.',
          location: 'USJ',
          tips: ['대기시간 90분 이상이면 쇼/상점으로 분산', '비 오면 실내 어트랙션 우선']
        }),
        item({
          id: 'd3-cafe',
          category: '식사',
          startTime: '17:20',
          endTime: '17:55',
          durationText: '35분',
          title: '비버리힐즈 블랑제리 휴식',
          description: '오후 체력 회복을 위한 파크 내 카페 휴식입니다.',
          location: 'USJ',
          meal: {
            type: '카페',
            restaurant: '비버리힐즈 블랑제리',
            recommendedMenu: '케이크, 커피',
            expectedCost: '¥1,000~¥1,800',
            note: '앉아서 쉬기 쉬운 파크 내 카페 후보입니다.'
          },
          cost: cost({ food: '¥1,000~¥1,800' })
        }),
        item({
          id: 'd3-usj-evening',
          category: '쇼핑',
          startTime: '18:00',
          endTime: '20:00',
          durationText: '120분',
          title: 'USJ 굿즈·야간 분위기',
          description: '마지막 어트랙션과 기념품 구매를 마무리합니다.',
          location: 'USJ',
          cost: cost({ shopping: '선택', memo: '굿즈 구매 별도' }),
          tips: ['인기 굿즈는 폐장 직전 품절 가능성이 있어 중간에 먼저 확인']
        }),
        item({
          id: 'd3-dinner',
          category: '식사',
          startTime: '20:10',
          endTime: '20:55',
          durationText: '45분',
          title: '타코파 유니버설 시티워크 저녁',
          description: '퇴장 후 역 앞 시티워크에서 타코야키를 비교해 먹습니다.',
          location: '유니버설 시티워크 오사카',
          meal: {
            type: '저녁',
            restaurant: 'TAKOPA 유니버설 시티워크 오사카',
            recommendedMenu: '타코야키 비교 세트',
            expectedCost: '¥1,200~¥2,500',
            note: 'USJ 퇴장 후 이동 전 먹기 편한 한국인 인기 코스입니다.'
          },
          cost: cost({ food: '¥1,200~¥2,500' })
        }),
        item({
          id: 'd3-usj-dotonbori',
          category: '이동',
          startTime: '20:55',
          endTime: '21:45',
          durationText: '50분',
          title: '유니버설시티에서 신사이바시로 복귀',
          description: 'JR 유메사키선과 한신 난바선을 이용해 도톤보리 권역으로 돌아옵니다.',
          location: '유니버설시티역 -> 신사이바시',
          transport: transport('유니버설시티역', '신사이바시·도톤보리', 50, [
            routeStep('JR 유메사키선', '니시쿠조 방면', '유니버설시티역', '니시쿠조역', '한신 난바선 환승', ''),
            routeStep('한신 난바선', '오사카난바 방면', '니시쿠조역', '오사카난바역', '', '도톤보리까지 도보 약 10분')
          ]),
          cost: icTransportCost('약 ¥400~¥600', 'JR+한신 혼합이라 ICOCA 추천')
        }),
        item({
          id: 'd3-night-shopping',
          category: '쇼핑',
          startTime: '21:45',
          endTime: '22:30',
          durationText: '45분',
          title: '신사이바시·도톤보리 쇼핑 야경',
          description: '돈키호테, 드럭스토어, 도톤보리 야경을 짧게 정리합니다.',
          location: '신사이바시·도톤보리',
          cost: cost({ shopping: '선택', memo: '쇼핑 예산 별도' }),
          tips: ['다음 날 출국이라 액체류와 면세 봉투 정리']
        })
      ]
    },
    {
      day: 4,
      date: '2026-06-30',
      title: '공항 출국',
      items: [
        item({
          id: 'd4-checkout',
          category: '휴식',
          startTime: '07:00',
          endTime: '07:25',
          durationText: '25분',
          title: '체크아웃·짐 정리',
          description: '여권, 항공권, 면세품, 보조배터리 위치를 확인합니다.',
          location: '아크호텔 오사카 신사이바시',
          tips: ['보조배터리는 위탁 수하물 금지', '면세 봉투는 출국 전까지 개봉하지 않기']
        }),
        item({
          id: 'd4-breakfast',
          category: '식사',
          startTime: '07:25',
          endTime: '07:50',
          durationText: '25분',
          title: '조식 또는 공항 간단식',
          description: '항공편 시간에 따라 호텔 근처 조식 또는 공항 도착 후 간단식으로 조정합니다.',
          location: '호텔 근처 또는 간사이공항',
          meal: {
            type: '아침',
            restaurant: '호텔 조식 또는 간사이공항 푸드코트',
            recommendedMenu: '주먹밥, 샌드위치, 커피',
            expectedCost: '¥800~¥1,500',
            note: '공항 도착 시간을 우선하고 식사는 짧게 처리합니다.'
          },
          cost: cost({ food: '¥800~¥1,500' })
        }),
        item({
          id: 'd4-hotel-kix',
          category: '이동',
          startTime: '08:00',
          endTime: '09:25',
          durationText: '85분',
          title: '호텔에서 간사이공항으로 이동',
          description: '나가호리바시에서 덴가차야로 이동 후 Nankai 공항선으로 공항까지 갑니다.',
          location: '아크호텔 오사카 신사이바시 -> 간사이공항',
          transport: transport('나가호리바시역', '간사이공항역', 85, [
            routeStep('Osaka Metro 사카이스지선', '덴가차야 방면', '나가호리바시역', '덴가차야역', 'Nankai 공항선 환승', ''),
            routeStep('Nankai 공항선 Airport Express', '간사이공항 방면', '덴가차야역', '간사이공항역', '', '터미널까지 안내 표지 따라 이동')
          ]),
          cost: kankuChikatokuCost,
          tips: ['항공편 출발 2~3시간 전 공항 도착 기준으로 역산']
        }),
        item({
          id: 'd4-airport',
          category: '휴식',
          startTime: '09:25',
          endTime: '11:00',
          durationText: '95분',
          title: '간사이공항 체크인·출국',
          description: '체크인, 수하물 위탁, 보안검색, 출국심사를 여유 있게 처리합니다.',
          location: '간사이국제공항',
          cost: cost({ memo: '공항 내 추가 식음료/쇼핑 별도' }),
          tips: ['항공사 카운터와 터미널을 전날 재확인']
        })
      ]
    }
  ],
  budget: {
    currency: 'JPY',
    perPersonEstimate: '약 ¥43,000~¥66,000 + 쇼핑',
    transport: '패스 ¥2,660 + IC 약 ¥3,500~¥5,000',
    tickets: '하루카스300, 츠텐카쿠, 교토 사찰, USJ Studio Pass 별도',
    food: '약 ¥18,000~¥28,000',
    shopping: '개인 선택',
    memo: 'USJ 입장권과 익스프레스 패스 여부에 따라 전체 예산 변동이 큽니다.'
  },
  passRecommendation: {
    summary: '오사카 도심일은 패스, 교토/USJ는 IC카드가 가장 단순합니다.',
    byDate: [
      {
        date: '2026-06-27',
        recommendation: '간쿠치카토쿠 Ticket ¥1,020 + Osaka Metro Enjoy Eco Card 토요일 ¥620',
        reason: '공항-호텔 이동과 오사카 도심 메트로 이동이 분리되어 비용 표시가 명확합니다.'
      },
      {
        date: '2026-06-28',
        recommendation: 'ICOCA',
        reason: '한큐, 란덴, 교토 시버스, Osaka Metro가 섞여 단일 패스 커버가 애매합니다.'
      },
      {
        date: '2026-06-29',
        recommendation: 'ICOCA',
        reason: 'USJ 이동은 JR/한신/메트로 조합이라 IC카드가 가장 단순합니다.'
      },
      {
        date: '2026-06-30',
        recommendation: '간쿠치카토쿠 Ticket ¥1,020',
        reason: '호텔 권역에서 덴가차야 환승으로 공항까지 가는 출국 루트에 적합합니다.'
      }
    ],
    notRecommended: [
      {
        name: '오사카·교토패스',
        reason: '이번 동선은 한큐, 란덴, 교토 시내 이동, 게이한 등이 섞여 커버가 애매합니다.'
      },
      {
        name: 'JR Kansai Area Pass',
        reason: 'JR 중심 장거리 이동이 아니라 난카이/한큐/메트로 비중이 커 효율이 낮습니다.'
      }
    ]
  },
  ticketLinks: TICKET_LINKS
};

function addDays(dateKey, offset) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(`${dateKey || ''}`);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function cleanText(value, fallback = '') {
  const text = `${value || ''}`.trim();
  return text || fallback;
}

function parseTimeRange(itemValue) {
  const text = cleanText(itemValue);
  const match = /(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/.exec(text);
  if (!match) return { startTime: '', endTime: '' };
  return { startTime: match[1], endTime: match[2] };
}

function categoryFromLegacy(source = {}) {
  const text = [source.category, source.primaryStyle, source.title, source.tags?.join(' ')].filter(Boolean).join(' ');
  if (/이동|공항|복귀|환승|transfer/i.test(text)) return '이동';
  if (/식당|식사|아침|점심|저녁|카페|디저트|간식|라멘|커피|브런치|맛집/.test(text)) return '식사';
  if (/쇼핑|시장|기념품|드럭스토어|상점/.test(text)) return '쇼핑';
  if (/휴식|호텔|숙소|체크인|체크아웃|짐|여유/.test(text)) return '휴식';
  return '관광';
}

function durationTextFromLegacy(source = {}) {
  const minutes = Number(source.durationMinutes || source.duration_minutes);
  if (Number.isFinite(minutes) && minutes > 0) return `${minutes}분`;
  return '';
}

function legacyMeal(source = {}, category) {
  if (category !== '식사') return null;
  const title = cleanText(source.title || source.destinationName || source.destination_name, '식사 후보');
  const text = [source.description, source.note, source.recommendedMenu].filter(Boolean).join(' ');
  let type = '식사';
  if (/아침/.test(text) || /아침/.test(title)) type = '아침';
  if (/점심/.test(text) || /점심/.test(title)) type = '점심';
  if (/저녁/.test(text) || /저녁/.test(title)) type = '저녁';
  if (/카페|커피|디저트/.test(text) || /카페|커피|디저트/.test(title)) type = '카페';
  return {
    type,
    restaurant: title,
    recommendedMenu: cleanText(source.recommendedMenu || source.recommended_menu, '대표 메뉴 확인'),
    expectedCost: '',
    note: cleanText(source.description || source.note, '현장 영업시간과 대기시간 확인')
  };
}

function legacyTransport(source = {}, previousItem = null) {
  const from = cleanText(previousItem?.location || previousItem?.place || previousItem?.title, '이전 장소');
  const to = cleanText(source.location || source.place || source.title || source.destinationName, '다음 장소');
  const durationMinutes = Number(source.durationMinutes || source.duration_minutes) || 0;
  return transport(from, to, durationMinutes, [
    routeStep(
      cleanText(source.transportLine || source.line, '대중교통 상세 확인'),
      cleanText(source.direction, '현장 경로 검색 기준'),
      from,
      to,
      cleanText(source.transfer, ''),
      cleanText(source.travelTimeFromPrevious || source.travel_time_from_previous || source.note, '정확한 승강장과 출구는 당일 지도 앱으로 확인')
    )
  ]);
}

function itemFromLegacy(source = {}, index = 0, previousItem = null) {
  const parsed = parseTimeRange(source.time || source.timeSlot || source.time_slot);
  const category = categoryFromLegacy(source);
  const title = cleanText(source.title || source.destinationName || source.destination_name, `코스 ${index + 1}`);
  const location = cleanText(source.location || source.place || source.region, title);
  return item({
    id: cleanText(source.id, `legacy-${index + 1}`),
    category,
    startTime: cleanText(source.startTime || source.start_time || parsed.startTime),
    endTime: cleanText(source.endTime || source.end_time || parsed.endTime),
    durationText: durationTextFromLegacy(source),
    title,
    description: cleanText(source.description || source.note || source.summary, '세부 설명을 확인하세요.'),
    location,
    transport: category === '이동' ? legacyTransport({ ...source, title, location }, previousItem) : null,
    meal: legacyMeal({ ...source, title }, category),
    cost: cost({ memo: category === '이동' ? '기존 일정에서 변환됨. 실제 요금은 IC카드/패스 기준으로 확인 필요' : '' }),
    tips: [cleanText(source.travelTimeFromPrevious || source.travel_time_from_previous)].filter(Boolean)
  });
}

export function isOsakaKyotoUsjPlan(plan = {}) {
  const text = [
    plan.title,
    plan.destinationName,
    plan.destinationRegion,
    plan.region,
    plan.summary,
    ...(plan.interests || []),
    ...(plan.styles || [])
  ].filter(Boolean).join(' ').toLowerCase();
  return /오사카|osaka/.test(text) && /교토|kyoto/.test(text) && /usj|유니버설/.test(text);
}

export function cloneTripMobilePlan(plan) {
  return JSON.parse(JSON.stringify(plan));
}

export function legacyPlanToTripMobilePlan(plan = {}) {
  if (plan.tripMobilePlan) return cloneTripMobilePlan(plan.tripMobilePlan);
  if (isOsakaKyotoUsjPlan(plan)) return cloneTripMobilePlan(OSAKA_KYOTO_USJ_MOBILE_PLAN);

  const days = Array.isArray(plan.itinerary) ? plan.itinerary : [];
  const startDate = cleanText(plan.startDate);
  const endDate = startDate && plan.days ? addDays(startDate, Math.max(0, Number(plan.days) - 1)) : '';
  const mobileDays = days.map((day, dayIndex) => {
    const sourceItems = Array.isArray(day.items) ? day.items : [];
    const mappedItems = sourceItems.map((sourceItem, itemIndex) => itemFromLegacy(sourceItem, itemIndex, sourceItems[itemIndex - 1]));
    return {
      day: Number(day.day || day.dayNumber || dayIndex + 1),
      date: startDate ? addDays(startDate, dayIndex) : '',
      title: cleanText(day.title, `${dayIndex + 1}일차`),
      items: mappedItems
    };
  });

  return {
    trip: {
      title: cleanText(plan.title, '여행 계획'),
      startDate,
      endDate,
      hotel: cleanText(plan.hotel || plan.startPlace),
      people: cleanText(plan.travelers || plan.travelerType || plan.party, '인원 미정'),
      summary: cleanText(plan.summary, '기존 여행 계획을 모바일 카드형 일정으로 변환했습니다.')
    },
    daySummaries: mobileDays.map((day) => ({
      day: day.day,
      date: day.date,
      title: day.title,
      route: day.items.map((entry) => entry.title).slice(0, 5).join(' -> '),
      theme: day.items.map((entry) => entry.category).filter((value, index, array) => array.indexOf(value) === index).join(' · '),
      estimatedCost: cleanText(plan.estimatedBudget, '확인 필요'),
      passSummary: '기존 일정 변환: 패스/IC 구분 확인 필요'
    })),
    days: mobileDays,
    budget: {
      currency: 'JPY/KRW',
      perPersonEstimate: cleanText(plan.estimatedBudget, '확인 필요'),
      transport: '기존 일정 변환 후 확인 필요',
      tickets: '기존 일정 변환 후 확인 필요',
      food: '기존 일정 변환 후 확인 필요',
      shopping: '개인 선택',
      memo: 'API가 새 비용 구조를 내려주기 전까지 mapper가 기본값으로 채웁니다.'
    },
    passRecommendation: {
      summary: '기존 일정 변환: 지역별 교통권은 별도 확인 필요',
      byDate: [],
      notRecommended: []
    },
    ticketLinks: TICKET_LINKS
  };
}
