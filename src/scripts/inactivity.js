const inactivityDelay = 40_000;
const returnHomeDelay = 15_000;

export function initInactivity(showHome) {
    const homeScreen = document.querySelector(".home-screen");
    const sections = Array.from(document.querySelectorAll(".section"));
    const popup = document.querySelector(".inactivity-popup");
    const stayButton = document.querySelector(".inactivity-popup__stay");
    const homeButton = document.querySelector(".inactivity-popup__home");
    const languageSelect = document.querySelector(".language-picker--header .language-select");

    if (!(popup instanceof HTMLDialogElement) || !homeScreen || !stayButton || !homeButton) {
        return;
    }

    let inactivityTimer;
    let returnHomeTimer;

    function hasActiveSection() {
        return homeScreen.hidden && sections.some(function(section) {
            return section.classList.contains("section-active");
        });
    }

    function clearReturnHomeTimer() {
        window.clearTimeout(returnHomeTimer);
    }

    function closePopup() {
        clearReturnHomeTimer();
        if (popup.open) {
            popup.close();
        }
        document.body.classList.remove("inactivity-open");
    }

    function scheduleInactivity() {
        window.clearTimeout(inactivityTimer);
        if (!popup.open && hasActiveSection()) {
            inactivityTimer = window.setTimeout(openPopup, inactivityDelay);
        }
    }

    function returnToHome() {
        closePopup();
        showHome();
    }

    function openPopup() {
        if (!hasActiveSection()) {
            return;
        }

        popup.show();
        document.body.classList.add("inactivity-open");
        stayButton.focus();
        returnHomeTimer = window.setTimeout(returnToHome, returnHomeDelay);
    }

    stayButton.addEventListener("click", function() {
        closePopup();
        scheduleInactivity();
    });

    homeButton.addEventListener("click", returnToHome);

    popup.addEventListener("cancel", function(event) {
        event.preventDefault();
    });

    popup.addEventListener("close", function() {
        document.body.classList.remove("inactivity-open");
        clearReturnHomeTimer();
    });

    document.addEventListener("click", function() {
        if (!popup.open) {
            scheduleInactivity();
        }
    });

    document.addEventListener("keydown", function(event) {
        if (!popup.open) {
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            return;
        }

        if (event.key !== "Tab" || !languageSelect) {
            return;
        }

        const focusableElements = [stayButton, homeButton, languageSelect];
        const currentIndex = focusableElements.indexOf(document.activeElement);
        const nextIndex = currentIndex === -1
            ? 0
            : (currentIndex + (event.shiftKey ? -1 : 1) + focusableElements.length) % focusableElements.length;

        event.preventDefault();
        focusableElements[nextIndex].focus();
    });

    scheduleInactivity();
}
