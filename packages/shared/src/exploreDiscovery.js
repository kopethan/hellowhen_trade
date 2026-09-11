export const EXPLORE_DISCOVERY_KIND_ORDER = ['trade', 'place', 'need', 'plan', 'offer'];

export function createExploreDiscoverySeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function hashExploreDiscoveryValue(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildBalancedExploreDiscoveryFeed(groups, seed) {
  const queues = Object.fromEntries(EXPLORE_DISCOVERY_KIND_ORDER.map((kind) => [
    kind,
    [...groups[kind]].sort((left, right) => {
      const rankDelta = hashExploreDiscoveryValue(`${seed}:${kind}:${left.key}`) - hashExploreDiscoveryValue(`${seed}:${kind}:${right.key}`);
      return rankDelta || left.key.localeCompare(right.key);
    }),
  ]));

  const mixed = [];
  let cycle = 0;
  let previousKind = null;

  while (EXPLORE_DISCOVERY_KIND_ORDER.some((kind) => queues[kind].length > 0)) {
    const availableKinds = EXPLORE_DISCOVERY_KIND_ORDER.filter((kind) => queues[kind].length > 0);
    const cycleKinds = [...availableKinds].sort((left, right) => (
      hashExploreDiscoveryValue(`${seed}:${cycle}:${left}`) - hashExploreDiscoveryValue(`${seed}:${cycle}:${right}`)
    ));

    if (previousKind && cycleKinds.length > 1 && cycleKinds[0] === previousKind) {
      const alternateIndex = cycleKinds.findIndex((kind) => kind !== previousKind);
      if (alternateIndex > 0) {
        const [alternate] = cycleKinds.splice(alternateIndex, 1);
        if (alternate) cycleKinds.unshift(alternate);
      }
    }

    for (const kind of cycleKinds) {
      const item = queues[kind].shift();
      if (!item) continue;
      mixed.push(item);
      previousKind = kind;
    }
    cycle += 1;
  }

  return mixed;
}
