// shots.js — deterministic poses for the maker's screenshots. The
// page reads ?shot=<name>&seed=<n> and, instead of the title screen,
// sets up one frozen moment of a run and renders it: the screenshots
// in the entry are real renders of this code, posed through the same
// update path a played game takes.

export function applyPose(game, name) {
  const { table, fly, humans } = game;
  game.state = 'playing';
  const [greens, soup, cake] = table.foods;

  if (name === 'cover') {
    // Early run: the fly crosses open cloth toward the first dish,
    // two gazes sweeping, everything readable at a glance.
    fly.x = table.rect.x + 330;
    fly.y = table.rect.y + 330;
    fly.heading = Math.atan2(greens.y - fly.y, greens.x - fly.x);
    fly.vx = Math.cos(fly.heading) * 260;
    fly.vy = Math.sin(fly.heading) * 260;
    humans.attention = 0.3;
  } else if (name === 'action') {
    // Mid-run: two courses down, fat, and halfway through the cake.
    greens.eaten = true;
    soup.eaten = true;
    fly.weight = 2;
    game.grams = greens.grams + soup.grams;
    fly.x = cake.x - 8;
    fly.y = cake.y + 4;
    fly.heading = 0.6;
    cake.dwellProgress = 0.62;
    humans.attention = 0.55;
  } else if (name === 'danger') {
    // The palm is coming: shadow locked and growing, fly bolting.
    greens.eaten = true;
    fly.weight = 1;
    game.grams = greens.grams;
    fly.x = soup.x + 90;
    fly.y = soup.y + 60;
    fly.heading = 2.6;
    fly.vx = -300;
    fly.vy = 190;
    humans.attention = 1;
    humans.palm = { state: 'warning', t: 0.38, x: fly.x + 26, y: fly.y + 10 };
  } else if (name === 'finale') {
    // Everything eaten: the window glows and the fat fly makes for it.
    for (const f of table.foods) f.eaten = true;
    fly.weight = 3;
    game.grams = table.foods.reduce((s, f) => s + f.grams, 0);
    game.escapeOpen = true;
    fly.x = table.window.x + 40;
    fly.y = table.window.y + 118;
    fly.heading = -Math.PI / 2 + 0.25;
    fly.vx = 60;
    fly.vy = -200;
    humans.attention = 0.45;
  }
  // Let the posed moment settle through the real update path for a
  // few steps (wings mid-beat, gazes mid-sweep), without input.
  for (let i = 0; i < 12; i++) game.step(1 / 60, { steer: null, buzz: false });
}
