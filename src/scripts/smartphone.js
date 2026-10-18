"use strict";

const body = document.body;
const navigation = document.querySelector(".navigation");
const menuToggle = document.querySelector(".menu__toggle");
const menu = document.querySelector(".menu");
const menuItems = Array.from(document.querySelectorAll(".menu__item"));
const menuLinks = document.querySelectorAll(".menu__link");
const currentTitleDisplay = document.querySelector(".current-nav-title");
const homeScreen = document.querySelector(".home-screen");
const finishButton = document.querySelector(".button_finish");
const sections = Array.from(document.querySelectorAll(".section"));
const prevButtons = document.querySelectorAll(".button_previous");
const nextButtons = document.querySelectorAll(".button_next");
const optionsLanguage = document.getElementById("language_select");
const allNewText = document.querySelectorAll("[data-i18n]");

let currentIndex = 0;

function setMenuOpen(isOpen) {
    if (!menu) {
        return;
    }

    menu.classList.toggle("menu--open", isOpen);
    menu.setAttribute("aria-hidden", String(!isOpen));

    if (menuToggle) {
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    }
}

function getChapterForSection(sectionIndex) {
    let chapter = null;
    let latestStartIndex = -1;

    menuItems.forEach(function(item) {
        const link = item.querySelector(".menu__link");
        const href = link && link.getAttribute("href");

        if (!href || href.charAt(0) !== "#") {
            return;
        }

        const targetSection = document.getElementById(href.slice(1));
        const startIndex = sections.indexOf(targetSection);

        if (startIndex >= 0 && startIndex <= sectionIndex && startIndex > latestStartIndex) {
            latestStartIndex = startIndex;
            chapter = item.getAttribute("data-chapter");
        }
    });

    return chapter;
}

function updateCurrentNavTitle(index) {
    const chapter = getChapterForSection(index);

    menuItems.forEach(function(item) {
        const isActive = item.getAttribute("data-chapter") === chapter;
        item.classList.toggle("menu__item--active", isActive);

        if (isActive && currentTitleDisplay) {
            const link = item.querySelector(".menu__link");
            if (link) {
                currentTitleDisplay.textContent = link.textContent.trim();
            }
        }
    });
}

function showHome() {
    currentIndex = 0;
    if (navigation) {
        navigation.classList.add("navigation--home");
    }

    sections.forEach(function(section) {
        section.classList.remove("section-active");
    });
    menuItems.forEach(function(item) {
        item.classList.remove("menu__item--active");
    });

    if (homeScreen) {
        homeScreen.hidden = false;
    }

    if (currentTitleDisplay) {
        currentTitleDisplay.hidden = true;
    }

    setMenuOpen(false);
}

function showSection(index) {
    if (!Number.isInteger(index) || index < 0 || index >= sections.length) {
        return;
    }

    currentIndex = index;
    if (navigation) {
        navigation.classList.remove("navigation--home");
    }

    if (homeScreen) {
        homeScreen.hidden = true;
    }

    if (currentTitleDisplay) {
        currentTitleDisplay.hidden = false;
    }

    sections.forEach(function(section, sectionIndex) {
        section.classList.toggle("section-active", sectionIndex === index);
    });

    prevButtons.forEach(function(button) {
        button.disabled = index === 0;
    });

    nextButtons.forEach(function(button) {
        button.disabled = index === sections.length - 1;
    });

    updateCurrentNavTitle(index);
}

if (menuToggle) {
    menuToggle.addEventListener("click", function() {
        showHome();
    });
}

if (navigation) {
    navigation.addEventListener("click", function(event) {
        if (!(event.target instanceof Element) || event.target.closest(".menu__toggle, .language-picker")) {
            return;
        }

        setMenuOpen(true);
    });
}

const menuClose = document.querySelector(".menu__close");
if (menuClose) {
    menuClose.addEventListener("click", function() {
        setMenuOpen(false);
    });
}

document.addEventListener("keydown", function(event) {
    if (event.key === "Escape" && menu && menu.classList.contains("menu--open")) {
        setMenuOpen(false);
    }
});

document.addEventListener("click", function(event) {
    if (!homeScreen || homeScreen.hidden || !(event.target instanceof Element)) {
        return;
    }

    if (event.target.closest(".navigation, .menu, .experience-launch, .experience-overlay, .warning-popup")) {
        return;
    }

    showSection(0);
});

if (finishButton) {
    finishButton.addEventListener("click", function(event) {
        event.stopPropagation();
        showHome();
    });
}

nextButtons.forEach(function(button) {
    button.addEventListener("click", function() {
        showSection(currentIndex + 1);
    });
});

prevButtons.forEach(function(button) {
    button.addEventListener("click", function() {
        showSection(currentIndex - 1);
    });
});

menuLinks.forEach(function(link) {
    link.addEventListener("click", function(event) {
        const href = link.getAttribute("href");
        if (!href || href.charAt(0) !== "#") {
            return;
        }

        const targetSection = document.getElementById(href.slice(1));
        const targetIndex = sections.indexOf(targetSection);
        if (targetIndex < 0) {
            return;
        }

        event.preventDefault();
        showSection(targetIndex);
        setMenuOpen(false);
    });
});

function applyTranslations(translations) {
    allNewText.forEach(function(element) {
        const key = element.getAttribute("data-i18n");
        const translation = translations[key];

        if (typeof translation !== "string") {
            return;
        }

        const menuNumber = element.querySelector(".menu__number");
        const menuTitle = element.querySelector(".menu__title");

        if (menuNumber && menuTitle) {
            const menuTranslation = translation.match(/^(\[\d+\])\s*([\s\S]*)$/);
            menuNumber.textContent = menuTranslation ? menuTranslation[1] : "";
            menuTitle.textContent = menuTranslation ? menuTranslation[2] : translation;
            return;
        }

        element.textContent = translation;
    });

    if (currentTitleDisplay && !currentTitleDisplay.hidden) {
        updateCurrentNavTitle(currentIndex);
    }
}

if (optionsLanguage) {
    optionsLanguage.addEventListener("change", function(event) {
        const selectedLanguage = event.target.value;
        const languageUrl = new URL(
            "../assets/lang/" + encodeURIComponent(selectedLanguage) + ".json",
            window.location.href
        );

        fetch(languageUrl)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("Chargement de la langue impossible (" + response.status + ").");
                }
                return response.json();
            })
            .then(applyTranslations)
            .catch(function(error) {
                console.error("Impossible d’appliquer la traduction sélectionnée.", error);
            });
    });
}

setMenuOpen(false);
showHome();
initInactivity(showHome);