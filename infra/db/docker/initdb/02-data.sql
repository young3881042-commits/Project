INSERT IGNORE INTO travel_region (region_code, region_name, region_group, sort_order) VALUES
    ('SEOUL', '서울', '수도권', 1),
    ('BUSAN', '부산', '영남권', 2),
    ('JEJU', '제주', '제주권', 3),
    ('GANGWON', '강원', '동해권', 4),
    ('JEONJU', '전주', '호남권', 5);

INSERT IGNORE INTO travel_district (district_code, region_code, district_name, district_tier, sort_order) VALUES
    ('SEOUL-GANGNAM', 'SEOUL', '강남구', '핵심상권', 1),
    ('SEOUL-MAPO', 'SEOUL', '마포구', '라이프스타일', 2),
    ('SEOUL-SEONGDONG', 'SEOUL', '성동구', '팝업상권', 3),
    ('SEOUL-JONGNO', 'SEOUL', '종로구', '전통문화', 4),
    ('BUSAN-HAEUNDAE', 'BUSAN', '해운대구', '해변관광', 1),
    ('BUSAN-SUYEONG', 'BUSAN', '수영구', '야간상권', 2),
    ('BUSAN-BUSANJIN', 'BUSAN', '부산진구', '도심상권', 3),
    ('BUSAN-JUNGGU', 'BUSAN', '중구', '원도심관광', 4),
    ('JEJU-JEJUSI', 'JEJU', '제주시', '도심허브', 1),
    ('JEJU-AEWOL', 'JEJU', '애월읍', '해안감성', 2),
    ('JEJU-SEOGWIPO', 'JEJU', '서귀포시', '체류리조트', 3),
    ('JEJU-SEONGSAN', 'JEJU', '성산읍', '자연관광', 4),
    ('GANGWON-GANGNEUNG', 'GANGWON', '강릉시', '동해안', 1),
    ('GANGWON-SOKCHO', 'GANGWON', '속초시', '관광허브', 2),
    ('GANGWON-CHUNCHEON', 'GANGWON', '춘천시', '근교여행', 3),
    ('GANGWON-PYEONGCHANG', 'GANGWON', '평창군', '리조트', 4),
    ('JEONJU-WANSAN', 'JEONJU', '완산구', '핵심관광', 1),
    ('JEONJU-DEOKJIN', 'JEONJU', '덕진구', '업무주거', 2),
    ('JEONJU-HANOK', 'JEONJU', '한옥마을권', '체험관광', 3),
    ('JEONJU-INNOVATION', 'JEONJU', '혁신도시권', '비즈니스', 4);

