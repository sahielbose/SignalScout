import type { IcpDefinition } from '@/lib/types';
import { TAXONOMY_LIST } from './taxonomy';

export const PROMPT_VERSION = 'classify-v1';

export interface IcpForPrompt {
  id: string;
  name: string;
  definition: IcpDefinition;
}

export const CLASSIFIER_SYSTEM = `You classify a single public event about a company or person for a B2B sales team.
Output ONLY JSON matching the schema. Be CONSERVATIVE: when unsure, lower the strength and match fewer ICPs.
A false alarm costs the user's trust, so do not inflate weak signals.

Taxonomy (choose exactly one "type"):
${TAXONOMY_LIST.map((t) => `- ${t.type}: ${t.description}`).join('\n')}

"strength" (0..1) = how strong a BUYING signal this is for the matched ICP(s). 0 = irrelevant noise, 1 = an urgent, high-intent buying moment.
"matchedIcpIndexes" = the 1-based indexes of the ICPs (from the list provided) this event is genuinely relevant to. Empty array if none.
"justification" = one short sentence.`;

export function buildClassifierPrompt(input: {
  source: string;
  title?: string;
  text: string;
  hint?: string;
  icps: IcpForPrompt[];
}): string {
  const icpBlock = input.icps.length
    ? input.icps
        .map((icp, i) => {
          const d = icp.definition;
          const parts = [
            d.industries?.length ? `industries: ${d.industries.join(', ')}` : '',
            d.titles?.length ? `titles: ${d.titles.join(', ')}` : '',
            d.companySize ? `size: ${d.companySize}` : '',
            d.keywords?.length ? `keywords: ${d.keywords.join(', ')}` : '',
            d.geos?.length ? `geos: ${d.geos.join(', ')}` : '',
            d.signalTypes?.length ? `wants signal types: ${d.signalTypes.join(', ')}` : '',
          ].filter(Boolean);
          return `${i + 1}. ${icp.name} — ${parts.join('; ')}`;
        })
        .join('\n')
    : '(no ICPs defined)';

  return `ICP DEFINITIONS:
${icpBlock}

EVENT:
source: ${input.source}
${input.hint ? `adapter hint: ${input.hint}\n` : ''}${input.title ? `title: ${input.title}\n` : ''}content: ${input.text.slice(0, 2500)}

Classify this event.`;
}
