// Falafel QA bot: plays through the real keyboard input path (press()).
export function updateBot(G, dt, press) {
  G.botCooldown -= dt;
  if (G.botCooldown > 0) return;
  G.botCooldown = 0.12 + Math.random() * 0.12;
  if (G.phase === 'banner' || G.phase === 'summary') { press('Enter'); return; }
  if (G.phase !== 'serving' || !G.customer || G.customer.leaving) return;
  const order = G.customer.order, build = G.build;
  if (G.fryer.active) {
    const inZone = G.fryer.pos > 0.4 && G.fryer.pos < 0.8;
    G.botFryWait += dt;
    if ((inZone && Math.random() > 0.15) || G.botFryWait > 1.6) { G.botFryWait = 0; press('ArrowUp'); }
    return;
  }
  if (build.falafelCount < order.falafel) { press('ArrowUp'); return; }
  if (!!order.tomato !== !!build.tomato) { press('ArrowLeft'); return; }
  if (!!order.cucumber !== !!build.cucumber) { press('ArrowRight'); return; }
  if (order.tahini && !build.tahini) {
    if (G.tahiniStation.active) {
      const inZone = G.tahiniStation.pos > 0.4 && G.tahiniStation.pos < 0.8;
      G.botTahiniWait += dt;
      if ((inZone && Math.random() > 0.15) || G.botTahiniWait > 1.6) { G.botTahiniWait = 0; press('ArrowDown'); }
      return;
    }
    press('ArrowDown'); return;
  }
  press(' ');
}
