import { SignalCardMock, type FeedCard } from './signal-card-mock';

// Fictional companies and people, our own signal taxonomy. No real customers.
const cards: FeedCard[] = [
  {
    kind: 'update',
    label: 'Product update',
    title: 'SignalScout v3 shipped, batch dossiers, webhooks, and CSV delivery.',
    badges: ['Shipping', 'Product update'],
  },
  {
    kind: 'post',
    name: '@mreyes',
    role: 'Founder, Northwind Robotics',
    time: '8h ago',
    content: 'Just incorporated in Delaware. Building something new in warehouse automation. More soon.',
    likes: 89,
    comments: 15,
    reposts: 21,
    badges: ['Expansion'],
    tag: 'Signal',
  },
  {
    kind: 'source',
    icon: 'globe',
    domain: 'atlasfreight.com/careers',
    time: '4h ago',
    title: 'Atlas Freight added 3 GTM roles to its careers page.',
    subtitle: 'Head of Revenue Ops, Senior AE, SDR Manager',
    badges: ['Hiring', 'Expansion'],
  },
  {
    kind: 'source',
    icon: 'doc',
    domain: 'marlowehealth.com/resources',
    time: '10h ago',
    title: 'Marlowe Health Q4 spend report, enterprise growth up 180 percent.',
    subtitle: 'PDF whitepaper, 12 pages',
    badges: ['Report'],
  },
  {
    kind: 'post',
    name: 'Dana Okafor',
    role: 'Staff Engineer, Cobalt Labs',
    time: '12h ago',
    content:
      'Our GTM team went from two hours of manual research per prospect to under a minute. That is real pipeline per rep.',
    likes: 412,
    comments: 56,
    reposts: 33,
    badges: ['Buying intent', 'Case study'],
    tag: 'Customer',
  },
  {
    kind: 'source',
    icon: 'globe',
    domain: 'lu.ma/sf-gtm-meetup',
    time: '1d ago',
    title: 'SF GTM Meetup, the future of outbound.',
    subtitle: 'March 22, Dogpatch, 45 RSVPs',
    badges: ['Event'],
  },
  {
    kind: 'source',
    icon: 'git',
    domain: 'github.com/cobalt-labs',
    time: '7h ago',
    title: 'cobalt-labs cut release v3.0.0 with a new public API.',
    subtitle: 'New: import signals directly from the API',
    badges: ['GitHub release', 'Partnership'],
  },
  {
    kind: 'post',
    name: 'Priya Raman',
    role: 'VP Revenue, Junction Analytics',
    time: '1h ago',
    content:
      'Excited to share we closed our Series B. Growing the GTM team fast, if you build in revenue tooling let us talk.',
    likes: 284,
    comments: 42,
    reposts: 27,
    badges: ['Funding', 'Announcement'],
    tag: 'Announcement',
  },
  {
    kind: 'source',
    icon: 'doc',
    domain: 'sec.gov/edgar',
    time: '2h ago',
    title: 'Northwind Robotics filed a Form D reporting a 24M dollar raise.',
    subtitle: 'Reg D 506(b), new filing',
    badges: ['SEC filing', 'Funding'],
  },
  {
    kind: 'source',
    icon: 'globe',
    domain: 'techpress.example/news',
    time: '2h ago',
    title: 'Vellum Logistics raises 12M Series A to scale carrier routing.',
    subtitle: 'The developer-first logistics startup is growing fast',
    badges: ['News', 'Funding'],
  },
  {
    kind: 'post',
    name: '@brightwall',
    role: 'Brightwall Energy',
    time: '3h ago',
    content: 'Just shipped our new public API docs. Onboarding is much faster now, give them a try.',
    likes: 156,
    comments: 23,
    reposts: 32,
    badges: ['Product launch', 'Shipping'],
    tag: 'Product',
  },
];

/** Static, non-animated feed stream that fades out at the top edge. */
export function SignalFeedMock() {
  return (
    <div className="relative h-[620px] space-y-3 overflow-hidden">
      {cards.map((c, i) => (
        <div key={i} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
          <SignalCardMock card={c} />
        </div>
      ))}
    </div>
  );
}
