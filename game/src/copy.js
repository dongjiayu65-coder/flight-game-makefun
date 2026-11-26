// copy.js — the English copy bank (Quick Claude, copy bank v1.0),
// wired as shuffle bags: draw without replacement until the bag is
// empty, so the same line never shows twice in a row. The rating
// labels keep their main variant at ~50% (the main line is simply in
// the bag twice). [N] and [NAME] are filled at runtime.

import { makeRng } from './random.js';

class Bag {
  constructor(rng, items) {
    this.rng = rng;
    this.items = items;
    this.left = [];
  }

  draw() {
    if (this.left.length === 0) this.left = [...this.items];
    const i = Math.floor(this.rng() * this.left.length);
    return this.left.splice(i, 1)[0];
  }
}

export class Copy {
  constructor(seed) {
    const rng = makeRng(seed * 31 + 7);
    const bag = (items) => new Bag(rng, items);
    this.rating = {
      early: bag(['Early', 'Early', 'Bit eager', 'Chill.', 'Too soon']),
      good: bag(['Good', 'Good', 'Nice', 'Smooth', 'Not bad']),
      close: bag(['Close!', 'Close!', 'Whoa!', 'Too close!', 'Buzz off!', 'Yikes!']),
      perfect: bag(['PERFECT!!', 'PERFECT!!', 'UNTOUCHABLE!', 'FLAWLESS!!', 'BUZZ-TASTIC!', 'TOO FLY!!']),
      splat: bag(['SPLAT.', 'Squished.', 'Flat fly.', 'Ouch.']),
      slipped: bag(['Slipped away', 'Sneaky']),
      double: bag(['DOUBLE DODGE!', 'Not today!']),
    };
    this.quip = {
      soup: bag(['Soup-er facial!', '[NAME] is now 40% soup.', 'Souper. Just souper.']),
      head: bag(['-1 Dignity', "That's gonna leave a mark."]),
      selfOwn: bag(['Self-own!', '-1 Dignity']),
      brawl: bag(['Family bonding!']),
      cutlery: bag(['Fork-ward launch!', 'Cutlery in orbit.', 'Nobody fork-saw that.']),
      lamp: bag(['Light show!', 'The chandelier has opinions.']),
      lampDrop: bag(['Chandeli-oops.']),
      dentures: bag(["Grandpa's teeth have left the chat.", 'Chomp chomp chomp!', 'Loose teeth on the loose!']),
      dog: bag(['WHO LET THE DOG IN?', 'Good boy! Bad timing.', 'The dog has the chicken. Repeat: the dog has the chicken.']),
      cup: bag(['Spill-tastic.', 'Slippery when wet.']),
      foodHat: bag(['Eat your greens!', 'New hat, who dis?']),
      chickenHat: bag(['Chicken has flown the coop.']),
      candle: bag(['Wish denied.', 'One less candle.', 'Happy birth... oh.']),
      finalePerfect: bag(['CAKE-POCALYPSE!', 'Happy Birthday, Timmy!', 'Let them eat... nothing.']),
    };
    this.weapon = {
      spray: bag(['Mom grabbed the bug spray!']),
      swatter: bag(['Grandpa found the swatter!']),
      double: bag(['Dad rolled up the newspaper!']),
      poke: bag(['Timmy is charging with his party hat!']),
      allUp: bag(["EVERYONE'S UP!"]),
    };
    this.randomEvent = {
      dog: bag(['A wild dog appears!']),
      blackout: bag(['Lights out!']),
      doorbell: bag(['Ding-dong!']),
      doorbellBack: bag(["...they're back. All of them."]),
      sneeze: bag(['AH-CHOO!']),
      photo: bag(['Say cheese!']),
      photobomb: bag(['Photobombed!']),
    };
    this.caption = {
      S: bag([
        "Timmy's 8th birthday. Ruined by one fly. Worth it.",
        'The family has agreed to never speak of this night.',
        'Timmy wished for a puppy. He got trauma.',
        'This photo will be shown at every wedding from now on.',
        'Five stars. Would ruin again.',
      ]),
      A: bag([
        "A birthday they'll never forget. Unfortunately.",
        "Dinner is cancelled. So is Dad's dignity.",
        "Mom is already writing the angry Yelp review.",
        "Grandpa says this is the most fun he's had since 1974.",
      ]),
      B: bag([
        "Timmy's birthday was... a little sticky.",
        'Some soup was spilled. Some feelings were hurt.',
        'The cake survived. Mostly.',
        'A solid C+ birthday. Room for improvement.',
      ]),
      C: bag([
        'Everyone had a lovely time. Booo.',
        'You were just a mild inconvenience.',
        "Timmy didn't even notice you.",
        'Happy birthday, Timmy! (Ugh.)',
        'Try being more annoying.',
      ]),
    };
    this.roundIntro = bag(['Round 2. Fight!', 'Back for more?', 'Again? Respect.']);
    this.finale = {
      awaits: bag(['THE CAKE AWAITS.']),
      allHands: bag(['ALL HANDS ON DECK!']),
      waitForIt: bag(['...WAIT FOR IT...']),
      splatButCake: bag(['You got splatted... but so did the cake.']),
      missed: bag(['You missed the Final Slap!']),
    };
  }

  ratingLabel(id) {
    return this.rating[id] ? this.rating[id].draw() : '';
  }

  quipFor(id, name) {
    const bag = this.quip[id];
    if (!bag) return '';
    return bag.draw().replace('[NAME]', name ?? '');
  }
}

// The disaster log (spec: copy bank section 4). Hint shows while
// locked, description once unlocked.
export const GALLERY = [
  { id: 'dadSlapsDad', name: 'Dad Slaps Dad', hint: 'Some people hit themselves.', desc: 'He was aiming for you.' },
  { id: 'soupBun', name: 'Soup Bun', hint: "Mom's hair looks... absorbent.", desc: 'Tomato soup, styled to perfection.' },
  { id: 'forkCake', name: 'Fork in the Cake', hint: 'Make the cutlery fly.', desc: 'A fork. In the cake. Standing.' },
  { id: 'chandelierDrop', name: 'Chandelier Drop', hint: 'Look up. Way up.', desc: 'Gravity: 1. Dinner: 0.' },
  { id: 'runawayDentures', name: 'Runaway Dentures', hint: "Grandpa's smile is detachable.", desc: 'They bit three things.' },
  { id: 'dogTable', name: 'Dog on the Table', hint: 'Sometimes a guest arrives.', desc: 'He took the chicken. No regrets.' },
  { id: 'familyBrawl', name: 'Family Brawl', hint: 'Start a fight. Then another. Then another.', desc: 'Three fights. One dinner.' },
  { id: 'blackoutPerfect', name: 'Blackout Perfect', hint: 'Dodge perfectly in the dark.', desc: 'They never saw it coming. Literally.' },
  { id: 'photobomb', name: 'Photobomb', hint: 'Smile for the camera.', desc: "You're in the family album now." },
  { id: 'dominoDinner', name: 'Domino Dinner', hint: 'One slap, five disasters.', desc: 'CHAIN x5. A masterpiece.' },
  { id: 'rainbowFly', name: 'Rainbow Fly', hint: 'Never stop dodging.', desc: '20 combo. Pure fabulous.' },
  { id: 'cakePocalypse', name: 'Cake-pocalypse', hint: 'Nail the final slap.', desc: 'PERFECT. The cake is everywhere.' },
];
