#!/usr/bin/env python3
"""Seed a richer LocalTrip destination catalog for admin1."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence


DEFAULT_WORKSPACE = "/data/workspace-data/users/admin1/workspace"
DEFAULT_REPO_ROOT = "/home/lezzs5103/vibeCoding"
DEFAULT_COMPOSE_FILE = "docker-compose.dev.yml"
DEFAULT_APP_MOCK_SOURCE = "apps/api/src/main/java/com/platform/jupiter/localtrip/LocalTripDestinationService.java"
SOURCE = "admin1-batch"


@dataclass(frozen=True)
class DestinationSeed:
    source_ref: str
    name: str
    region: str
    district: str
    category: str
    primary_style: str
    style_tags: Sequence[str]
    address: str
    headline: str
    description: str
    recommended_minutes: int
    popularity_score: int
    image_url: str | None


def img(query: str) -> str | None:
    return None


DESTINATIONS: tuple[DestinationSeed, ...] = (
    DestinationSeed("ADMIN1-SEOUL-001", "경복궁", "서울", "종로구", "궁궐", "역사", ("역사", "가족", "사진", "도보"), "서울 종로구 사직로 161", "서울 고궁 여행의 기준점", "근정전, 경회루, 국립민속박물관을 한 동선으로 묶기 좋습니다. 북촌과 서촌으로 이어지는 도보 일정의 출발점으로 안정적입니다.", 130, 99, img("gyeongbokgung palace")),
    DestinationSeed("ADMIN1-SEOUL-002", "북촌한옥마을", "서울", "종로구", "마을", "사진", ("역사", "사진", "커플", "도보"), "서울 종로구 계동길 37", "한옥 골목과 전망 포인트가 이어지는 마을", "주거지와 관광지가 겹쳐 조용한 관람이 필요합니다. 경복궁, 창덕궁, 삼청동 카페와 연결하기 좋습니다.", 90, 94, img("bukchon hanok village")),
    DestinationSeed("ADMIN1-SEOUL-003", "성수 카페거리", "서울", "성동구", "카페", "카페", ("카페", "쇼핑", "사진", "커플"), "서울 성동구 연무장길 일대", "카페와 편집숍, 팝업이 모인 도심 상권", "실내 체류지가 많아 날씨 영향을 덜 받습니다. 서울숲 산책과 묶으면 오후 일정으로 자연스럽습니다.", 110, 92, img("seongsu cafe street")),
    DestinationSeed("ADMIN1-SEOUL-004", "망원시장", "서울", "마포구", "시장", "맛집", ("맛집", "시장", "가족", "로컬"), "서울 마포구 포은로8길 14", "간식과 식사를 한 번에 해결하는 로컬 시장", "닭강정, 고로케, 분식 등 짧은 체류에도 만족도가 높습니다. 망원한강공원과 함께 반나절로 묶기 좋습니다.", 80, 88, img("korean market food")),
    DestinationSeed("ADMIN1-SEOUL-005", "여의도 한강공원", "서울", "영등포구", "공원", "자연", ("자연", "가족", "커플", "야경"), "서울 영등포구 여의동로 330", "피크닉과 야경을 모두 잡는 강변 공원", "자전거, 돗자리, 야경 산책까지 선택지가 많습니다. 아이 동반이나 저녁 여유 일정에 넣기 좋습니다.", 100, 89, img("hangang park seoul")),
    DestinationSeed("ADMIN1-SEOUL-006", "남산서울타워", "서울", "용산구", "전망대", "커플", ("커플", "사진", "가족", "야경"), "서울 용산구 남산공원길 105", "서울 도심 야경을 한 번에 보는 전망 명소", "해질녘 이후 방문 만족도가 높습니다. 명동, 회현, 이태원 식사 동선과 연결하기 쉽습니다.", 90, 91, img("namsan seoul tower")),
    DestinationSeed("ADMIN1-SEOUL-007", "서울숲", "서울", "성동구", "공원", "자연", ("자연", "가족", "산책", "카페"), "서울 성동구 뚝섬로 273", "성수와 붙어 있는 넓은 도심 숲", "산책로와 잔디 공간이 넓어 일정 사이 휴식 지점으로 좋습니다. 성수 카페거리와 도보로 묶기 쉽습니다.", 95, 90, img("seoul forest park")),
    DestinationSeed("ADMIN1-SEOUL-008", "익선동 한옥거리", "서울", "종로구", "거리", "카페", ("카페", "맛집", "사진", "커플"), "서울 종로구 익선동 일대", "한옥 개조 카페와 식당이 밀집한 골목 상권", "좁은 골목에 인기 매장이 많아 대기 시간을 고려해야 합니다. 종묘, 인사동, 종로3가 동선과 잘 맞습니다.", 90, 87, img("ikseondong hanok street")),
    DestinationSeed("ADMIN1-SEOUL-009", "창덕궁", "서울", "종로구", "궁궐", "역사", ("역사", "가족", "사진", "정원"), "서울 종로구 율곡로 99", "후원 관람으로 깊이가 생기는 궁궐", "후원 예약 여부가 일정 품질을 좌우합니다. 북촌과 안국역 카페권을 함께 잡으면 이동이 단순합니다.", 120, 93, img("changdeokgung palace")),
    DestinationSeed("ADMIN1-SEOUL-010", "광장시장", "서울", "종로구", "시장", "맛집", ("맛집", "시장", "가족", "로컬"), "서울 종로구 창경궁로 88", "빈대떡과 육회 골목으로 유명한 전통시장", "짧은 식사 일정으로 강합니다. 청계천, 종로, 동대문과 연결하기 좋아 비는 시간 채우기에 적합합니다.", 80, 90, img("gwangjang market")),
    DestinationSeed("ADMIN1-SEOUL-011", "덕수궁 돌담길", "서울", "중구", "거리", "산책", ("역사", "산책", "사진", "커플"), "서울 중구 세종대로 99", "도심 속 고궁 담장 산책로", "시청역 접근성이 좋아 일정 시작이나 마무리에 넣기 쉽습니다. 정동길 카페와 함께 조용한 코스로 구성됩니다.", 70, 85, img("deoksugung stone wall road")),
    DestinationSeed("ADMIN1-SEOUL-012", "연남동 경의선숲길", "서울", "마포구", "거리", "카페", ("카페", "맛집", "산책", "커플"), "서울 마포구 연남동 일대", "숲길 산책과 작은 식당이 이어지는 홍대 인근 코스", "홍대보다 조금 차분한 분위기입니다. 점심 이후 산책과 디저트 일정으로 배치하기 좋습니다.", 95, 86, img("yeonnam gyeongui line forest")),
    DestinationSeed("ADMIN1-BUSAN-001", "감천문화마을", "부산", "사하구", "마을", "사진", ("사진", "가족", "전망", "도보"), "부산 사하구 감내2로 203", "계단식 마을 풍경과 벽화가 이어지는 명소", "오르막과 계단이 많아 여유 시간이 필요합니다. 남포동, 국제시장과 함께 원도심 코스로 묶기 좋습니다.", 110, 91, img("gamcheon culture village")),
    DestinationSeed("ADMIN1-BUSAN-002", "해운대해수욕장", "부산", "해운대구", "해변", "자연", ("자연", "가족", "커플", "야경"), "부산 해운대구 우동", "부산 바다 여행의 대표 해변", "낮에는 해변 산책, 저녁에는 해운대시장과 더베이101로 이어가기 쉽습니다. 숙박권 접근성도 좋습니다.", 130, 97, img("haeundae beach")),
    DestinationSeed("ADMIN1-BUSAN-003", "광안리해변", "부산", "수영구", "해변", "커플", ("커플", "야경", "카페", "사진"), "부산 수영구 광안해변로", "광안대교 야경이 강한 저녁형 여행지", "해질녘 이후 만족도가 높습니다. 민락수변공원, 회센터, 해변 카페를 함께 구성하기 좋습니다.", 110, 95, img("gwangalli beach bridge")),
    DestinationSeed("ADMIN1-BUSAN-004", "국제시장", "부산", "중구", "시장", "맛집", ("맛집", "쇼핑", "가족", "로컬"), "부산 중구 신창동4가", "부산 원도심 먹거리와 쇼핑의 중심", "깡통시장, 보수동 책방골목, 자갈치시장과 함께 반나절 원도심 코스로 묶기 좋습니다.", 100, 89, img("busan gukje market")),
    DestinationSeed("ADMIN1-BUSAN-005", "전포카페거리", "부산", "부산진구", "카페", "카페", ("카페", "쇼핑", "사진", "커플"), "부산 부산진구 전포대로 일대", "서면 근처 카페와 편집숍 밀집 상권", "도심 이동 중 휴식 지점으로 쓰기 좋습니다. 서면 식사 전후에 넣으면 동선 낭비가 적습니다.", 90, 86, img("jeonpo cafe street")),
    DestinationSeed("ADMIN1-BUSAN-006", "태종대", "부산", "영도구", "공원", "자연", ("자연", "사진", "가족", "전망"), "부산 영도구 전망로 24", "해안 절벽과 등대 전망을 보는 자연 명소", "바람이 강한 날이 많아 낮 일정이 안정적입니다. 다누비열차 운행 여부를 확인하면 걷는 부담을 줄일 수 있습니다.", 120, 88, img("taejongdae busan")),
    DestinationSeed("ADMIN1-BUSAN-007", "흰여울문화마을", "부산", "영도구", "마을", "사진", ("사진", "카페", "전망", "도보"), "부산 영도구 흰여울길", "바다 절벽을 따라 걷는 영도 골목 마을", "카페와 전망 포인트가 이어져 사진 일정에 강합니다. 영도 해안 드라이브와 함께 구성하기 좋습니다.", 95, 87, img("huinnyeoul culture village")),
    DestinationSeed("ADMIN1-BUSAN-008", "송정해변", "부산", "해운대구", "해변", "자연", ("자연", "서핑", "가족", "카페"), "부산 해운대구 송정동", "해운대보다 여유로운 서핑 해변", "블루라인파크와 연결하기 좋고 가족 산책에도 부담이 낮습니다. 카페 체류와 해변 산책을 함께 잡기 좋습니다.", 100, 84, img("songjeong beach busan")),
    DestinationSeed("ADMIN1-BUSAN-009", "자갈치시장", "부산", "중구", "시장", "맛집", ("맛집", "시장", "로컬", "가족"), "부산 중구 자갈치해안로 52", "부산 수산시장과 바다 도시 분위기를 체감하는 장소", "회 식사, 항구 풍경, 남포동 쇼핑을 한 번에 연결할 수 있습니다. 점심이나 이른 저녁에 안정적입니다.", 90, 88, img("jagalchi market")),
    DestinationSeed("ADMIN1-BUSAN-010", "오륙도스카이워크", "부산", "남구", "전망대", "사진", ("사진", "자연", "전망", "커플"), "부산 남구 오륙도로 137", "바다 위 절벽 전망을 짧고 강하게 보는 포인트", "체류 시간은 길지 않지만 사진 만족도가 높습니다. 이기대 해안산책로와 묶으면 자연 코스가 됩니다.", 70, 83, img("oryukdo skywalk")),
    DestinationSeed("ADMIN1-BUSAN-011", "동백섬", "부산", "해운대구", "공원", "산책", ("산책", "자연", "사진", "가족"), "부산 해운대구 동백로 67", "해운대와 연결된 바다 산책 코스", "누리마루와 해안 산책로를 함께 볼 수 있습니다. 해운대 일정 앞뒤로 넣으면 이동 부담이 거의 없습니다.", 80, 85, img("dongbaek island busan")),
    DestinationSeed("ADMIN1-BUSAN-012", "다대포해수욕장", "부산", "사하구", "해변", "자연", ("자연", "노을", "가족", "사진"), "부산 사하구 다대동", "낙조와 넓은 모래사장이 강한 서부산 해변", "도심에서 거리는 있지만 노을 시간대 만족도가 높습니다. 감천문화마을 이후 여유 일정으로 연결 가능합니다.", 110, 84, img("dadaepo beach sunset")),
    DestinationSeed("ADMIN1-GYEONGJU-001", "불국사", "경주", "진현동", "사찰", "역사", ("역사", "가족", "사진", "문화유산"), "경북 경주시 불국로 385", "석가탑과 다보탑을 보는 대표 문화유산", "석굴암, 보문단지와 차량 반나절 코스로 묶기 좋습니다. 가족 역사 일정의 중심축으로 안정적입니다.", 120, 98, img("bulguksa temple")),
    DestinationSeed("ADMIN1-GYEONGJU-002", "동궁과 월지", "경주", "인왕동", "유적", "사진", ("역사", "사진", "커플", "야경"), "경북 경주시 원화로 102", "연못 반영과 조명이 강한 야간 명소", "해가 진 뒤 방문하면 일정의 인상이 크게 좋아집니다. 첨성대와 월정교 야경을 함께 잡기 좋습니다.", 80, 96, img("donggung wolji night")),
    DestinationSeed("ADMIN1-GYEONGJU-003", "첨성대", "경주", "인왕동", "유적", "역사", ("역사", "가족", "사진", "도보"), "경북 경주시 인왕동 839-1", "대릉원과 월성 사이를 잇는 경주 상징 유적", "체류 시간은 짧지만 주변 동선 연결성이 높습니다. 낮과 밤 모두 사진 포인트가 분명합니다.", 50, 90, img("cheomseongdae gyeongju")),
    DestinationSeed("ADMIN1-GYEONGJU-004", "황리단길", "경주", "황남동", "거리", "카페", ("카페", "맛집", "쇼핑", "커플"), "경북 경주시 포석로 1080 일대", "한옥형 카페와 식당이 모인 대표 상권", "대릉원 관람 후 휴식 코스로 좋습니다. 인기 매장은 대기 시간이 있어 후보 식당을 같이 잡는 편이 안정적입니다.", 115, 94, img("hwangnidan gil")),
    DestinationSeed("ADMIN1-GYEONGJU-005", "보문호수", "경주", "보문동", "호수", "자연", ("자연", "가족", "산책", "커플"), "경북 경주시 보문로 일대", "리조트권과 연결되는 호수 산책 명소", "차량 이동 중 쉬어가기 좋습니다. 가족 산책이나 숙소 복귀 전 여유 일정으로 안정적입니다.", 90, 86, img("bomun lake gyeongju")),
    DestinationSeed("ADMIN1-GYEONGJU-006", "교촌마을", "경주", "교동", "마을", "맛집", ("맛집", "역사", "가족", "사진"), "경북 경주시 교촌길 39-2", "전통 가옥과 지역 먹거리를 함께 보는 마을", "월정교와 가까워 저녁 전후 동선이 자연스럽습니다. 한옥 분위기 사진과 간식 일정에 적합합니다.", 90, 88, img("gyochon village gyeongju")),
    DestinationSeed("ADMIN1-GYEONGJU-007", "대릉원", "경주", "황남동", "고분", "역사", ("역사", "사진", "가족", "산책"), "경북 경주시 황남동 31-1", "고분 숲 산책과 천마총 관람을 함께 하는 핵심지", "경주 시내 동선의 중심입니다. 첨성대, 황리단길, 월정교와 도보로 연결하기 좋습니다.", 100, 93, img("daereungwon tomb complex")),
    DestinationSeed("ADMIN1-GYEONGJU-008", "월정교", "경주", "교동", "다리", "사진", ("사진", "야경", "역사", "커플"), "경북 경주시 교동 274", "야경 사진이 강한 복원 목조교", "교촌마을과 붙어 있어 저녁 산책에 넣기 좋습니다. 동궁과 월지 야간 관람 전후로 연결하기 쉽습니다.", 70, 89, img("woljeonggyo bridge")),
    DestinationSeed("ADMIN1-GYEONGJU-009", "석굴암", "경주", "진현동", "사찰", "역사", ("역사", "문화유산", "가족", "산책"), "경북 경주시 석굴로 238", "토함산에 자리한 유네스코 석굴 사찰", "불국사와 같은 권역으로 묶는 것이 효율적입니다. 산길 이동 시간이 있어 차량 일정에 더 적합합니다.", 90, 91, img("seokguram grotto")),
    DestinationSeed("ADMIN1-GYEONGJU-010", "경주월드", "경주", "천군동", "테마파크", "가족", ("가족", "액티비티", "커플", "놀이공원"), "경북 경주시 보문로 544", "보문단지에 있는 액티비티형 테마파크", "역사 일정 사이에 변화를 주기 좋습니다. 아이 동반이나 활동적인 커플 일정에 잘 맞습니다.", 180, 87, img("gyeongju world amusement park")),
    DestinationSeed("ADMIN1-GYEONGJU-011", "국립경주박물관", "경주", "인왕동", "박물관", "역사", ("역사", "가족", "실내", "문화"), "경북 경주시 일정로 186", "신라 유물을 체계적으로 보는 실내 명소", "비 오는 날 대체 일정으로 좋습니다. 첨성대, 동궁과 월지와 가까워 시내 역사 코스에 넣기 쉽습니다.", 110, 89, img("gyeongju national museum")),
    DestinationSeed("ADMIN1-GYEONGJU-012", "양동마을", "경주", "강동면", "마을", "역사", ("역사", "한옥", "사진", "가족"), "경북 경주시 강동면 양동마을길 93", "전통 양반 가옥이 보존된 세계유산 마을", "시내에서 거리가 있어 차량 일정에 적합합니다. 조용한 역사 산책과 한옥 사진을 원하는 일정에 좋습니다.", 130, 85, img("yangdong folk village")),
    DestinationSeed("ADMIN1-JEJU-001", "성산일출봉", "제주", "성산읍", "오름", "자연", ("자연", "사진", "가족", "일출"), "제주 서귀포시 성산읍 성산리 1", "일출과 분화구 전망을 함께 보는 제주 동부 대표 명소", "정상까지 계단이 이어집니다. 섭지코지, 광치기해변, 우도 배편과 묶으면 동부 하루 일정의 중심이 됩니다.", 130, 98, img("seongsan ilchulbong")),
    DestinationSeed("ADMIN1-JEJU-002", "우도", "제주", "우도면", "섬", "자연", ("자연", "커플", "사진", "드라이브"), "제주 제주시 우도면", "배 이동과 해안 드라이브가 결합된 섬 코스", "기상과 배편 시간이 중요해 반나절 이상 확보해야 합니다. 전기차나 순환버스 이용 계획을 먼저 잡는 편이 안정적입니다.", 210, 95, img("udo island jeju")),
    DestinationSeed("ADMIN1-JEJU-003", "협재해변", "제주", "한림읍", "해변", "가족", ("가족", "자연", "사진", "카페"), "제주 제주시 한림읍 협재리 2497-1", "맑은 물빛과 비양도 전망이 좋은 서부 해변", "아이 동반 물놀이와 카페 휴식을 함께 잡기 좋습니다. 금능해변과 이어서 걷기에도 좋습니다.", 120, 91, img("hyeopjae beach")),
    DestinationSeed("ADMIN1-JEJU-004", "동문시장", "제주", "일도일동", "시장", "맛집", ("맛집", "가족", "쇼핑", "야시장"), "제주 제주시 관덕로14길 20", "야시장 먹거리와 기념품 구매를 한 번에 해결하는 시장", "공항 접근성이 좋아 도착일 저녁이나 출발 전 짧은 일정에 넣기 쉽습니다.", 90, 90, img("jeju dongmun market")),
    DestinationSeed("ADMIN1-JEJU-005", "애월카페거리", "제주", "애월읍", "카페", "카페", ("카페", "커플", "사진", "드라이브"), "제주 제주시 애월읍 애월해안로", "해안 드라이브와 카페 체류가 이어지는 감성 코스", "서부권 드라이브 중 쉬어가는 포인트로 적합합니다. 노을 시간대 만족도가 높습니다.", 110, 91, img("aewol cafe street jeju")),
    DestinationSeed("ADMIN1-JEJU-006", "절물자연휴양림", "제주", "봉개동", "휴양림", "자연", ("자연", "가족", "숲", "산책"), "제주 제주시 명림로 584", "삼나무 숲길과 완만한 산책로가 있는 휴양림", "더운 날에도 숲 그늘이 있어 가족 일정에 안정적입니다. 도심권에서 접근하기도 무난합니다.", 100, 85, img("jeolmul forest jeju")),
    DestinationSeed("ADMIN1-JEJU-007", "사려니숲길", "제주", "조천읍", "숲길", "자연", ("자연", "산책", "사진", "힐링"), "제주 제주시 조천읍 교래리", "곧게 뻗은 삼나무 숲길 산책 코스", "긴 코스를 모두 걷기보다 입구 주변 산책으로 잡으면 부담이 낮습니다. 비 오는 날에도 분위기가 좋습니다.", 100, 88, img("saryeoni forest path")),
    DestinationSeed("ADMIN1-JEJU-008", "천지연폭포", "제주", "서귀동", "폭포", "자연", ("자연", "가족", "사진", "산책"), "제주 서귀포시 천지동 667-7", "서귀포 도심에서 접근 쉬운 폭포 산책지", "야간 개장 시 분위기가 좋고 산책로가 비교적 완만합니다. 서귀포 매일올레시장과 묶기 좋습니다.", 80, 87, img("cheonjiyeon waterfall")),
    DestinationSeed("ADMIN1-JEJU-009", "오설록 티뮤지엄", "제주", "안덕면", "박물관", "카페", ("카페", "실내", "가족", "사진"), "제주 서귀포시 안덕면 신화역사로 15", "녹차밭과 디저트, 실내 관람을 함께 하는 명소", "비 오는 날이나 이동 중 휴식 지점으로 좋습니다. 서부권 관광지와 차량 동선이 잘 맞습니다.", 90, 86, img("osulloc tea museum")),
    DestinationSeed("ADMIN1-JEJU-010", "카멜리아힐", "제주", "안덕면", "정원", "사진", ("사진", "커플", "가족", "꽃"), "제주 서귀포시 안덕면 병악로 166", "계절 꽃과 정원 사진이 강한 서부권 명소", "꽃 피는 시기에 만족도가 높습니다. 산책로가 정돈되어 있어 가족이나 커플 일정에 무난합니다.", 100, 84, img("camellia hill jeju")),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate and apply admin1 LocalTrip destination seed data.")
    parser.add_argument("--workspace", default=DEFAULT_WORKSPACE, help="admin1 workspace root.")
    parser.add_argument("--repo-root", default=DEFAULT_REPO_ROOT, help="Repository root containing docker-compose.dev.yml.")
    parser.add_argument("--compose-file", default=DEFAULT_COMPOSE_FILE, help="Compose file path, relative to repo root unless absolute.")
    parser.add_argument("--app-mock-source", default=DEFAULT_APP_MOCK_SOURCE, help="Existing Java mock destination source, relative to repo root unless absolute.")
    parser.add_argument("--skip-app-mock", action="store_true", help="Only use the handwritten admin1 seed list.")
    parser.add_argument("--db-service", default="db", help="Compose MariaDB service name.")
    parser.add_argument("--db-name", default=os.getenv("DB_NAME", "jupiter_web"))
    parser.add_argument("--db-user", default=os.getenv("DB_USER", "jupiter"))
    parser.add_argument("--db-password", default=os.getenv("DB_PASSWORD", "jupiter"))
    parser.add_argument("--apply", action="store_true", help="Apply generated SQL through docker compose exec.")
    parser.add_argument("--print-sql", action="store_true", help="Print SQL to stdout.")
    return parser.parse_args()


def sql_quote(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def sql_value(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, str):
        return sql_quote(value)
    raise TypeError(f"Unsupported SQL value: {value!r}")


def normalize_key(value: str) -> str:
    return re.sub(r"\s+", "", value.strip().lower())


def split_java_strings(value: str) -> list[str]:
    return re.findall(r'"([^"]*)"', value)


def parse_app_mock_destinations(source_path: Path) -> list[DestinationSeed]:
    if not source_path.exists():
        return []
    source = source_path.read_text(encoding="utf-8")
    pattern = re.compile(
        r'new MockDestination\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*'
        r'List\.of\((.*?)\),\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*(\d+),\s*(\d+)\)',
        re.DOTALL,
    )
    destinations: list[DestinationSeed] = []
    for match in pattern.finditer(source):
        (
            source_ref,
            name,
            region,
            district,
            category,
            primary_style,
            style_tags_source,
            address,
            headline,
            description,
            recommended_minutes,
            popularity_score,
        ) = match.groups()
        destinations.append(
            DestinationSeed(
                source_ref=f"MOCK-{source_ref}",
                name=name,
                region=region,
                district=district,
                category=category,
                primary_style=primary_style,
                style_tags=tuple(split_java_strings(style_tags_source)),
                address=address,
                headline=headline,
                description=description,
                recommended_minutes=int(recommended_minutes),
                popularity_score=int(popularity_score),
                image_url=img(name),
            )
        )
    return destinations


def build_destination_catalog(args: argparse.Namespace) -> tuple[list[DestinationSeed], int]:
    destinations = list(DESTINATIONS)
    existing_keys = {
        (normalize_key(destination.region), normalize_key(destination.name))
        for destination in destinations
    }
    parsed_mock_count = 0
    if not args.skip_app_mock:
        source_path = Path(args.app_mock_source)
        if not source_path.is_absolute():
            source_path = Path(args.repo_root) / source_path
        app_mock_destinations = parse_app_mock_destinations(source_path)
        parsed_mock_count = len(app_mock_destinations)
        for destination in app_mock_destinations:
            key = (normalize_key(destination.region), normalize_key(destination.name))
            if key in existing_keys:
                continue
            destinations.append(destination)
            existing_keys.add(key)
    return destinations, parsed_mock_count


def build_sql(destinations: Sequence[DestinationSeed]) -> str:
    columns = [
        "name", "region", "district", "category", "primary_style", "style_tags", "address",
        "headline", "description", "recommended_minutes", "popularity_score", "source", "source_ref", "image_url",
    ]
    rows = []
    for destination in destinations:
        values: list[object] = [
            destination.name,
            destination.region,
            destination.district,
            destination.category,
            destination.primary_style,
            ",".join(destination.style_tags),
            destination.address,
            destination.headline,
            destination.description,
            destination.recommended_minutes,
            destination.popularity_score,
            SOURCE,
            destination.source_ref,
            destination.image_url,
        ]
        rows.append("(" + ", ".join(sql_value(value) for value in values) + ")")
    update_columns = [column for column in columns if column not in {"source", "source_ref"}]
    return (
        "-- LocalTrip admin1 destination batch seed.\n"
        "ALTER TABLE localtrip_destination ADD COLUMN IF NOT EXISTS image_url VARCHAR(512);\n"
        "INSERT INTO localtrip_destination\n"
        f"    ({', '.join(columns)})\n"
        "VALUES\n    "
        + ",\n    ".join(rows)
        + "\nON DUPLICATE KEY UPDATE\n    "
        + ",\n    ".join(f"{column} = VALUES({column})" for column in update_columns)
        + ",\n    updated_at = CURRENT_TIMESTAMP(6);\n"
        + "INSERT INTO localtrip_api_sync_log (provider, sync_type, status, records_inserted, records_updated, request_url, message, started_at, ended_at)\n"
        + f"VALUES ({sql_quote(SOURCE)}, 'DESTINATION', 'SUCCEEDED', {len(destinations)}, 0, 'localtrip://admin1/workspace/batch', 'Admin1 batch destination seed applied.', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));\n"
    )


def write_outputs(workspace: Path, sql: str, destinations: Sequence[DestinationSeed], parsed_mock_count: int) -> tuple[Path, Path]:
    output_dir = workspace / "localtrip" / "seed"
    output_dir.mkdir(parents=True, exist_ok=True)
    sql_path = output_dir / "localtrip_admin1_destinations.sql"
    manifest_path = output_dir / "localtrip_admin1_destinations.manifest.json"
    sql_path.write_text(sql, encoding="utf-8")
    manifest = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "source": SOURCE,
        "recordCount": len(destinations),
        "sourceInputs": {
            "handwrittenAdmin1": len(DESTINATIONS),
            "parsedAppMock": parsed_mock_count,
        },
        "minimums": {"서울": 10, "부산": 10, "경주": 10, "제주": 10},
        "actualCounts": {
            region: sum(1 for destination in destinations if destination.region == region)
            for region in sorted({destination.region for destination in destinations})
        },
        "destinations": [asdict(destination) for destination in destinations],
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return sql_path, manifest_path


def apply_sql(args: argparse.Namespace, sql: str) -> None:
    repo_root = Path(args.repo_root)
    compose_file = Path(args.compose_file)
    if not compose_file.is_absolute():
        compose_file = repo_root / compose_file
    command = [
        "docker", "compose", "-f", str(compose_file), "exec", "-T", args.db_service,
        "mariadb", f"-u{args.db_user}", f"-p{args.db_password}", args.db_name,
    ]
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir="/data/tmp" if Path("/data/tmp").exists() else None) as temp:
        temp.write(sql)
        temp_path = temp.name
    try:
        with open(temp_path, "rb") as sql_file:
            subprocess.run(command, cwd=repo_root, stdin=sql_file, check=True)
    finally:
        Path(temp_path).unlink(missing_ok=True)


def main() -> int:
    args = parse_args()
    workspace = Path(args.workspace)
    destinations, parsed_mock_count = build_destination_catalog(args)
    sql = build_sql(destinations)
    sql_path, manifest_path = write_outputs(workspace, sql, destinations, parsed_mock_count)
    if args.print_sql:
        print(sql)
    if args.apply:
        apply_sql(args, sql)
    print(f"Wrote SQL seed: {sql_path}")
    print(f"Wrote manifest: {manifest_path}")
    counts = {
        region: sum(1 for destination in destinations if destination.region == region)
        for region in sorted({destination.region for destination in destinations})
    }
    print(f"Prepared {len(destinations)} destinations from {len(DESTINATIONS)} admin seeds and {parsed_mock_count} parsed app mock seeds.")
    print("Region counts: " + ", ".join(f"{region} {count}" for region, count in counts.items()))
    if args.apply:
        print(f"Applied destination batch to {args.db_name}.localtrip_destination")
    return 0


if __name__ == "__main__":
    sys.exit(main())
