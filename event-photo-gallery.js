// Event folders and the enlarged photo viewer. Nature photography is unchanged.
(() => {
    const folders = [...document.querySelectorAll('.album-folder')];
    const viewer = document.getElementById('event-photo-viewer');
    if (!folders.length || !viewer) return;

    const photo = viewer.querySelector('.event-photo-image');
    const title = viewer.querySelector('#event-photo-title');
    const label = viewer.querySelector('.event-photo-label');
    const position = viewer.querySelector('.event-photo-position');
    const thumbnails = viewer.querySelector('.event-photo-thumbnails');
    const previous = viewer.querySelector('.event-photo-prev');
    const next = viewer.querySelector('.event-photo-next');
    const close = viewer.querySelector('.event-photo-close');
    let album = [];
    let currentIndex = 0;
    let returnFocus = null;
    let previousOverflow = '';
    let touchStart = null;

    function setExpanded(folder, expanded) {
        const toggle = folder.querySelector('.album-folder-front');
        const name = folder.querySelector('.album-folder-name').textContent;
        const photos = folder.querySelectorAll('.album-folder-photo');
        folder.classList.toggle('is-expanded', expanded);
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${name} photos`);
        folder.querySelector('.album-folder-count').textContent = expanded
            ? 'Choose a photo · Click to close'
            : `${String(photos.length).padStart(2, '0')} photo${photos.length === 1 ? '' : 's'} · Click to open`;
        photos.forEach(button => {
            button.tabIndex = expanded ? 0 : -1;
            button.setAttribute('aria-hidden', String(!expanded));
        });
    }

    function showPhoto(index) {
        currentIndex = (index + album.length) % album.length;
        photo.src = album[currentIndex].src;
        photo.alt = album[currentIndex].alt;
        label.textContent = album[currentIndex].alt;
        position.textContent = `${currentIndex + 1} / ${album.length}`;
        thumbnails.querySelectorAll('button').forEach((button, index) => {
            button.setAttribute('aria-pressed', String(index === currentIndex));
        });
        // Scroll only the thumbnail strip, keeping the document and dialog still.
        const active = thumbnails.children[currentIndex];
        if (active) {
            const left = active.offsetLeft - thumbnails.offsetLeft;
            thumbnails.scrollLeft = left - (thumbnails.clientWidth - active.offsetWidth) / 2;
        }
    }

    function openPhoto(folder, index, trigger) {
        album = [...folder.querySelectorAll('.album-folder-photo img')].map(image => ({
            src: image.getAttribute('src'),
            alt: image.alt
        }));
        returnFocus = trigger;
        title.textContent = folder.closest('.event-album-card').querySelector('.event-album-title').textContent;
        thumbnails.replaceChildren();
        album.forEach((item, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'event-photo-thumbnail';
            button.setAttribute('aria-label', `Show photo ${index + 1}: ${item.alt}`);
            const image = document.createElement('img');
            image.src = item.src;
            image.alt = '';
            image.draggable = false;
            button.append(image);
            button.addEventListener('click', () => showPhoto(index));
            thumbnails.append(button);
        });
        previous.hidden = next.hidden = album.length < 2;
        thumbnails.hidden = album.length < 2;
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        showPhoto(index);
        viewer.showModal();
    }

    folders.forEach(folder => {
        const toggle = folder.querySelector('.album-folder-front');
        toggle.addEventListener('click', () => {
            const expanded = !folder.classList.contains('is-expanded');
            folders.forEach(other => setExpanded(other, other === folder && expanded));
        });
        folder.querySelectorAll('.album-folder-photo').forEach((button, index) => {
            button.addEventListener('click', () => openPhoto(folder, index, button));
        });
    });

    previous.addEventListener('click', () => showPhoto(currentIndex - 1));
    next.addEventListener('click', () => showPhoto(currentIndex + 1));
    close.addEventListener('click', () => viewer.close());
    photo.addEventListener('error', () => {
        label.textContent = 'This photo could not load. Please try another photo.';
    });
    viewer.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            showPhoto(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
        }
    });
    viewer.addEventListener('click', event => {
        if (event.target !== viewer) return;
        const bounds = viewer.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
    });
    viewer.addEventListener('close', () => {
        document.body.style.overflow = previousOverflow;
        returnFocus?.focus({ preventScroll: true });
        touchStart = null;
    });
    photo.addEventListener('touchstart', event => {
        const touch = event.touches.length === 1 ? event.touches[0] : null;
        touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
    }, { passive: true });
    photo.addEventListener('touchend', event => {
        if (!touchStart || !event.changedTouches.length) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - touchStart.x;
        const dy = touch.clientY - touchStart.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            showPhoto(currentIndex + (dx < 0 ? 1 : -1));
        }
        touchStart = null;
    }, { passive: true });
    photo.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

    document.addEventListener('click', event => {
        if (!viewer.open && !viewer.contains(event.target) && !event.target.closest('.album-folder')) {
            folders.forEach(folder => setExpanded(folder, false));
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || viewer.open) return;
        const expanded = folders.find(folder => folder.classList.contains('is-expanded'));
        if (expanded) {
            setExpanded(expanded, false);
            expanded.querySelector('.album-folder-front').focus({ preventScroll: true });
        }
    });
})();
