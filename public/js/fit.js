(function fitToWindow() {
    const DESIGN_WIDTH = 1500; // layout width at 100% scale
    const MIN_SCALE = 0.6;
    const apply = () => {
        const z = Math.max(
            MIN_SCALE,
            Math.min(1, window.innerWidth / DESIGN_WIDTH),
        );
        document.documentElement.style.zoom = z;
        document.documentElement.style.setProperty("--zoom", z);
    };
    apply();
    window.addEventListener("resize", apply);
})();
