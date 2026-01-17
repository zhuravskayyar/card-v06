// CardRenderer v2: FRAME + ART
// Exposes window.CardRendererV2
(function(){
  function getElementEmoji(el){
    switch(el){
      case 'fire': return '🔥';
      case 'water': return '💧';
      case 'air': return '⚡';
      case 'earth': return '🍃';
      default: return '';
    }
  }

  window.CardRendererV2 = {
    render(card, opts = {}){
      const {
        size = 'normal',
        showElement = true,
        showPower = true
      } = opts;

      const rarity = (card && card.rarity) ? card.rarity.toString().toLowerCase() : 'common';
      const element = (card && card.element) ? card.element.toString().toLowerCase() : '';
      let img = '';
      const FALLBACK_IMG = 'assets/collection-placeholder.png';
      if (card) {
        img = card.image || card.imageUrl || card.src || '';
        if (!img && typeof window !== 'undefined' && typeof window.getCardImage === 'function') {
          try {
            img = window.getCardImage(card) || '';
          } catch (e) {
            img = '';
          }
        }
        // Без перевірки існування: якщо шляху немає — fallback
        if (!img) {
          img = FALLBACK_IMG;
        }
      }
      const name = card && card.name ? card.name : '';
      const power = (card && (typeof card.basePower !== 'undefined')) ? card.basePower : (card && card.power ? card.power : '');

      const sizeClass = size === 'details' ? 'details' : size;
      return `
      <div class="card-frame ${rarity} ${element} ${sizeClass}">
        <div class="card-art">
          ${img ? `<img src="${img}" alt="${name}">` : `<div class="card-art-placeholder">${getElementEmoji(element) || `<svg width='100%' height='100%' viewBox='0 0 80 100' fill='none' xmlns='http://www.w3.org/2000/svg'><rect x='8' y='12' width='64' height='76' rx='10' fill='url(#g)' stroke='#bfa76a' stroke-width='2'/><text x='50%' y='60%' text-anchor='middle' fill='#bfa76a' font-size='18' font-family='Cinzel,serif' opacity='0.5'>?</text><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop stop-color='#2a1c12'/><stop offset='1' stop-color='#0b0704'/></linearGradient></defs></svg>`}</div>`}
        </div>

        <div class="card-ui">
          ${showElement ? `<div class="card-gear ${element}"><span class="gear-element">${getElementEmoji(element)}</span></div>` : ``}
          ${showPower ? `<div class="card-power">${power}</div>` : ``}
        </div>
      </div>
    `;
    }
  };
})();
