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

export function getStepProgress(session) {
  const scenario = Array.isArray(session?.scenario) ? session.scenario : [];
  const stepTotal = scenario.length;

  if (!stepTotal) {
    return {
      stepCurrent: 0,
      stepTotal: 0
    };
  }

  const normalizedIndex = Math.min(
    Math.max(Math.floor(Number(session?.currentStepIndex) || 0), 0),
    stepTotal - 1
  );

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

  const normalizedIndex = Math.min(
    Math.max(Math.floor(Number(session?.currentStepIndex) || 0), 0),
    scenario.length - 1
  );
  const currentStep = scenario[normalizedIndex];
  const focusRepeatCurrent = currentStep?.type === 'work'
    ? countWorkStepsUpTo(scenario, normalizedIndex)
    : countWorkStepsUpTo(scenario, normalizedIndex - 1);

  return {
    focusRepeatCurrent: Math.max(0, Math.min(focusRepeatCurrent, focusRepeatTotal)),
    focusRepeatTotal
  };
}
