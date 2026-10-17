// The Garage screen: browse bikes, paints and trails, preview them on the showroom stage,
// buy with coins and equip.
import { CATALOGUE, owns } from './garage.js';

const $ = (id) => document.getElementById(id);
const STAT_NAMES = { speed: 'Speed', grip: 'Grip', spin: 'Spin', weight: 'Weight' };
const TRAIL_ICONS = { none: '∅', smoke: '💨', sparks: '✨', confetti: '🎉', naija: '', fire: '🔥', rainbow: '🌈' };
const KIND_OF = { bikes: 'bike', paints: 'paint', trails: 'trail' };

export function setupGarage({ progress, save, spend, showroom, onEquip, sfx, popup }) {
  const garage = progress.garage;
  let tab = 'bikes';
  let picked = garage.bike; // the item shown in the detail panel (may not be owned yet)

  // What the stage shows: the picked item over what you have equipped.
  function preview() {
    const look = { bike: garage.bike, paint: garage.paint };
    if (tab === 'bikes') look.bike = picked;
    if (tab === 'paints') look.paint = picked;
    showroom.setLook(look);
    showroom.trail = tab === 'trails' ? picked : garage.trail;
  }

  function renderTabs() {
    for (const b of $('garage-tabs').children) b.classList.toggle('on', b.dataset.t === tab);
  }

  function renderItems() {
    const equipped = garage[KIND_OF[tab]];
    $('garage-items').replaceChildren(...CATALOGUE[tab].map((item) => {
      const b = document.createElement('button');
      b.className = 'gitem' + (item.id === picked ? ' picked' : '');
      const icon = document.createElement('span');
      icon.className = 'gicon';
      if (tab === 'paints') {
        icon.style.background = `linear-gradient(135deg, ${item.main} 60%, ${item.accent} 60%)`;
      } else if (item.id === 'naija') {
        // The flag drawn in CSS: flag emoji don't show on Windows.
        icon.style.background = 'linear-gradient(90deg, #008751 33%, #fff 33% 67%, #008751 67%)';
      } else {
        icon.textContent = tab === 'trails' ? TRAIL_ICONS[item.id] : '🏍️';
      }
      const name = document.createElement('span');
      name.className = 'gname';
      name.textContent = item.name;
      const tag = document.createElement('span');
      tag.className = 'gtag';
      if (item.id === equipped) {
        tag.textContent = 'Equipped';
        tag.classList.add('eq');
      } else if (owns(garage, tab, item.id)) {
        tag.textContent = 'Owned';
      } else {
        tag.textContent = item.price;
        tag.append(coin());
      }
      b.append(icon, name, tag);
      b.onclick = () => {
        sfx.click();
        picked = item.id;
        render();
      };
      return b;
    }));
  }

  function renderDetail() {
    const item = CATALOGUE[tab].find((x) => x.id === picked) ?? CATALOGUE[tab][0];
    const box = $('garage-detail');
    box.replaceChildren();
    const h = document.createElement('h3');
    h.textContent = item.name;
    box.append(h);
    if (item.blurb) {
      const p = document.createElement('p');
      p.textContent = item.blurb;
      box.append(p);
    }
    if (item.stats) {
      const stats = document.createElement('div');
      stats.className = 'gstats';
      for (const [k, val] of Object.entries(item.stats)) {
        const row = document.createElement('div');
        row.innerHTML = `<span></span><i>${'<b></b>'.repeat(5)}</i>`;
        row.firstChild.textContent = STAT_NAMES[k];
        [...row.querySelectorAll('b')].forEach((pip, i) => pip.classList.toggle('on', i < val));
        stats.append(row);
      }
      box.append(stats);
      const fair = document.createElement('p');
      fair.className = 'gfair';
      fair.textContent = 'Every bike has the same pace overall: they just feel different.';
      box.append(fair);
    }
    const kind = KIND_OF[tab];
    const btn = document.createElement('button');
    btn.className = 'big';
    if (garage[kind] === item.id) {
      btn.textContent = 'Equipped ✓';
      btn.disabled = true;
    } else if (owns(garage, tab, item.id)) {
      btn.textContent = 'Equip';
      btn.onclick = () => equip(kind, item.id);
    } else {
      btn.textContent = `Buy for ${item.price}`;
      btn.append(coin());
      btn.onclick = () => {
        if (!spend(item.price)) {
          popup([[`Need ${item.price - progress.coins} more coins`], ['earn them in races and missions', 'pts']], 'small');
          btn.classList.remove('nope');
          void btn.offsetWidth;
          btn.classList.add('nope');
          return;
        }
        garage.owned[tab].push(item.id);
        sfx.milestone();
        popup([[`${item.name} is yours!`]], 'gold');
        equip(kind, item.id);
      };
    }
    box.append(btn);
  }

  function equip(kind, id) {
    garage[kind] = id;
    save();
    onEquip();
    sfx.star(1);
    render();
  }

  function render() {
    renderTabs();
    renderItems();
    renderDetail();
    preview();
  }

  for (const b of $('garage-tabs').children) {
    b.onclick = () => {
      sfx.click();
      tab = b.dataset.t;
      picked = garage[KIND_OF[tab]];
      render();
    };
  }

  return {
    open() {
      tab = 'bikes';
      picked = garage.bike;
      render();
    },
    // Put the stage back to what's equipped (when leaving without buying).
    reset() {
      showroom.setLook({ bike: garage.bike, paint: garage.paint });
      showroom.trail = garage.trail;
    },
  };
}

function coin() {
  const c = document.createElement('span');
  c.className = 'coin';
  return c;
}
