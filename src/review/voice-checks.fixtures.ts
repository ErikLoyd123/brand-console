// src/review/voice-checks.fixtures.ts
// Three generic fixtures shaped like real published posts (a conversation post that reads
// human, a teach post that dropped its seed's specifics and fell into list scaffolding, and
// a teach post with an aphorism close). Prose is written for the example persona (a coffee
// roaster); no real user's text appears here. Consumed by voice-checks.verify.ts.
import type { Silo } from "../core/silos";
import type { PostLength } from "../core/lengths";

export interface Fixture {
  name: string;
  silo: Silo;
  seed: string;
  points: string[];
  body: string;
  close: string;
  // The band the post was drafted for; omitted when the fixture does not exercise it.
  length?: PostLength;
  // Rules expected to fire, each with the matches that must be present.
  expect: { rule: string; matches: string[] }[];
  // Rules that must NOT fire.
  forbid: string[];
}

export const FIXTURES: Fixture[] = [
  {
    name: "conversation post that reads human",
    silo: "conversation",
    seed: "I realized I did not know what a roast profile curve was measuring, so I looked it up. It tracks bean temperature against time, and roasters read the rate of rise off it.",
    points: [],
    body:
      "I have been roasting on the Aillio for months, and last week I stopped and realized I could not explain what the curve on the screen was measuring. So I looked it up, which felt overdue.\n\n" +
      "The profile tracks bean temperature against time. The rate of rise is the slope, and it is the number roasters actually watch. Reading it is cheap; deciding when to drop is the expensive part.",
    close: "So I am curious where other people land on this. Do you drop on the curve, on the crack, or on the smell?",
    expect: [],
    forbid: ["seed-retention", "aphorism-close", "list-cadence"],
  },
  {
    name: "teach post that dropped its specifics and listed",
    silo: "teach",
    seed: "The Aillio has more range than most people assume: it can roast a sample batch in six minutes with the right settings (P8, F3), and the preheat covers more than you think.",
    points: [],
    body:
      "The Aillio roasts my sample batches. It handles a half-kilo without complaint. And the preheat covers more than most people realize.\n\n" +
      "For a long time I defaulted to the drum for almost everything.\n\n" +
      "Three things changed how I use it.\n\n" +
      "First, fan out the batches. Small and parallel beats one long roast.\n\n" +
      "Second, pick efficient settings. The right ones make the difference between slow and fast.\n\n" +
      "Third, keep roasts short. It shines when time is measured in minutes.",
    close: "If you have been defaulting to the drum out of habit, it might be worth a second look.",
    expect: [
      { rule: "seed-retention", matches: ["P8", "F3"] },
      { rule: "list-cadence", matches: ["First,", "Second,", "Third,"] },
      { rule: "aphorism-close", matches: [] },
    ],
    forbid: [],
  },
  {
    name: "teach post with an aphorism close",
    silo: "teach",
    seed: "The Comandante is my daily grinder and I love it. But for espresso the Niche pulled a cleaner shot from the same beans.",
    points: [],
    body:
      "I use the Comandante every day. It is one of the best tools on my bench.\n\n" +
      "So I dialed in the same beans on the Niche and pulled a shot.\n\n" +
      "This is not a knock on the Comandante. The honest version: it runs circles around most hand grinders for filter. Espresso? Not its thing.",
    close: "The tools keep getting better. The only real mistake is assuming you already know what each one can do.",
    expect: [{ rule: "aphorism-close", matches: [] }],
    forbid: ["seed-retention", "list-cadence"],
  },
  {
    name: "seed with a contraction and a paragraph opener is not over-extracted",
    silo: "teach",
    seed:
      "I'm convinced the Aillio preheat matters more than people think, and it saves about 6 minutes a batch.\n\n" +
      "Most roasters skip it.",
    points: [],
    body:
      "I am convinced the Aillio preheat matters more than people think. It is the step that gets skipped most, and skipping it costs about 6 minutes a batch in drift you then chase for the rest of the roast.\n\n" +
      "The preheat brings the drum to a stable temperature before the beans go in, so the first minute reads true instead of low.",
    close: "Give the Aillio its preheat and the first minute of the curve stops lying to you.",
    expect: [],
    forbid: ["seed-retention", "aphorism-close", "list-cadence"],
  },
  {
    name: "short-band teach post that ran long",
    silo: "teach",
    length: "short",
    seed: "Green beans lose about a percent of weight a month in a dry warehouse, so the price per cup drifts up while the invoice stays the same.",
    points: [],
    body:
      "Green beans lose about a percent of weight a month in a dry warehouse. The bag still says 60 kilos on the invoice, but by the time you roast the last of it you are paying for water that left months ago, so the price per cup drifts up while the number on the invoice stays the same.\n\n" +
      "The fix is not a better supplier. It is weighing what you roast, not what you bought, and letting the cost per cup move with it. Once you do that the drift shows up as a line on a chart instead of a surprise at the end of the quarter, and you can decide whether faster turnover is worth the smaller order.\n\n" +
      "That is also why the roasters who buy small and often seem to pay more per bag and less per cup.",
    close: "Weigh the 60 kilos you roast, not the 60 kilos you bought.",
    expect: [{ rule: "length-band", matches: [] }],
    forbid: ["seed-retention", "aphorism-close", "list-cadence"],
  },
];
