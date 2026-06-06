import { useEffect, useRef, useState } from 'react';
import { fetchWorkoutPlan, saveWorkoutPlan } from '../api';
import { createDefaultPlan, emptyPlan, normalizePlan } from '../data/workoutPlan';
import { makeId } from '../utils/ids';

export function useWorkoutPlan() {
  const [plan, setPlan] = useState(emptyPlan);
  const [saveState, setSaveState] = useState('loading');
  const hasLoadedPlan = useRef(false);

  useEffect(() => {
    let ignore = false;

    async function loadPlan() {
      try {
        const serverPlan = await fetchWorkoutPlan();

        if (!ignore) {
          setPlan(normalizePlan(serverPlan));
          hasLoadedPlan.current = true;
          setSaveState('saved');
        }
      } catch {
        if (!ignore) {
          setPlan(createDefaultPlan(makeId));
          hasLoadedPlan.current = true;
          setSaveState('offline');
        }
      }
    }

    loadPlan();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedPlan.current) return undefined;

    setSaveState('saving');
    const saveTimer = window.setTimeout(async () => {
      try {
        await saveWorkoutPlan(plan);
        setSaveState('saved');
      } catch {
        setSaveState('offline');
      }
    }, 350);

    return () => window.clearTimeout(saveTimer);
  }, [plan]);

  return { plan, saveState, setPlan };
}