INSERT IGNORE INTO travel_place (
    place_id, district_code, place_name, category, address, headline, tags_json, rating, review_count, source_ref
) VALUES
    ('PLC-SEOUL-001', 'SEOUL-GANGNAM', '코엑스 컨퍼런스 센터', '전시장', '서울 강남구 영동대로 513', '행사와 비즈니스 체류가 동시에 몰리는 대형 복합 공간', '["MICE","회의","전시"]', 4.70, 1832, 'spacecloud-demo'),
    ('PLC-SEOUL-002', 'SEOUL-GANGNAM', '가로수길 스테이 라운지', '숙소', '서울 강남구 압구정로10길 22', '쇼핑 동선과 연결되는 프리미엄 체류형 스테이', '["쇼핑","숙박","도심"]', 4.63, 924, 'spacecloud-demo'),
    ('PLC-SEOUL-003', 'SEOUL-MAPO', '홍대 라이브 스테이지', '공연장', '서울 마포구 와우산로 94', '야간 유입이 강한 공연/이벤트 중심 거점', '["야간","공연","로컬"]', 4.51, 1288, 'spacecloud-demo'),
    ('PLC-SEOUL-004', 'SEOUL-SEONGDONG', '성수 팝업 팩토리', '팝업스토어', '서울 성동구 연무장길 33', '브랜드 팝업과 카페 체류가 이어지는 복합 공간', '["팝업","카페","쇼핑"]', 4.58, 1173, 'spacecloud-demo'),
    ('PLC-BUSAN-001', 'BUSAN-HAEUNDAE', '벡스코 컨벤션홀', '전시장', '부산 해운대구 APEC로 55', '컨벤션과 숙박 수요를 함께 끌어오는 행사 거점', '["행사","숙박","MICE"]', 4.66, 1450, 'spacecloud-demo'),
    ('PLC-BUSAN-002', 'BUSAN-SUYEONG', '광안리 오션 라운지', '카페', '부산 수영구 광안해변로 233', '야경과 식음 체류가 강한 해변 상권 대표 매장', '["야경","카페","데이트"]', 4.49, 2011, 'spacecloud-demo'),
    ('PLC-BUSAN-003', 'BUSAN-BUSANJIN', '전포 디자인 스튜디오', '복합공간', '부산 부산진구 전포대로 208', '전포 상권 유입이 집중되는 로컬 복합 공간', '["전포","로컬","팝업"]', 4.41, 884, 'spacecloud-demo'),
    ('PLC-BUSAN-004', 'BUSAN-JUNGGU', '국제시장 푸드 허브', '시장', '부산 중구 중구로 29', '관광객 회전율이 높은 전통시장 대표 거점', '["시장","식도락","투어"]', 4.35, 2541, 'spacecloud-demo'),
    ('PLC-JEJU-001', 'JEJU-JEJUSI', '공항 앞 스마트 스테이', '숙소', '제주 제주시 연동 271-22', '공항 접근성이 높은 단기 체류 숙소', '["공항","숙박","렌터카"]', 4.52, 760, 'spacecloud-demo'),
    ('PLC-JEJU-002', 'JEJU-AEWOL', '애월 선셋 카페', '카페', '제주 제주시 애월읍 애월해안로 211', '드라이브 수요와 연계된 감성 해안 카페', '["드라이브","바다","카페"]', 4.61, 3320, 'spacecloud-demo'),
    ('PLC-JEJU-003', 'JEJU-SEOGWIPO', '중문 리조트 클럽', '리조트', '제주 서귀포시 중문관광로 72번길 29', '가족 체류와 액티비티 예약이 함께 발생하는 리조트', '["리조트","가족","체험"]', 4.69, 1904, 'spacecloud-demo'),
    ('PLC-JEJU-004', 'JEJU-SEONGSAN', '성산 트레일 베이스', '투어', '제주 서귀포시 성산읍 일출로 288', '동부 자연 관광 수요가 모이는 투어 베이스', '["투어","자연","오름"]', 4.43, 1127, 'spacecloud-demo'),
    ('PLC-GANGWON-001', 'GANGWON-GANGNEUNG', '안목 오션 워크', '카페', '강원 강릉시 창해로14번길 20', '해변 카페 체류와 포토 수요가 강한 대표 상권', '["해변","카페","주말"]', 4.46, 2711, 'spacecloud-demo'),
    ('PLC-GANGWON-002', 'GANGWON-SOKCHO', '속초 마리나 스테이', '숙소', '강원 속초시 영랑해안길 133', '설악/해변 관광 동선을 흡수하는 체류형 숙소', '["숙박","관광","바다"]', 4.39, 991, 'spacecloud-demo'),
    ('PLC-GANGWON-003', 'GANGWON-CHUNCHEON', '춘천 레이크홀', '공연장', '강원 춘천시 스포츠타운길 399', '근교 이벤트와 당일 체류 전환이 많은 공연 공간', '["행사","근교","체류"]', 4.31, 608, 'spacecloud-demo'),
    ('PLC-GANGWON-004', 'GANGWON-PYEONGCHANG', '알펜 리조트 포럼', '리조트', '강원 평창군 대관령면 올림픽로 715', '시즌 체류와 단체 예약 비중이 높은 리조트 거점', '["리조트","계절","단체"]', 4.64, 1344, 'spacecloud-demo'),
    ('PLC-JEONJU-001', 'JEONJU-WANSAN', '한옥마을 스테이 채움', '숙소', '전북 전주시 완산구 어진길 87', '전통 체험 관광 수요를 흡수하는 대표 스테이', '["한옥","숙박","관광"]', 4.55, 1438, 'spacecloud-demo'),
    ('PLC-JEONJU-002', 'JEONJU-DEOKJIN', '덕진 비즈 허브', '복합공간', '전북 전주시 덕진구 만성중앙로 17', '업무와 장기 체류가 섞인 혁신도시형 공간', '["업무","회의","장기"]', 4.22, 514, 'spacecloud-demo'),
    ('PLC-JEONJU-003', 'JEONJU-HANOK', '전주 체험 공방', '체험공간', '전북 전주시 완산구 은행로 65', '공예 체험과 투어가 결합된 로컬 체험 거점', '["체험","전통","포토"]', 4.57, 874, 'spacecloud-demo'),
    ('PLC-JEONJU-004', 'JEONJU-INNOVATION', '혁신도시 미팅 라운지', '회의공간', '전북 전주시 덕진구 오공로 123', '평일 예약이 많은 비즈니스 회의 거점', '["회의","비즈니스","기관"]', 4.18, 362, 'spacecloud-demo');

