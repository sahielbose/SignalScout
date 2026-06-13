import { SignalCardMock, type MockSignal } from './signal-card-mock';

const signals: MockSignal[] = [
  { source: 'SEC EDGAR', time: '2h ago', summary: 'Northwind Robotics filed a Form D reporting a 24M dollar raise.', type: 'Funding' },
  { source: 'Greenhouse', time: '4h ago', summary: 'Atlas Freight opened nine roles across platform and data engineering.', type: 'Hiring' },
  { source: 'Company site', time: '6h ago', summary: 'Marlowe Health announced a second office in Austin.', type: 'Expansion' },
  {
    source: 'GitHub',
    time: '7h ago',
    summary: 'cobalt-labs cut release v3.0.0 with a new public API.',
    type: 'GitHub release',
    person: { name: 'Dana Okafor', meta: '12 commits' },
  },
  { source: 'Lever', time: '9h ago', summary: 'Brightwall Energy posted a VP of Revenue Operations search.', type: 'Hiring' },
  { source: 'Press', time: '11h ago', summary: 'Junction Analytics launched a self-serve product tier.', type: 'Product launch' },
  { source: 'Public web', time: '1d ago', summary: 'Vellum Logistics signed a partnership with a regional carrier.', type: 'Partnership' },
];

/** Static, non-animated feed stream that fades out at the top edge. */
export function SignalFeedMock() {
  return (
    <div className="feed-fade relative h-[560px] space-y-3 overflow-hidden">
      {signals.map((s) => (
        <SignalCardMock key={`${s.source}-${s.time}`} signal={s} />
      ))}
    </div>
  );
}
