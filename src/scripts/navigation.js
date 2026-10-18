"use strict";

import { initInactivity } from "./inactivity.js";

const body = document.querySelector("body");
const navigation = document.querySelector(".navigation");
const menuToggle = document.querySelector(".menu__toggle");
const menuClose = document.querySelector(".menu__close");
const menu = document.querySelector(".menu");
const menuLinks = document.querySelectorAll(".menu__link");
const menuItems = document.querySelectorAll(".menu__item");
const currentTitleDisplay = document.querySelector(".current-nav-title");
const homeScreen = document.querySelector(".home-screen");
const finishButton = document.querySelector(".button_finish");
const experienceLaunch = document.querySelector(".experience-launch");
const experienceOverlay = document.querySelector(".experience-overlay");
const experienceClose = document.querySelector(".experience-close");

if (menuToggle) {
    menuToggle.addEventListener("click", showHome);
}

if (navigation) {
    navigation.addEventListener("click", function(event) {
        if (!(event.target instanceof Element) || event.target.closest(".menu__toggle, .language-picker")) {
            return;
        }

        menuOpen(true);
    });
}

if (menuClose) {
    menuClose.addEventListener("click", function() {
        menuOpen(false);
    });
}

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && menu && menu.classList.contains("menu--open")) {
        menuOpen(false);
    }
});

function menuOpen(isOpen) {
    const shouldOpen = typeof isOpen === "boolean"
        ? isOpen
        : !menu.classList.contains("menu--open");

    menu.classList.toggle("menu--open", shouldOpen);
    menu.setAttribute("aria-hidden", String(!shouldOpen));
    body.classList.toggle("no-scroll", shouldOpen);
    menuToggle.setAttribute("aria-expanded", String(shouldOpen));
}

// sections 
const sections = document.querySelectorAll(".section");

const prevButtons = document.querySelectorAll(".button_previous"); 
const nextButtons = document.querySelectorAll(".button_next");

let currentIndex = 0;

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
    homeScreen.hidden = false;
    currentTitleDisplay.hidden = true;
    menuOpen(false);
}

experienceLaunch.addEventListener("click", function() {
    experienceOverlay.showModal();
});

experienceClose.addEventListener("click", function() {
    experienceOverlay.close();
});

experienceOverlay.addEventListener("click", function(event) {
    if (event.target === experienceOverlay) {
        experienceOverlay.close();
    }
});

function getChapterIndex(sectionIndex) {
    if (sectionIndex >= 7) return 4;
    if (sectionIndex >= 4) return 3;
    if (sectionIndex >= 2) return 2;
    return 1;
}

// la c'est pour afficher le titre de la nav actuelle
function updateCurrentNavTitle(index) {
    const chapter = getChapterIndex(index);

    menuItems.forEach(function(item) {
        const itemChapter = parseInt(item.getAttribute("data-chapter"), 10);
        if (itemChapter === chapter) {
            item.classList.add("menu__item--active");
            if (currentTitleDisplay) {
                const link = item.querySelector(".menu__link");
                if (link) {
                    currentTitleDisplay.textContent = link.textContent.trim();
                }
            }
        } else {
            item.classList.remove("menu__item--active");
        }
    });
}

function showSection(index) {
    if (navigation) {
        navigation.classList.remove("navigation--home");
    }

    homeScreen.hidden = true;
    currentTitleDisplay.hidden = false;

    sections.forEach(function(section, i) {
        if (i === index) {
            section.classList.add("section-active");
        } else {
            section.classList.remove("section-active");
        }
    });

    prevButtons.forEach(function(button) {
        button.disabled = (index === 0);
    });

    nextButtons.forEach(function(button) {
        button.disabled = (index === sections.length - 1);
    });

    updateCurrentNavTitle(index);
}

document.addEventListener("click", function(event) {
    if (homeScreen.hidden || event.target.closest(".navigation, .menu, .experience-launch, .experience-overlay, .warning-popup")) {
        return;
    }

    currentIndex = 0;
    showSection(currentIndex);
});

finishButton.addEventListener("click", function(event) {
    event.stopPropagation();
    showHome();
});

showHome();
initInactivity(showHome);

nextButtons.forEach(function(button) {
    button.addEventListener("click", function() {
        if (currentIndex < sections.length - 1) {
            currentIndex++;
            showSection(currentIndex);
        }
    });
});

prevButtons.forEach(function(button) {
    button.addEventListener("click", function() {
        if (currentIndex > 0) {
            currentIndex--;
            showSection(currentIndex);
        }
    });
});

// nav 

menuLinks.forEach(function(link) {
    link.addEventListener("click", function(e) {
        const href = link.getAttribute("href");

        if (href.includes("#")) {
            const targetId = href.split("#")[1];
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                e.preventDefault(); // evite le saut du lien

                currentIndex = Array.from(sections).indexOf(targetSection);
                
                showSection(currentIndex);

                menu.classList.remove("menu--open");
                body.classList.remove("no-scroll");
            }
        }
    });
});