INSERT INTO batch_job_definition (
    job_key, job_name, schedule_type, cron_expression, notebook_path, python_entrypoint,
    source_name, target_table, elk_index, description, is_active
) VALUES
    (
        'travel-realtime-ingest',
        '여행 실시간 유입 적재',
        'REALTIME',
        '*/5 * * * *',
        '/workspace/users/admin1/workspace/notebooks/travel/realtime_ingest.ipynb',
        '/workspace/users/admin1/workspace/batch/realtime_ingest.py',
        'travel_place_source_snapshot',
        'travel_district_live_metric',
        'travel-batch-realtime',
        '실시간 원천 snapshot을 place 단위로 적재하고 district/place 지표를 생성합니다.',
        b'1'
    ),
    (
        'travel-daily-rollup',
        '여행 일 집계 배치',
        'DAILY',
        '0 2 * * *',
        '/workspace/users/admin1/workspace/notebooks/travel/daily_aggregate.ipynb',
        '/workspace/users/admin1/workspace/batch/daily_aggregate.py',
        'travel_district_live_metric',
        'travel_district_daily_summary',
        'travel-batch-daily',
        '전일 district 기준 방문/검색/예약/체류 지표를 집계합니다.',
        b'1'
    )
ON DUPLICATE KEY UPDATE
    job_name = VALUES(job_name),
    schedule_type = VALUES(schedule_type),
    cron_expression = VALUES(cron_expression),
    notebook_path = VALUES(notebook_path),
    python_entrypoint = VALUES(python_entrypoint),
    source_name = VALUES(source_name),
    target_table = VALUES(target_table),
    elk_index = VALUES(elk_index),
    description = VALUES(description),
    is_active = VALUES(is_active);

DELETE event
FROM batch_run_event event
JOIN batch_run run ON run.id = event.batch_run_id
WHERE run.job_key IN ('travel-realtime-ingest', 'travel-daily-rollup');

DELETE FROM batch_run
WHERE job_key IN ('travel-realtime-ingest', 'travel-daily-rollup');

INSERT IGNORE INTO batch_run (
    run_key, job_key, run_mode, trigger_type, notebook_instance, source_name, status,
    records_in, records_out, duration_ms, summary_message, elk_trace_id, started_at, ended_at
) VALUES
    (
        'run-rt-202603020900',
        'travel-realtime-ingest',
        'REALTIME',
        'SCHEDULE',
        'jupiter-realtime-01',
        'travel_place_source_snapshot',
        'SUCCEEDED',
        6984,
        39,
        18320,
        '20개 가게, 19개 구 지표 적재 완료',
        'elk-rt-202603020900',
        '2026-03-02 09:00:00',
        '2026-03-02 09:00:18'
    ),
    (
        'run-rt-202603020905',
        'travel-realtime-ingest',
        'REALTIME',
        'SCHEDULE',
        'jupiter-realtime-01',
        'travel_place_source_snapshot',
        'RUNNING',
        1412,
        0,
        NULL,
        '가게 단위 실시간 snapshot 생성 중',
        'elk-rt-202603020905',
        '2026-03-02 09:05:00',
        NULL
    ),
    (
        'run-daily-202603020200',
        'travel-daily-rollup',
        'DAILY',
        'SCHEDULE',
        'jupiter-daily-01',
        'travel_district_live_metric',
        'SUCCEEDED',
        6984,
        19,
        146221,
        '전일 구 단위 여행 집계 반영 완료',
        'elk-daily-202603020200',
        '2026-03-02 02:00:00',
        '2026-03-02 02:02:26'
    );

INSERT IGNORE INTO batch_run_event (id, batch_run_id, event_time, log_level, step_name, message, payload_json) VALUES
    (
        1,
        1,
        '2026-03-02 09:00:03',
        'INFO',
        'extract',
        '가게 단위 실시간 원천 snapshot을 생성했습니다.',
        '{"source":"travel_place_source_snapshot","places":20,"districts":19}'
    ),
    (
        2,
        1,
        '2026-03-02 09:00:11',
        'INFO',
        'transform',
        '가게/구 단위 실시간 지표 집계를 완료했습니다.',
        '{"places":20,"districts":19,"aggregationWindow":"5m"}'
    ),
    (
        3,
        1,
        '2026-03-02 09:00:18',
        'INFO',
        'load',
        'travel_place_live_metric 및 travel_district_live_metric 업서트를 완료했습니다.',
        '{"placeTable":"travel_place_live_metric","districtTable":"travel_district_live_metric","upsertedPlaceRows":20,"upsertedDistrictRows":19}'
    ),
    (
        4,
        2,
        '2026-03-02 09:05:04',
        'INFO',
        'extract',
        '가게 단위 실시간 snapshot 생성 중입니다.',
        '{"source":"travel_place_source_snapshot","records":1412}'
    ),
    (
        5,
        3,
        '2026-03-02 02:00:29',
        'INFO',
        'extract',
        '전일 구 단위 실시간 적재 데이터를 스캔했습니다.',
        '{"source":"travel_district_live_metric","rows":6984}'
    ),
    (
        6,
        3,
        '2026-03-02 02:02:26',
        'INFO',
        'load',
        'travel_district_daily_summary 적재를 완료했습니다.',
        '{"table":"travel_district_daily_summary","upsertedRows":19}'
    );

