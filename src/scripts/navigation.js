"use strict";

const body = document.querySelector("body");
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
    menuToggle.addEventListener("click", menuOpen);
}

if (menuClose) {
    menuClose.addEventListener("click", menuOpen);
}

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && menu && menu.classList.contains("menu--open")) {
        menuOpen();
    }
});

function menuOpen() {
    menu.classList.toggle("menu--open");
    body.classList.toggle("no-scroll");
}

// sections 
const sections = document.querySelectorAll(".section");

const prevButtons = document.querySelectorAll(".button_previous"); 
const nextButtons = document.querySelectorAll(".button_next");

let currentIndex = 0;

function showHome() {
    currentIndex = 0;
    sections.forEach(function(section) {
        section.classList.remove("section-active");
    });
    menuItems.forEach(function(item) {
        item.classList.remove("menu__item--active");
    });
    homeScreen.hidden = false;
    currentTitleDisplay.hidden = true;
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
    if (homeScreen.hidden || event.target.closest(".language-picker, .menu__toggle, .menu, .experience-launch, .experience-overlay")) {
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