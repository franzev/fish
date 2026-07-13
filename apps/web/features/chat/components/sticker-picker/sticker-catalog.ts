import type { ChatStickerId } from "@fish/core/chat";

export type StickerStyle = "cute" | "hand-drawn" | "expressive";

export interface ChatSticker {
  id: ChatStickerId;
  phrase: string;
  animal: string;
  description: string;
  src: string;
  styles: readonly StickerStyle[];
  keywords: readonly string[];
}

export interface StickerFilter<T extends string> {
  id: "all" | T;
  label: string;
}

export const stickerStyleFilters: readonly StickerFilter<StickerStyle>[] = [
  { id: "all", label: "All" },
  { id: "cute", label: "Cute" },
  { id: "hand-drawn", label: "Hand-drawn" },
  { id: "expressive", label: "Expressive" },
];

/** The default pack keeps every animal unique and follows the anatomy and
 * visual-language brief in docs/chat-media-picker-design.md. */
export const aquaticStickers: readonly ChatSticker[] = [
  {
    id: "aquatic-thank-you-octopus",
    phrase: "Thank you",
    animal: "octopus",
    description: "A grateful coral octopus saying thank you",
    src: "/stickers/aquatic/thank-you-octopus.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["thanks", "grateful", "appreciate", "octopus"],
  },
  {
    id: "aquatic-good-night-whale",
    phrase: "Good night",
    animal: "whale",
    description: "A sleepy blue whale saying good night",
    src: "/stickers/aquatic/good-night-whale.webp",
    styles: ["cute", "hand-drawn"],
    keywords: ["sleep", "bedtime", "night", "whale"],
  },
  {
    id: "aquatic-great-job-sea-star",
    phrase: "Great job",
    animal: "sea star",
    description: "A proud golden sea star saying great job",
    src: "/stickers/aquatic/great-job-sea-star.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["well done", "proud", "congratulations", "sea star"],
  },
  {
    id: "aquatic-hello-otter",
    phrase: "Hello!",
    animal: "sea otter",
    description: "A cheerful sea otter waving hello",
    src: "/stickers/aquatic/hello-otter.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["hello", "hi", "hey", "welcome", "otter"],
  },
  {
    id: "aquatic-awesome-dolphin",
    phrase: "Awesome!",
    animal: "bottlenose dolphin",
    description: "An excited dolphin saying awesome",
    src: "/stickers/aquatic/awesome-dolphin.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["awesome", "amazing", "great", "wow", "dolphin"],
  },
  {
    id: "aquatic-see-you-soon-turtle",
    phrase: "See you soon",
    animal: "sea turtle",
    description: "A friendly sea turtle waving see you soon",
    src: "/stickers/aquatic/see-you-soon-turtle.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["see you", "soon", "goodbye", "later", "turtle"],
  },
  {
    id: "aquatic-youre-welcome-seal",
    phrase: "You're welcome",
    animal: "harbor seal",
    description: "A friendly harbor seal saying you're welcome",
    src: "/stickers/aquatic/youre-welcome-seal.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["welcome", "glad to help", "no problem", "seal"],
  },
  {
    id: "aquatic-goodbye-squid",
    phrase: "Goodbye",
    animal: "squid",
    description: "A cheerful squid waving goodbye",
    src: "/stickers/aquatic/goodbye-squid.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["goodbye", "bye", "farewell", "later", "squid"],
  },
  {
    id: "aquatic-good-morning-seahorse",
    phrase: "Good morning",
    animal: "seahorse",
    description: "A bright seahorse saying good morning",
    src: "/stickers/aquatic/good-morning-seahorse.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["morning", "hello", "sunrise", "wake up", "seahorse"],
  },
  {
    id: "aquatic-congratulations-jellyfish",
    phrase: "Congratulations",
    animal: "jellyfish",
    description: "A joyful jellyfish celebrating congratulations",
    src: "/stickers/aquatic/congratulations-jellyfish.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["congratulations", "congrats", "celebrate", "well done", "jellyfish"],
  },
  {
    id: "aquatic-sorry-penguin",
    phrase: "Sorry",
    animal: "penguin",
    description: "A gentle penguin making a sincere apology",
    src: "/stickers/aquatic/sorry-penguin.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["sorry", "apology", "apologize", "forgive", "penguin"],
  },
  {
    id: "aquatic-please-shrimp",
    phrase: "Please",
    animal: "shrimp",
    description: "A polite shrimp saying please",
    src: "/stickers/aquatic/please-shrimp.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["please", "request", "ask", "polite", "shrimp"],
  },
  {
    id: "aquatic-yes-crab",
    phrase: "Yes",
    animal: "crab",
    description: "A confident red crab saying yes",
    src: "/stickers/aquatic/yes-crab.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["yes", "agree", "correct", "absolutely", "crab"],
  },
  {
    id: "aquatic-no-lobster",
    phrase: "No",
    animal: "lobster",
    description: "A gentle lobster saying no",
    src: "/stickers/aquatic/no-lobster.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["no", "disagree", "decline", "not now", "lobster"],
  },
  {
    id: "aquatic-okay-manta-ray",
    phrase: "Okay",
    animal: "manta ray",
    description: "A calm manta ray saying okay",
    src: "/stickers/aquatic/okay-manta-ray.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["okay", "ok", "sure", "sounds good", "manta ray"],
  },
  {
    id: "aquatic-good-luck-goldfish",
    phrase: "Good luck",
    animal: "goldfish",
    description: "An encouraging goldfish wishing good luck",
    src: "/stickers/aquatic/good-luck-goldfish.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["good luck", "luck", "you got this", "encourage", "goldfish"],
  },
  {
    id: "aquatic-happy-birthday-narwhal",
    phrase: "Happy birthday",
    animal: "narwhal",
    description: "A delighted narwhal celebrating a birthday",
    src: "/stickers/aquatic/happy-birthday-narwhal.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["happy birthday", "birthday", "party", "celebrate", "narwhal"],
  },
  {
    id: "aquatic-i-miss-you-manatee",
    phrase: "I miss you",
    animal: "manatee",
    description: "A tender manatee saying I miss you",
    src: "/stickers/aquatic/i-miss-you-manatee.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["miss you", "thinking of you", "longing", "heart", "manatee"],
  },
  {
    id: "aquatic-love-you-angelfish",
    phrase: "Love you",
    animal: "angelfish",
    description: "An affectionate angelfish saying love you",
    src: "/stickers/aquatic/love-you-angelfish.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["love you", "love", "heart", "affection", "angelfish"],
  },
  {
    id: "aquatic-lol-clownfish",
    phrase: "LOL",
    animal: "clownfish",
    description: "A clownfish laughing out loud",
    src: "/stickers/aquatic/lol-clownfish.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["lol", "laugh", "funny", "hilarious", "clownfish"],
  },
  {
    id: "aquatic-omg-pufferfish",
    phrase: "OMG",
    animal: "pufferfish",
    description: "A surprised pufferfish saying OMG",
    src: "/stickers/aquatic/omg-pufferfish.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["omg", "surprised", "shocked", "wow", "pufferfish"],
  },
  {
    id: "aquatic-cheers-walrus",
    phrase: "Cheers",
    animal: "walrus",
    description: "A jovial walrus raising a shell cup",
    src: "/stickers/aquatic/cheers-walrus.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["cheers", "toast", "celebrate", "thanks", "walrus"],
  },
  {
    id: "aquatic-welcome-back-sea-lion",
    phrase: "Welcome back",
    animal: "sea lion",
    description: "An enthusiastic sea lion saying welcome back",
    src: "/stickers/aquatic/welcome-back-sea-lion.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["welcome back", "return", "good to see you", "hello", "sea lion"],
  },
  {
    id: "aquatic-nice-nudibranch",
    phrase: "Nice!",
    animal: "nudibranch",
    description: "A delighted nudibranch saying nice",
    src: "/stickers/aquatic/nice-nudibranch.webp",
    styles: ["cute", "hand-drawn", "expressive"],
    keywords: ["nice", "great", "cool", "well done", "nudibranch"],
  },
];

const aquaticStickersById = new Map(
  aquaticStickers.map((sticker) => [sticker.id, sticker])
);

export function getChatSticker(stickerId: string): ChatSticker | null {
  return aquaticStickersById.get(stickerId as ChatStickerId) ?? null;
}