INSERT IGNORE INTO travel_live_metric (
    metric_timestamp, region_code, visitor_count, search_count, booking_count, revenue_amount,
    foreign_visitor_count, local_visitor_count
) VALUES
    ('2026-03-02 08:55:00', 'SEOUL', 2180, 6420, 402, 51800000.00, 360, 1820),
    ('2026-03-02 08:55:00', 'BUSAN', 1460, 3980, 244, 30200000.00, 210, 1250),
    ('2026-03-02 08:55:00', 'JEJU', 1280, 3520, 286, 46800000.00, 330, 950),
    ('2026-03-02 08:55:00', 'GANGWON', 980, 2710, 160, 22100000.00, 64, 916),
    ('2026-03-02 08:55:00', 'JEONJU', 730, 1840, 114, 12800000.00, 32, 698),
    ('2026-03-02 09:00:00', 'SEOUL', 2265, 6580, 417, 53100000.00, 372, 1893),
    ('2026-03-02 09:00:00', 'BUSAN', 1515, 4075, 251, 30950000.00, 214, 1301),
    ('2026-03-02 09:00:00', 'JEJU', 1342, 3612, 294, 47900000.00, 341, 1001),
    ('2026-03-02 09:00:00', 'GANGWON', 1018, 2794, 164, 22800000.00, 69, 949),
    ('2026-03-02 09:00:00', 'JEONJU', 754, 1904, 119, 13350000.00, 36, 718),
    ('2026-03-02 09:05:00', 'SEOUL', 2310, 6715, 423, 53950000.00, 381, 1929),
    ('2026-03-02 09:05:00', 'BUSAN', 1544, 4142, 258, 31520000.00, 217, 1327),
    ('2026-03-02 09:05:00', 'JEJU', 1384, 3698, 301, 48640000.00, 348, 1036),
    ('2026-03-02 09:05:00', 'GANGWON', 1041, 2844, 169, 23300000.00, 73, 968),
    ('2026-03-02 09:05:00', 'JEONJU', 772, 1941, 124, 13660000.00, 39, 733);

INSERT IGNORE INTO travel_daily_summary (
    stat_date, region_code, visitor_count, booking_count, revenue_amount, avg_stay_minutes,
    hotel_occupancy_rate, yoy_change_rate, foreign_visitor_count, local_visitor_count
) VALUES
    ('2026-02-26', 'SEOUL', 18240, 3284, 418000000.00, 238, 71.20, 6.80, 2880, 15360),
    ('2026-02-26', 'BUSAN', 12510, 2141, 276000000.00, 264, 68.10, 5.20, 1764, 10746),
    ('2026-02-26', 'JEJU', 11320, 2410, 359000000.00, 322, 74.80, 9.10, 2950, 8370),
    ('2026-02-26', 'GANGWON', 9010, 1480, 182000000.00, 289, 61.40, 4.60, 612, 8398),
    ('2026-02-26', 'JEONJU', 6540, 962, 102000000.00, 215, 58.90, 3.80, 248, 6292),
    ('2026-02-27', 'SEOUL', 18710, 3362, 429000000.00, 241, 72.40, 7.10, 2942, 15768),
    ('2026-02-27', 'BUSAN', 12804, 2208, 281000000.00, 266, 68.80, 5.50, 1808, 10996),
    ('2026-02-27', 'JEJU', 11640, 2474, 366000000.00, 325, 75.30, 9.40, 3018, 8622),
    ('2026-02-27', 'GANGWON', 9221, 1516, 186000000.00, 292, 62.00, 4.90, 628, 8593),
    ('2026-02-27', 'JEONJU', 6688, 985, 105000000.00, 218, 59.50, 4.10, 254, 6434),
    ('2026-02-28', 'SEOUL', 19140, 3441, 438000000.00, 244, 73.60, 7.30, 3010, 16130),
    ('2026-02-28', 'BUSAN', 13098, 2252, 287000000.00, 269, 69.20, 5.80, 1836, 11262),
    ('2026-02-28', 'JEJU', 11886, 2512, 372000000.00, 327, 75.80, 9.80, 3072, 8814),
    ('2026-02-28', 'GANGWON', 9392, 1558, 190000000.00, 295, 62.70, 5.10, 646, 8746),
    ('2026-02-28', 'JEONJU', 6810, 1012, 108000000.00, 220, 60.10, 4.40, 261, 6549),
    ('2026-03-01', 'SEOUL', 19780, 3564, 451000000.00, 247, 74.50, 7.90, 3142, 16638),
    ('2026-03-01', 'BUSAN', 13444, 2311, 296000000.00, 273, 70.10, 6.20, 1881, 11563),
    ('2026-03-01', 'JEJU', 12140, 2581, 384000000.00, 331, 76.20, 10.20, 3128, 9012),
    ('2026-03-01', 'GANGWON', 9682, 1614, 197000000.00, 301, 63.50, 5.60, 668, 9014),
    ('2026-03-01', 'JEONJU', 7018, 1044, 112000000.00, 224, 60.90, 4.90, 272, 6746),
    ('2026-03-02', 'SEOUL', 20120, 3622, 459000000.00, 249, 75.10, 8.20, 3214, 16906),
    ('2026-03-02', 'BUSAN', 13710, 2368, 302000000.00, 276, 70.60, 6.50, 1910, 11800),
    ('2026-03-02', 'JEJU', 12422, 2640, 392000000.00, 334, 76.90, 10.80, 3185, 9237),
    ('2026-03-02', 'GANGWON', 9918, 1649, 203000000.00, 304, 64.20, 6.10, 684, 9234),
    ('2026-03-02', 'JEONJU', 7194, 1088, 116000000.00, 227, 61.20, 5.10, 279, 6915);

