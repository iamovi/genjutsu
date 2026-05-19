import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const ScrollToTop = () => {
    const { pathname } = useLocation();
    const navigationType = useNavigationType();

    useEffect(() => {
        // Skip scroll-to-top on POP (back/forward) so the browser
        // restores the previous scroll position naturally.
        if (navigationType === "POP") return;

        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [pathname, navigationType]);

    return null;
};

export default ScrollToTop;
