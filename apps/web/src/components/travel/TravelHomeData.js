export const QUICK_SEARCH_TERMS = ['서울', '도쿄', '가족 여행', '부산', '제주'];

export const QUICK_RECOMMENDATIONS = [
  { title: '당일치기 코스', query: '당일치기 코스', icon: 'sun' },
  { title: '로컬 맛집', query: '로컬 맛집', icon: 'food' },
  { title: '사진 명소', query: '사진 명소', icon: 'camera' },
  { title: '역사 투어', query: '역사 투어', icon: 'history' }
];

export const SERVICE_CATEGORIES = [
  {
    title: '여행 코스 설계',
    detail: '일정과 취향에 맞춘 하루 동선',
    query: '코스',
    icon: 'route'
  },
  {
    title: '숨은 명소',
    detail: '유명지와 근처 보석 같은 장소',
    query: '숨은 명소',
    icon: 'hidden'
  },
  {
    title: '맛집·카페 투어',
    detail: '대기와 이동을 줄이는 방문 순서',
    query: '맛집',
    icon: 'food'
  },
  {
    title: '가족 나들이',
    detail: '아이 동반에 맞춘 휴식 많은 코스',
    query: '가족',
    icon: 'family'
  },
  {
    title: '사진 명소',
    detail: '시간대별 빛과 배경이 좋은 장소',
    query: '사진',
    icon: 'camera'
  },
  {
    title: '교통·동선',
    detail: '대중교통, 도보, 차량 이동 최적화',
    query: '교통',
    icon: 'transit'
  }
];

export const QUICK_ACTIONS = [
  { title: '장소 찾기', icon: 'search', path: '/destinations?focus=places' },
  { title: '코스 만들기', icon: 'route', path: '/planner' },
  { title: '내 일정', icon: 'calendar', path: '/plans' },
  { title: '여행 메모', icon: 'memo', path: '/notes' }
];