DELETE FROM food_show_entry;
DELETE FROM food_venue;
DELETE FROM food_participant;
DELETE FROM food_category;
DELETE FROM food_show;

INSERT INTO food_show (
    slug, title, subtitle, network_name, premiere_label, official_participant_count, description, hero_note, sort_order
) VALUES
    (
        'culinary-class-wars-1',
        '흑백요리사: 요리 계급 전쟁',
        '시즌 1 · 2024',
        'Netflix',
        '요리 계급 전쟁의 시작',
        100,
        '넷플릭스 공식 소개 기준 시즌 1에는 100명의 셰프가 참가했습니다. 아카이브에는 실제 식당 또는 활동 브랜드가 확인되는 대표 참가자만 선별해 담았습니다.',
        '공식 참가자 100명 중 검증 가능한 대표 셰프 중심 큐레이션',
        1
    ),
    (
        'culinary-class-wars-2',
        '흑백요리사 2',
        '시즌 2 · 2025',
        'Netflix',
        '새 규칙과 재도전 셰프가 더해진 시즌 2',
        100,
        '넷플릭스 공식 예고와 공개 라인업 기사 기준으로 실명이 확인된 셰프만 수록했습니다.',
        '공식 참가자 100명 중 공개 라인업과 활동 정보가 확인된 셰프 중심',
        2
    )
ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    subtitle = VALUES(subtitle),
    network_name = VALUES(network_name),
    premiere_label = VALUES(premiere_label),
    official_participant_count = VALUES(official_participant_count),
    description = VALUES(description),
    hero_note = VALUES(hero_note),
    sort_order = VALUES(sort_order);

INSERT INTO food_category (slug, name, description, sort_order) VALUES
    ('korean', '한식', '코스, 숯불, 제철 한식 셰프', 1),
    ('chinese', '중식', '정통 중식과 화교 계열 셰프', 2),
    ('japanese', '일식', '우동, 이자카야, 일식 다이닝', 3),
    ('italian', '이탈리안', '파스타와 이탈리안 파인 다이닝', 4),
    ('french', '프렌치', '소스와 테크닉이 강한 프렌치', 5),
    ('modern', '컨템포러리', '장르 혼합형 파인 다이닝', 6),
    ('vegan', '비건·사찰', '사찰음식, 식물성 중심', 7),
    ('media', '방송·브랜드', '방송 활동과 브랜드 중심으로 알려진 셰프', 8)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    sort_order = VALUES(sort_order);

