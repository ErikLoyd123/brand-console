export const TAGS = ['needs-your-take', 'ready-to-draft'] as const;

export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<Tag, string> = {
  'needs-your-take': 'Needs your take',
  'ready-to-draft': 'Ready to draft',
};
