import { importLegacyTravelDraft, newTravelDraft, TRAVEL_PACES, validateTravelInput, validateTravelPlan } from './travelModel.js';

export function restoreTravelWorkspace(stored, today) {
  const empty = { draft: newTravelDraft(today), jobId: '', input: null, result: null };
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return empty;
  const editable = stored.draft || {};
  const draft = {
    ...importLegacyTravelDraft({
      destinationName: editable.destination, startDate: editable.startDate,
      days: editable.days, interests: editable.interests, notes: editable.requests
    }, today),
    people: Math.min(20, Math.max(1, Math.round(Number(editable.people) || 2))),
    pace: TRAVEL_PACES.includes(editable.pace) ? editable.pace : '보통'
  };
  let input = null, result = null;
  try {
    input = validateTravelInput(stored.input);
    if (stored.result) result = validateTravelPlan(stored.result, input);
  } catch { /* Invalid generated content never replaces an editable draft. */ }
  const jobId = input && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(stored.jobId || '') ? stored.jobId : '';
  return { draft, jobId, input, result: jobId ? result : null };
}