INSERT INTO food_participant (
    slug, display_name, persona_label, role_label, one_liner
) VALUES
    ('choi-kangrok', '최강록', '흑백요리사 1', '셰프', '요리 서사와 캐릭터가 강한 모던 다이닝 셰프'),
    ('im-taehoon', '임태훈', '흑백요리사 1', '셰프', '철가방 요리사로 불리며 중식 존재감을 만든 참가자'),
    ('kang-seungwon', '강승원', '흑백요리사 1', '셰프', '트리플스타라는 별명으로 화제가 된 파인 다이닝 셰프'),
    ('yoon-namno', '윤남노', '흑백요리사 1', '셰프', '디핀 옥수로 연결되는 컨템포러리 셰프'),
    ('choi-hyunsuk', '최현석', '흑백요리사 1', '셰프', '방송과 업장을 모두 이끄는 이탈리안 셰프'),
    ('yeo-gyeongrae', '여경래', '흑백요리사 1', '셰프', '중식 거장으로 분류되는 대표 참가자'),
    ('nam-jeongseok', '남정석', '흑백요리사 1', '셰프', '채소 중심 코스로 알려진 셰프'),
    ('fabrizio-ferrari', '파브리', '흑백요리사 1', '셰프', '이탈리아 출신 스타 셰프'),
    ('jung-hoyoung', '정호영', '흑백요리사 2', '셰프', '우동과 이자카야 장르에서 강한 인지도를 가진 셰프'),
    ('son-jongwon', '손종원', '흑백요리사 2', '셰프', '이타닉 가든과 라망 시크레로 알려진 파인 다이닝 셰프'),
    ('hudokjuk', '후덕죽', '흑백요리사 2', '셰프', '호텔 중식을 대표하는 셰프'),
    ('seonjae', '선재스님', '흑백요리사 2', '셰프', '사찰음식 전파자로 유명한 참가자'),
    ('sam-kim', '샘 킴', '흑백요리사 2', '셰프', '방송과 레시피 브랜드 활동으로 널리 알려진 이탈리안 셰프'),
    ('raymon-kim', '레이먼 킴', '흑백요리사 2', '셰프', 'TV와 외식 브랜드 활동을 병행하는 서양식 셰프')
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    persona_label = VALUES(persona_label),
    role_label = VALUES(role_label),
    one_liner = VALUES(one_liner);

INSERT INTO food_venue (
    slug, venue_name, venue_type, area_label, place_url, source_url, source_name, highlight_note
) VALUES
    ('neo', '네오', '레스토랑', '서울', 'https://search.naver.com/search.naver?query=최강록+네오', 'https://search.naver.com/search.naver?query=흑백요리사+최강록+네오', '서울신문', '최강록 셰프와 함께 다시 회자된 업장'),
    ('doryang', '도량', '중식당', '서울', 'https://search.naver.com/search.naver?query=임태훈+도량', 'https://search.naver.com/search.naver?query=흑백요리사+임태훈+도량', '서울신문', '철가방 요리사로 화제를 모은 중식 업장'),
    ('trid', '트리드', '파인 다이닝', '서울 강남', 'https://search.naver.com/search.naver?query=강승원+트리드', 'https://search.naver.com/search.naver?query=흑백요리사+강승원+트리드', '서울신문', '강승원 셰프의 파인 다이닝 무드가 드러나는 공간'),
    ('dippin-oksu', '디핀 옥수', '다이닝 바', '서울 옥수', 'https://search.naver.com/search.naver?query=윤남노+디핀옥수', 'https://search.naver.com/search.naver?query=흑백요리사+윤남노+디핀옥수', '서울신문', '윤남노 셰프의 감각적인 코스를 찾는 수요가 높은 곳'),
    ('choi-dot', '쵸이닷', '레스토랑', '서울 청담', 'https://search.naver.com/search.naver?query=최현석+쵸이닷', 'https://search.naver.com/search.naver?query=흑백요리사+최현석+쵸이닷', '캐치테이블', '최현석 셰프 대표 업장으로 가장 자주 언급되는 곳'),
    ('hongbogak', '홍보각', '중식당', '서울', 'https://search.naver.com/search.naver?query=여경래+홍보각', 'https://search.naver.com/search.naver?query=흑백요리사+여경래+홍보각', '캐치테이블', '여경래 셰프의 대표 중식 업장'),
    ('localit', '로컬릿', '비건 레스토랑', '서울', 'https://search.naver.com/search.naver?query=남정석+로컬릿', 'https://search.naver.com/search.naver?query=흑백요리사+남정석+로컬릿', '식신', '비건 파인 다이닝으로 자주 소개되는 업장'),
    ('fabri-kitchen', '파브리키친', '레스토랑', '서울 용산', 'https://search.naver.com/search.naver?query=파브리+파브리키친', 'https://search.naver.com/search.naver?query=흑백요리사+파브리키친', '파이낸셜뉴스', '파브리 셰프의 캐주얼한 이탈리안 공간'),
    ('udon-kaden', '우동 카덴', '우동 전문점', '서울 연희', 'https://search.naver.com/search.naver?query=정호영+우동카덴', 'https://search.naver.com/search.naver?query=흑백요리사2+정호영+우동카덴', '마켓컬리', '정호영 셰프를 대표하는 우동 브랜드'),
    ('eatanic-garden', '이타닉 가든', '파인 다이닝', '서울', 'https://search.naver.com/search.naver?query=손종원+이타닉가든', 'https://search.naver.com/search.naver?query=흑백요리사2+손종원+이타닉가든', '연합뉴스', '손종원 셰프의 현재 대표 업장으로 언급된 곳'),
    ('palseon', '팔선', '호텔 중식당', '서울', 'https://search.naver.com/search.naver?query=후덕죽+팔선', 'https://search.naver.com/search.naver?query=흑백요리사2+후덕죽+팔선', '연합뉴스', '후덕죽 셰프의 호텔 중식 경력을 보여주는 업장'),
    ('seonjae-center', '선재사찰음식문화연구원', '연구원', '서울', 'https://search.naver.com/search.naver?query=선재스님+사찰음식문화연구원', 'https://search.naver.com/search.naver?query=흑백요리사2+선재스님', '한경닷컴', '선재스님의 사찰음식 활동 거점'),
    ('sam-kim-brand', '샘 킴 브랜드 활동', '브랜드·방송', '서울', 'https://search.naver.com/search.naver?query=샘킴+흑백요리사2', 'https://about.netflix.com/news/culinary-class-wars-season-2-premieres-december-16', 'About Netflix', '넷플릭스 시즌 2 공식 라인업에 포함된 셰프'),
    ('raymon-kim-brand', '레이먼 킴 브랜드 활동', '브랜드·방송', '서울', 'https://search.naver.com/search.naver?query=레이먼킴+흑백요리사2', 'https://about.netflix.com/news/culinary-class-wars-season-2-premieres-december-16', 'About Netflix', '넷플릭스 시즌 2 공식 라인업에 포함된 셰프')
