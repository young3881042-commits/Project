function PlannerIcon({ type }) {
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7"></circle>
        <path d="m20 20-3.5-3.5"></path>
      </>
    ),
    route: (
      <>
        <circle cx="6" cy="18" r="2.4"></circle>
        <circle cx="18" cy="6" r="2.4"></circle>
        <path d="M8.4 18H12a4 4 0 0 0 0-8h-.4a4 4 0 0 1 0-8H15"></path>
      </>
    ),
    calendar: (
      <>
        <path d="M5 5h14v15H5z"></path>
        <path d="M8 3v4M16 3v4M5 10h14"></path>
      </>
    )
  };

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type] || paths.route}
    </svg>
  );
}

function InlineNotice({ error, fallback }) {
  if (!error) return null;
  return (
    <div className="ltInlineNotice">
      <strong>{fallback ? '잠시만요' : '요청 실패'}</strong>
      <span>{error || '장소 데이터를 불러오고 있어요. 잠시 후 다시 확인해 주세요.'}</span>
    </div>
  );
}

function OptionGroup({ label, value, options, onChange }) {
  return (
    <div className="ltOptionGroup">
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? 'active' : ''}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function DestinationButton({ destination, onSelect }) {
  return (
    <button type="button" onClick={() => onSelect(destination.id)}>
      <strong>{destination.name}</strong>
      <span>{[destination.region, destination.category].filter(Boolean).join(' · ')}</span>
    </button>
  );
}

function SelectedDestinations({ destinations, onRemove }) {
  if (!destinations.length) {
    return <p className="ltPlannerEmptySelection">선택하지 않아도 됩니다. 입력한 지역과 요청사항만으로 코스를 만들 수 있습니다.</p>;
  }

  return (
    <div className="ltSelectedTagRow">
      {destinations.map((destination) => (
        <span key={destination.id} className="ltSelectedTag">
          {destination.name} ({destination.region})
          <button type="button" onClick={() => onRemove(destination.id)} aria-label={`${destination.name} 삭제`}>
            x
          </button>
        </span>
      ))}
    </div>
  );
}

function PlannerGenerateStatus({ generating, error }) {
  if (!generating && !error) return null;

  if (generating) {
    return (
      <div className="ltGenerateStatus running" role="status" aria-live="polite">
        <span className="ltGenerateSpinner" aria-hidden="true" />
        <div>
          <strong>여행 코스를 만들고 있습니다</strong>
          <p>입력한 지역과 요청사항을 바탕으로 하루 동선, 식당, 카페를 정리합니다.</p>
          <div className="ltGenerateSteps" aria-label="생성 진행 상태">
            <span>장소 확인</span>
            <span>시간표 구성</span>
            <span>코스 저장</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ltGenerateStatus error" role="alert" aria-live="assertive">
      <span className="ltGenerateErrorIcon" aria-hidden="true">!</span>
      <div>
        <strong>일정을 만들지 못했습니다</strong>
        <p>{error}</p>
      </div>
    </div>
  );
}

export default function TravelPlannerPage({
  error,
  usingFallback,
  country,
  setCountry,
  countryOptions,
  destSearch,
  setDestSearch,
  showSuggestions,
  setShowDestSuggestions,
  filteredSuggestions,
  suggestedDestinations,
  selectedDestinations,
  selectedDestinationIds,
  toggleDestination,
  startDate,
  setStartDate,
  days,
  setDays,
  travelerCount,
  setTravelerCount,
  mealPreference,
  setMealPreference,
  dayStartTime,
  setDayStartTime,
  dayEndTime,
  setDayEndTime,
  dayRoutes,
  updateDayRoute,
  selectedInterests,
  toggleInterest,
  interests,
  mustVisit,
  setMustVisit,
  avoid,
  setAvoid,
  notes,
  setNotes,
  generating,
  generateError,
  generatedPlan,
  canGenerate,
  selectedSummary,
  submit,
  PlanRouteFacts,
  PlanDayCards
}) {
  return (
    <main className="ltPage ltPlannerSimplePage">
      <section className="ltPageTitle">
        <div>
          <span className="ltEyebrow">계획 만들기</span>
          <h1>지역, 날짜, 요청사항만 입력</h1>
          <p>필요한 정보만 입력하면 엑셀처럼 보기 쉬운 시간표 코스를 만들어 줍니다.</p>
        </div>
      </section>

      <InlineNotice error={error} fallback={usingFallback} />

      <section className="ltPlannerLayout ltPlannerSimpleLayout">
        <form className="ltPlannerForm ltPlannerSimpleForm" onSubmit={submit}>
          <section className="ltPlannerSimpleCard">
            <div className="ltCountrySwitch compact" aria-label="여행 국가">
              {countryOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={country === option.key ? 'active' : ''}
                  onClick={() => {
                    setCountry(option.key);
                    setDestSearch('');
                    setShowDestSuggestions(false);
                  }}
                >
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </button>
              ))}
            </div>

            <label className="ltPlannerSearchLabel">
              <span>어디로 갈까요?</span>
              <div className="ltPlannerSearchBox">
                <PlannerIcon type="search" />
                <input
                  value={destSearch}
                  onChange={(event) => {
                    setDestSearch(event.target.value);
                    setShowDestSuggestions(true);
                  }}
                  onFocus={() => setShowDestSuggestions(true)}
                  placeholder="예: 오사카·교토·USJ, 제주 동쪽, 부산 2박"
                />
              </div>
              {showSuggestions && filteredSuggestions.length > 0 ? (
                <div className="ltAutocompleteDropdown">
                  <p className="ltAutocompleteHint">기존 장소 후보는 선택 사항입니다</p>
                  {filteredSuggestions.map((destination) => (
                    <DestinationButton
                      key={destination.id}
                      destination={destination}
                      onSelect={(id) => {
                        toggleDestination(id);
                        setShowDestSuggestions(false);
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </label>

            {destSearch.trim() && suggestedDestinations.length && selectedDestinations.length ? (
              <div className="ltPlannerSuggestions" aria-label="선택 가능한 기존 장소 후보">
                {suggestedDestinations.map((destination) => (
                  <DestinationButton key={destination.id} destination={destination} onSelect={toggleDestination} />
                ))}
              </div>
            ) : null}

            <div className="ltPlannerSelectionBlock">
              <div className="ltPlannerSimpleTop">
                <span>선택한 여행지</span>
                <strong>{selectedSummary}</strong>
              </div>
              <SelectedDestinations destinations={selectedDestinations} onRemove={toggleDestination} />
            </div>

            <div className="ltPlannerEssentialGrid">
              <label>
                <span>출발일</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label>
                <span>여행 일수</span>
                <input type="number" min="1" max="7" value={days} onChange={(event) => setDays(event.target.value)} />
              </label>
              <label>
                <span>인원</span>
                <input type="number" min="1" max="12" value={travelerCount} onChange={(event) => setTravelerCount(event.target.value)} />
              </label>
            </div>
          </section>

          <details className="ltPlannerOptionalPanel">
            <summary>
              <span>세부 조건</span>
              <strong>선택 입력</strong>
            </summary>
            <div className="ltPlannerOptionalBody">
              <div className="ltInterestGroup">
                <span>관심사</span>
                <div>
                  {interests.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      className={selectedInterests.includes(interest) ? 'active' : ''}
                      onClick={() => toggleInterest(interest)}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ltPlannerEssentialGrid">
                <label>
                  <span>하루 시작</span>
                  <input type="time" value={dayStartTime} onChange={(event) => setDayStartTime(event.target.value)} />
                </label>
                <label>
                  <span>하루 종료</span>
                  <input type="time" value={dayEndTime} onChange={(event) => setDayEndTime(event.target.value)} />
                </label>
                <OptionGroup label="식사" value={mealPreference} options={['상관없음', '지역 맛집', '한식 위주']} onChange={setMealPreference} />
              </div>

              <details className="ltPlannerNestedDetails">
                <summary>일자별 출발·도착</summary>
                <div className="ltDailyRouteBuilder compact">
                  {dayRoutes.map((route, index) => (
                    <fieldset key={route.day}>
                      <legend>{route.day}일차</legend>
                      <label>
                        <span>출발지</span>
                        <input value={route.startPlace} onChange={(event) => updateDayRoute(index, 'startPlace', event.target.value)} placeholder="숙소, 역, 공항" />
                      </label>
                      <label>
                        <span>도착지</span>
                        <input value={route.endPlace} onChange={(event) => updateDayRoute(index, 'endPlace', event.target.value)} placeholder="숙소, 다음 이동지" />
                      </label>
                      <label>
                        <span>출발 시간</span>
                        <input type="time" value={route.departureTime || dayStartTime} onChange={(event) => updateDayRoute(index, 'departureTime', event.target.value)} />
                      </label>
                      <label>
                        <span>도착 시간</span>
                        <input type="time" value={route.arrivalTime || dayEndTime} onChange={(event) => updateDayRoute(index, 'arrivalTime', event.target.value)} />
                      </label>
                    </fieldset>
                  ))}
                </div>
              </details>

              <label>
                <span>꼭 반영할 것</span>
                <textarea value={mustVisit} onChange={(event) => setMustVisit(event.target.value)} placeholder="꼭 가고 싶은 장소, 먹고 싶은 메뉴" />
              </label>
              <label>
                <span>피하고 싶은 것</span>
                <textarea value={avoid} onChange={(event) => setAvoid(event.target.value)} placeholder="긴 도보, 웨이팅, 매운 음식" />
              </label>
              <label>
                <span>요청사항</span>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="도착 시간, 아이 동반 여부 등" />
              </label>
            </div>
          </details>

          <PlannerGenerateStatus generating={generating} error={generateError} />
          <button type="submit" className="ltPrimaryButton ltStickyCta ltPlannerCreateButton" disabled={!canGenerate}>
            <PlannerIcon type={generating ? 'calendar' : 'route'} />
            {generating ? '계획 만드는 중' : generateError ? '다시 만들기' : '계획 만들기'}
          </button>
        </form>

        <aside className="ltPlannerPreview">
          {selectedDestinations.length ? (
          <div className="ltSelectedSummary">
            <h3>선택한 여행지 ({selectedDestinationIds.length})</h3>
            <div className="ltMiniDestList">
              {selectedDestinations.map((destination) => (
                <div key={destination.id} className="ltMiniDestCard">
                  <div>
                    <strong>{destination.name}</strong>
                    <span>{[destination.region, destination.category, destination.address].filter(Boolean).join(' · ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          ) : null}
          {generatedPlan ? (
            <div className="ltGeneratedPreview">
              <h2>{generatedPlan.title}</h2>
              <PlanRouteFacts plan={generatedPlan} />
              <PlanDayCards plan={generatedPlan} />
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
