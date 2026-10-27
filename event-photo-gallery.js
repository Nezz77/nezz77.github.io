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
    let expandedFolder = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const preparedImages = new WeakSet();
    const motionTimers = new WeakMap();
    const lastToggle = new WeakMap();
    const layoutAnimations = new Map();
    const motionDuration = 680;
    const motionEase = 'cubic-bezier(0.22, 1, 0.36, 1)';
    // Cache the static album DOM; a toggle only updates the old/new folders.
    const folderParts = new Map(folders.map(folder => [folder, {
        toggle: folder.querySelector('.album-folder-front'),
        name: folder.querySelector('.album-folder-name').textContent,
        count: folder.querySelector('.album-folder-count'),
        photos: [...folder.querySelectorAll('.album-folder-photo')]
    }]));
    const layoutTargets = folders.flatMap(folder => {
        const card = folder.closest('.event-album-card');
        const item = card.closest('.gallery-item');
        return [item, folder, card.querySelector('.event-album-body')];
    });

    function prepareFolder(folder) {
        if (preparedImages.has(folder)) return;
        preparedImages.add(folder);
        folder.querySelectorAll('img').forEach(image => {
            image.decoding = 'async';
            image.loading = 'eager';
            // Decode near/just before interaction instead of during the fan-out.
            if (typeof image.decode === 'function') image.decode().catch(() => {});
        });
    }

    function warmMotion(folder) {
        clearTimeout(motionTimers.get(folder));
        if (!reducedMotion.matches) folder.classList.add('is-motion-ready');
        prepareFolder(folder);
    }

    function releaseMotion(folder) {
        clearTimeout(motionTimers.get(folder));
        motionTimers.set(folder, setTimeout(() => {
            if (!folder.classList.contains('is-expanded') &&
                !folder.matches(':hover') && !folder.contains(document.activeElement)) {
                folder.classList.remove('is-motion-ready');
            }
        }, motionDuration + 100));
    }

    function animateLayout(update) {
        if (reducedMotion.matches || typeof Element.prototype.animate !== 'function') {
            layoutAnimations.forEach(animation => animation.cancel());
            layoutAnimations.clear();
            update();
            return;
        }
        // FLIP: measure once before/after the final layout. Only transforms
        // animate; margin/height never trigger layout on every animation frame.
        const before = new Map(layoutTargets.map(element => [element, element.getBoundingClientRect()]));
        layoutAnimations.forEach(animation => animation.cancel());
        layoutAnimations.clear();
        update();
        const after = new Map(layoutTargets.map(element => [element, element.getBoundingClientRect()]));
        layoutTargets.forEach(element => {
            const first = before.get(element);
            const last = after.get(element);
            if (!first.width || !last.width ||
                Math.max(first.bottom, last.bottom) < 0 ||
                Math.min(first.top, last.top) > window.innerHeight) return;
            let x = first.left - last.left;
            let y = first.top - last.top;
            const item = element.closest('.gallery-item');
            // The parent column also moves; don't apply its translation twice.
            if (element !== item) {
                x -= before.get(item).left - after.get(item).left;
                y -= before.get(item).top - after.get(item).top;
            }
            if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) return;
            const animation = element.animate([
                { transform: `translate3d(${x}px, ${y}px, 0)` },
                { transform: 'translate3d(0, 0, 0)' }
            ], { duration: motionDuration, easing: motionEase });
            layoutAnimations.set(element, animation);
            animation.finished.then(() => {
                if (layoutAnimations.get(element) === animation) layoutAnimations.delete(element);
            }).catch(() => {}); // A reversed gesture intentionally cancels it.
        });
    }

    function collapseFolder() {
        if (expandedFolder) animateLayout(() => setExpanded(expandedFolder, false));
    }

    function setExpanded(folder, expanded) {
        if (folder.classList.contains('is-expanded') === expanded) return;
        const { toggle, name, count, photos } = folderParts.get(folder);
        warmMotion(folder);
        folder.classList.toggle('is-expanded', expanded);
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${name} photos`);
        count.textContent = expanded
            ? 'Choose a photo · Click to close'
            : `${String(photos.length).padStart(2, '0')} photo${photos.length === 1 ? '' : 's'} · Click to open`;
        photos.forEach(button => {
            button.tabIndex = expanded ? 0 : -1;
            button.setAttribute('aria-hidden', String(!expanded));
        });
        expandedFolder = expanded ? folder : null;
        if (!expanded) releaseMotion(folder);
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
        const { toggle, photos } = folderParts.get(folder);
        folder.addEventListener('pointerenter', () => warmMotion(folder), { passive: true });
        folder.addEventListener('pointerleave', () => releaseMotion(folder), { passive: true });
        folder.addEventListener('focusin', () => warmMotion(folder));
        folder.addEventListener('focusout', () => releaseMotion(folder));
        toggle.addEventListener('pointerdown', () => warmMotion(folder), { passive: true });
        toggle.addEventListener('click', event => {
            const now = performance.now();
            // A double-click is one gesture, never open → close or an
            // accidental click on a print moving underneath the pointer.
            if (event.detail > 1 || (event.detail !== 0 && now - (lastToggle.get(folder) ?? -Infinity) < 300)) return;
            lastToggle.set(folder, now);
            const expanded = !folder.classList.contains('is-expanded');
            animateLayout(() => {
                if (expandedFolder && expandedFolder !== folder) setExpanded(expandedFolder, false);
                setExpanded(folder, expanded);
            });
        });
        photos.forEach((button, index) => {
            button.addEventListener('click', event => {
                if (event.detail > 1 || (event.detail !== 0 && performance.now() - (lastToggle.get(folder) ?? -Infinity) < 300)) return;
                openPhoto(folder, index, button);
            });
        });
    });

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                prepareFolder(entry.target);
                imageObserver.unobserve(entry.target);
            });
        }, { rootMargin: '220px' });
        folders.forEach(folder => imageObserver.observe(folder));
    }

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
            collapseFolder();
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || viewer.open) return;
        const expanded = expandedFolder;
        if (expanded) {
            collapseFolder();
            expanded.querySelector('.album-folder-front').focus({ preventScroll: true });
        }
    });
})();
