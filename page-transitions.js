(() => {
    const root = document.documentElement;
    let activeThemeTransition = 0;

    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    window.runPageTransition = update => {
        if (!document.startViewTransition || prefersReducedMotion()) {
            update();
            return;
        }

        document.startViewTransition(update);
    };

    window.runThemeTransition = (update, trigger) => {
        if (!document.startViewTransition || prefersReducedMotion()) {
            update();
            return;
        }

        const rect = trigger?.getBoundingClientRect();
        const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
        const radius = Math.max(
            Math.hypot(x, y),
            Math.hypot(window.innerWidth - x, y),
            Math.hypot(x, window.innerHeight - y),
            Math.hypot(window.innerWidth - x, window.innerHeight - y)
        );
        const transitionId = ++activeThemeTransition;

        root.style.setProperty('--theme-transition-x', `${x}px`);
        root.style.setProperty('--theme-transition-y', `${y}px`);
        root.style.setProperty('--theme-transition-radius', `${radius}px`);
        root.classList.add('theme-changing');

        const transition = document.startViewTransition(update);
        const clearThemeTransition = () => {
            if (transitionId !== activeThemeTransition) return;

            root.classList.remove('theme-changing');
            root.style.removeProperty('--theme-transition-x');
            root.style.removeProperty('--theme-transition-y');
            root.style.removeProperty('--theme-transition-radius');
        };

        transition.finished.then(clearThemeTransition, clearThemeTransition);
    };
})();
