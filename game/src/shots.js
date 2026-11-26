// shots.js — deterministic poses for the maker's screenshots. The
// page reads ?shot=<name>&seed=<n> and, instead of playing, sets up
// one frozen moment of "One Fly Ruins a Birthday Party" and renders
// it: cover (title over the table), taunt (landed, ring shrinking),
// perfect (the last-instant dodge), finale (the cake, four hands),
// results (the ruined family photo + disaster log).

export function applyPose(game, name) {
  const { table, fly, director } = game;
  const [mom, grandpa, timmy, dad] = table.humans;
  const [greens, soup, cake] = table.foods;
  game.time = 3.2;

  const play = (elapsed) => {
    game.state = 'playing';
    game.tutorial = 'done';
    game.tutPhase = 'done';
    game.elapsed = elapsed;
    game.hudSlideT = 1;
  };
  const landOn = (zone) => {
    fly.x = zone.x;
    fly.y = zone.y;
    fly.vx = 0;
    fly.vy = 0;
    fly.landedOn = zone;
  };

  if (name === 'cover') {
    game.state = 'title';
    landOn({ kind: 'head', ref: dad, x: dad.x, y: dad.y - 6, r: dad.headR });
    return;
  }

  if (name === 'taunt') {
    play(14);
    const zone = table.propAt(soup.x, soup.y);
    landOn(zone);
    const atk = director.startAttack(mom, soup.x, soup.y, 14, { target: zone });
    atk.t = atk.dur * 0.55;
    mom.expression = 'angry';
    game.combo = 3;
    game.score = 2450;
    return;
  }

  if (name === 'perfect') {
    play(26);
    game.time = 3.35; // land on an invincibility-blink ON frame
    const zone = table.propAt(greens.x, greens.y);
    const atk = director.startAttack(dad, greens.x, greens.y, 26, { target: zone });
    atk.t = atk.dur - 0.05;
    // The fly, a whisker outside the ring, mid-flash.
    fly.x = greens.x + atk.radius + 34;
    fly.y = greens.y - 18;
    fly.vx = 330;
    fly.vy = -60;
    fly.flashing = true;
    fly.iframesT = 0.15;
    game.combo = 7; // golden fly
    game.maxCombo = 7;
    game.score = 8900;
    game.floatText(fly.x - 10, fly.y - 40, 'PERFECT!!', '#FF3FA4', 46);
    game.floatText(greens.x, greens.y + 46, '+1650', '#FFC94A', 21, { flyTo: true });
    game.burst(fly.x, fly.y, 16, '#FF3FA4', 170, 3, 0.8, 300);
    game.burst(greens.x, greens.y, 10, '#ffffff', 120, 2.4, 0.5, 300);
    return;
  }

  if (name === 'finale') {
    play(84);
    const zone = table.propAt(cake.x, cake.y);
    landOn(zone);
    const atk = director.startAttack(dad, cake.x, cake.y, 84, { target: zone, finale: true });
    atk.t = 0.55;
    game.finaleTriggered = true;
    game.combo = 11;
    game.maxCombo = 11;
    game.score = 21300;
    game.chaosTotal = 3900;
    game.hud.announce('ALL HANDS ON DECK!', 2);
    for (const h of table.humans) h.expression = 'angry';
    return;
  }

  if (name === 'track') {
    // P0-1: the warning has been dragged off the soup and is still
    // hunting the fly (dashed ring, not yet locked on).
    play(20);
    const zone = table.propAt(soup.x, soup.y);
    landOn(zone);
    const atk = director.startAttack(mom, soup.x, soup.y, 20, { target: zone });
    atk.t = atk.dur * 0.5;
    atk.x = soup.x - 52; // mid-drag: pulled toward the fly's escape
    atk.y = soup.y + 38;
    mom.expression = 'angry';
    game.combo = 4;
    game.score = 3900;
    return;
  }
  if (name === 'preview') {
    // P1-1: the fly sits on the fork; the ring over it wears the
    // fork's badge and the dashed arrow shows where it will fly.
    play(24);
    const fork = table.dressing.find((d) => d.kind === 'fork');
    const zone = table.propAt(fork.x, fork.y);
    landOn(zone);
    const atk = director.startAttack(grandpa, fork.x, fork.y, 24, { target: zone });
    atk.t = atk.dur * 0.45;
    grandpa.expression = 'angry';
    game.combo = 5;
    game.score = 5200;
    return;
  }
  if (name === 'crumbs') {
    // P1-2: a fresh smash has sprayed crumbs around the fly.
    play(14);
    fly.x = greens.x + 64;
    fly.y = greens.y + 44;
    fly.vx = 0;
    fly.vy = 0;
    game.combo = 6;
    game.score = 3100;
    game.spawnCrumbs(fly.x - 10, fly.y + 6, 3);
    game.spawnCrumbs(fly.x + 30, fly.y - 16, 2);
    game.spawnCrumbs(fly.x - 34, fly.y + 26, 2);
    return;
  }
  if (name === 'missbar') {
    // P0-3: the replay bar after a late press — the red tick sits
    // 140ms past the impact line, outside the PERFECT zone.
    play(18);
    fly.x = cake.x;
    fly.y = cake.y;
    fly.squash();
    game.score = 4600;
    game.missBar = { t: 0.55, dur: 1.25, pressRemainMs: null, lateMs: 140 };
    return;
  }
  if (name === 'results') {
    play(90);
    game.score = 17400;
    game.chaosTotal = 2400; // 40%: clean photo + this run's damage overlaid
    game.events.cakeBoom = true;
    game.maxCombo = 14;
    game.longestChain = 4;
    game.hp = 2;
    mom.soupFace = true;
    mom.expression = 'scared';
    dad.palmPrint = true;
    dad.glassesOff = true;
    dad.expression = 'slapped';
    grandpa.denturesOut = true;
    grandpa.expression = 'scared';
    timmy.hatKind = 'greens';
    timmy.expression = 'scared';
    cake.state = 'smashed';
    soup.state = 'empty';
    for (const id of ['dadSlapsDad', 'soupBun', 'runawayDentures', 'dominoDinner', 'cakePocalypse']) {
      game.metaGallery.add(id);
    }
    game.time = 10;
    game.finish("TIME'S UP!");
    game.finishTime = 9; // the BUZZ AGAIN prompt is already up
    return;
  }

  // Unknown pose name: fall back to the cover.
  game.state = 'title';
}