ON DUPLICATE KEY UPDATE
    venue_name = VALUES(venue_name),
    venue_type = VALUES(venue_type),
    area_label = VALUES(area_label),
    place_url = VALUES(place_url),
    source_url = VALUES(source_url),
    source_name = VALUES(source_name),
    highlight_note = VALUES(highlight_note);

INSERT INTO food_show_entry (
    show_slug, category_slug, participant_slug, venue_slug, cuisine_label, signature_item,
    short_note, program_note, source_name, source_url, source_note, sort_order, featured
) VALUES
    ('culinary-class-wars-1', 'modern', 'choi-kangrok', 'neo', '모던 코스', '제철 코스 요리', '서사와 캐릭터로 가장 자주 다시 소환되는 시즌 1 우승권 셰프', '시즌 1 핵심 화제 참가자', '서울신문', 'https://search.naver.com/search.naver?query=흑백요리사+최강록+네오', '기사와 검색 결과를 바탕으로 업장 연결', 1, b'1'),
    ('culinary-class-wars-1', 'chinese', 'im-taehoon', 'doryang', '중식', '불향 볶음과 면 요리', '철가방 요리사라는 캐릭터로 가장 대중적으로 회자된 참가자', '캐릭터성이 강한 시즌 1 참가자', '서울신문', 'https://search.naver.com/search.naver?query=흑백요리사+임태훈+도량', '기사와 검색 결과를 바탕으로 업장 연결', 2, b'1'),
    ('culinary-class-wars-1', 'modern', 'kang-seungwon', 'trid', '파인 다이닝', '디너 코스', '트리플스타라는 별명과 함께 업장 검색 수요가 높았던 셰프', '파인 다이닝 관심층이 많이 찾는 참가자', '서울신문', 'https://search.naver.com/search.naver?query=흑백요리사+강승원+트리드', '기사와 검색 결과를 바탕으로 업장 연결', 3, b'1'),
    ('culinary-class-wars-1', 'modern', 'yoon-namno', 'dippin-oksu', '컨템포러리', '디핀 코스', '감각적인 플레이팅과 옥수 상권으로 연결되는 셰프', '업장 감도가 중요한 시즌 1 참가자', '서울신문', 'https://search.naver.com/search.naver?query=흑백요리사+윤남노+디핀옥수', '기사와 검색 결과를 바탕으로 업장 연결', 4, b'1'),
    ('culinary-class-wars-1', 'italian', 'choi-hyunsuk', 'choi-dot', '이탈리안', '시그니처 파스타', '방송 친화력과 업장 인지도가 동시에 높은 대표 셰프', '스타 셰프 축의 대표 참가자', '캐치테이블', 'https://search.naver.com/search.naver?query=흑백요리사+최현석+쵸이닷', '예약 플랫폼 언급 기준 업장 연결', 5, b'1'),
    ('culinary-class-wars-1', 'chinese', 'yeo-gyeongrae', 'hongbogak', '중식', '정통 중식 코스', '거장 포지션으로 시즌의 무게를 잡아준 참가자', '정통 중식 카테고리 대표', '캐치테이블', 'https://search.naver.com/search.naver?query=흑백요리사+여경래+홍보각', '예약 플랫폼 언급 기준 업장 연결', 6, b'1'),
    ('culinary-class-wars-1', 'vegan', 'nam-jeongseok', 'localit', '비건 파인 다이닝', '채소 코스', '식물성 코스 요리로 차별화된 셰프', '비건·채식 축을 대표하는 시즌 1 참가자', '식신', 'https://search.naver.com/search.naver?query=흑백요리사+남정석+로컬릿', '맛집 기사와 검색 결과를 바탕으로 업장 연결', 7, b'1'),
    ('culinary-class-wars-1', 'italian', 'fabrizio-ferrari', 'fabri-kitchen', '이탈리안', '파스타와 화덕 요리', '해외 셰프 캐릭터와 캐주얼 업장 접근성을 동시에 갖춘 참가자', '국제 셰프 축의 대표 참가자', '파이낸셜뉴스', 'https://search.naver.com/search.naver?query=흑백요리사+파브리키친', '기사와 검색 결과를 바탕으로 업장 연결', 8, b'1'),
    ('culinary-class-wars-2', 'japanese', 'jung-hoyoung', 'udon-kaden', '일식', '붓카케 우동', '우동 카덴으로 대표되는 일식 장르 셰프', '시즌 2 공개 라인업 중 인지도 높은 참가자', '마켓컬리', 'https://search.naver.com/search.naver?query=흑백요리사2+정호영+우동카덴', '공개 기사와 검색 결과를 바탕으로 업장 연결', 1, b'1'),
    ('culinary-class-wars-2', 'korean', 'son-jongwon', 'eatanic-garden', '한식 파인 다이닝', '시즌 코스', '한식 기반 파인 다이닝을 대표하는 셰프', '시즌 2 백수저 라인업으로 보도된 참가자', '연합뉴스', 'https://search.naver.com/search.naver?query=흑백요리사2+손종원+이타닉가든', '공개 기사와 검색 결과를 바탕으로 업장 연결', 2, b'1'),
    ('culinary-class-wars-2', 'chinese', 'hudokjuk', 'palseon', '호텔 중식', '불도장', '호텔 중식 코스를 바로 떠올리게 하는 참가자', '시즌 2 백수저 라인업으로 보도된 참가자', '연합뉴스', 'https://search.naver.com/search.naver?query=흑백요리사2+후덕죽+팔선', '공개 기사와 검색 결과를 바탕으로 업장 연결', 3, b'1'),
    ('culinary-class-wars-2', 'vegan', 'seonjae', 'seonjae-center', '사찰음식', '제철 나물 한상', '사찰음식을 메인 카테고리로 끌어올릴 수 있는 참가자', '시즌 2 화제성 높은 신규 참가자', '한경닷컴', 'https://search.naver.com/search.naver?query=흑백요리사2+선재스님', '공개 기사와 검색 결과를 바탕으로 업장 연결', 4, b'1'),
    ('culinary-class-wars-2', 'italian', 'sam-kim', 'sam-kim-brand', '이탈리안', '브랜드 레시피와 방송 메뉴', '시즌 2 공식 라인업 공개에 포함된 방송 친화형 셰프', '넷플릭스 공식 시즌 2 화이트 스푼 라인업', 'About Netflix', 'https://about.netflix.com/news/culinary-class-wars-season-2-premieres-december-16', '공식 라인업 기사 기준 수록', 5, b'1'),
    ('culinary-class-wars-2', 'media', 'raymon-kim', 'raymon-kim-brand', '브랜드·방송', '방송 대표 메뉴', 'TV와 외식 브랜드 활동으로 인지도가 높은 시즌 2 공식 참가 셰프', '넷플릭스 공식 시즌 2 화이트 스푼 라인업', 'About Netflix', 'https://about.netflix.com/news/culinary-class-wars-season-2-premieres-december-16', '공식 라인업 기사 기준 수록', 6, b'1')
ON DUPLICATE KEY UPDATE
    category_slug = VALUES(category_slug),
    cuisine_label = VALUES(cuisine_label),
    signature_item = VALUES(signature_item),
    short_note = VALUES(short_note),
    program_note = VALUES(program_note),
    source_name = VALUES(source_name),
    source_url = VALUES(source_url),
    source_note = VALUES(source_note),
    sort_order = VALUES(sort_order),
    featured = VALUES(featured);

UPDATE notebook_instances
SET display_name = 'foodshow-producer'
WHERE slug = 'custom-snap';

UPDATE notebook_instances
SET display_name = 'foodshow-enricher'
WHERE slug = 'react-spring-test';
