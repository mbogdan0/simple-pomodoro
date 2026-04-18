function countWorkStepsUpTo(scenario, endIndexInclusive) {
  if (!Array.isArray(scenario) || endIndexInclusive < 0) {
    return 0;
  }

  let count = 0;

  for (let index = 0; index <= endIndexInclusive && index < scenario.length; index += 1) {
    if (scenario[index]?.type === 'work') {
      count += 1;
    }
  }

  return count;
}

function getNormalizedStepIndex(session, scenario) {
  if (!scenario.length) {
    return 0;
  }

  return Math.min(
    Math.max(Math.floor(Number(session?.currentStepIndex) || 0), 0),
    scenario.length - 1
  );
}

function isBreakStepType(type) {
  return type === 'shortBreak' || type === 'longBreak';
}

function resolveDotState(stepIndex, currentStepIndex, status) {
  if (stepIndex < currentStepIndex) {
    return 'done';
  }

  if (stepIndex > currentStepIndex) {
    return 'pending';
  }

  return status === 'completed_waiting_next' ? 'done' : 'active';
}

function findBreakStepIndex(scenario, focusStepIndex, nextFocusStepIndex) {
  for (let index = focusStepIndex + 1; index < nextFocusStepIndex; index += 1) {
    if (isBreakStepType(scenario[index]?.type)) {
      return index;
    }
  }

  return -1;
}

export function getStepProgress(session) {
  const scenario = Array.isArray(session?.scenario) ? session.scenario : [];
  const stepTotal = scenario.length;

  if (!stepTotal) {
    return {
      stepCurrent: 0,
      stepTotal: 0
    };
  }

  const normalizedIndex = getNormalizedStepIndex(session, scenario);

  return {
    stepCurrent: normalizedIndex + 1,
    stepTotal
  };
}

export function getFocusRepeatProgress(session) {
  const scenario = Array.isArray(session?.scenario) ? session.scenario : [];
  const focusRepeatTotal = scenario.reduce(
    (count, step) => (step?.type === 'work' ? count + 1 : count),
    0
  );

  if (!focusRepeatTotal) {
    return {
      focusRepeatCurrent: 0,
      focusRepeatTotal: 0
    };
  }

  const normalizedIndex = getNormalizedStepIndex(session, scenario);
  const currentStep = scenario[normalizedIndex];
  const focusRepeatCurrent = currentStep?.type === 'work'
    ? countWorkStepsUpTo(scenario, normalizedIndex)
    : countWorkStepsUpTo(scenario, normalizedIndex - 1);

  return {
    focusRepeatCurrent: Math.max(0, Math.min(focusRepeatCurrent, focusRepeatTotal)),
    focusRepeatTotal
  };
}

export function getCycleRepeatDots(session) {
  const scenario = Array.isArray(session?.scenario) ? session.scenario : [];
  const focusIndices = [];

  for (let index = 0; index < scenario.length; index += 1) {
    if (scenario[index]?.type === 'work') {
      focusIndices.push(index);
    }
  }

  if (!focusIndices.length) {
    return [];
  }

  const currentStepIndex = getNormalizedStepIndex(session, scenario);
  const status = session?.status;

  return focusIndices.map((focusStepIndex, repeatIndex) => {
    const nextFocusStepIndex = focusIndices[repeatIndex + 1] ?? scenario.length;
    const breakStepIndex = findBreakStepIndex(scenario, focusStepIndex, nextFocusStepIndex);

    return {
      breakState:
        breakStepIndex >= 0
          ? resolveDotState(breakStepIndex, currentStepIndex, status)
          : 'pending',
      focusState: resolveDotState(focusStepIndex, currentStepIndex, status),
      id: scenario[focusStepIndex]?.id ?? `repeat-${repeatIndex}`
    };
  });
}
