(() => {
  let layer = 10;
  const windows = document.querySelectorAll('.window');
  windows.forEach(win => {
    win.addEventListener('pointerdown', () => { win.style.zIndex = ++layer; });
    win.querySelectorAll('[data-minimize], [data-close]').forEach(button => button.addEventListener('click', () => { win.hidden = true; document.querySelector(`[data-open="${win.id}"]`)?.focus(); }));
    win.querySelector('[data-maximize]')?.addEventListener('click', () => win.classList.toggle('maximized'));
    const bar = win.querySelector('.titlebar');
    let drag;
    bar.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || innerWidth <= 760 || win.classList.contains('maximized')) return;
      const box = win.getBoundingClientRect(), parent = win.parentElement.getBoundingClientRect();
      drag = { x:e.clientX, y:e.clientY, left:box.left-parent.left, top:box.top-parent.top };
      win.style.transform = 'none'; win.style.right = 'auto'; win.style.bottom = 'auto';
      win.style.left = drag.left+'px'; win.style.top = drag.top+'px'; bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', e => {
      if (!drag) return;
      const parent = win.parentElement;
      win.style.left = Math.max(0,Math.min(parent.clientWidth-win.offsetWidth,drag.left+e.clientX-drag.x))+'px';
      win.style.top = Math.max(0,Math.min(parent.clientHeight-win.offsetHeight,drag.top+e.clientY-drag.y))+'px';
    });
    const stop = () => { drag = null; };
    bar.addEventListener('pointerup', stop); bar.addEventListener('pointercancel', stop); bar.addEventListener('lostpointercapture', stop);
  });
  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => {
    const win = document.getElementById(button.dataset.open); win.hidden = false; win.style.zIndex = ++layer; win.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }));
})();
matchMedia('(max-width: 760px)').addEventListener('change', e => {
  if (e.matches) document.querySelectorAll('.window').forEach(win => { win.hidden = false; win.classList.remove('maximized'); });
});
