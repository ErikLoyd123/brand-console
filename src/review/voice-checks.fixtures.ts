// src/review/voice-checks.fixtures.ts
// Three generic fixtures shaped like real published posts (a conversation post that reads
// human, a teach post that dropped its seed's specifics and fell into list scaffolding, and
// a teach post with an aphorism close). Prose is written for the example persona (a coffee
// roaster); no real user's text appears here. Consumed by voice-checks.verify.ts.
import type { Silo } from "../core/silos";

export interface Fixture {
  name: string;
  silo: Silo;
  seed: string;
  points: string[];
  body: string;
  close: string;
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
];
