// Resume an existing job after transient failures; never resubmit the generation.
export function watchTravelJob({ read, onJob, onError, isVisible, schedule = setTimeout, unschedule = clearTimeout }) {
  let stopped = false, inFlight = false, timer, failures = 0, terminal = false;
  function later(delay) { unschedule(timer); timer = schedule(poll, delay); }
  async function poll() {
    if (stopped || terminal || inFlight || !isVisible()) return;
    inFlight = true;
    let job;
    try { job = await read(); }
    catch (error) {
      if (!stopped) {
        failures++;
        const retrying = (!error.status || error.status === 429 || error.status >= 500) && failures <= 3;
        onError(error, retrying);
        if (retrying) later(1800 * 2 ** (failures - 1));
      }
      inFlight = false;
      return;
    }
    if (!stopped) {
      failures = 0;
      terminal = ['completed', 'failed', 'cancelled'].includes(job.state);
      try { onJob(job); } catch (error) { terminal = true; onError(error, false); }
      if (!terminal) later(1800);
    }
    inFlight = false;
  }
  function resume() { unschedule(timer); if (!isVisible()) return; failures = 0; poll(); }
  poll();
  return { resume, stop() { stopped = true; unschedule(timer); } };
}
