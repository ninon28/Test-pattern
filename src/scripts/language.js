"use strict";

const optionsLanguage = document.getElementById("language_select");
const allNewText = document.querySelectorAll("[data-i18n]");

function applyTranslations(doc) {
    if (doc.html_lang) {
        document.documentElement.lang = doc.html_lang;
    }

    allNewText.forEach(function(oneNewText) {
        const key = oneNewText.getAttribute("data-i18n");
        const translation = doc[key];

        if (typeof translation !== "string") {
            return;
        }

        const attribute = oneNewText.getAttribute("data-i18n-attr");
        if (attribute) {
            attribute.split(/\s+/).forEach(function(attributeName) {
                oneNewText.setAttribute(attributeName, translation);
            });
            return;
        }

        const menuNumber = oneNewText.querySelector(".menu__number");
        const menuTitle = oneNewText.querySelector(".menu__title");

        if (menuNumber && menuTitle) {
            const menuTranslation = translation.match(/^(\[\d+\])\s*([\s\S]*)$/);
            menuNumber.textContent = menuTranslation ? menuTranslation[1] : "";
            menuTitle.textContent = menuTranslation ? menuTranslation[2] : translation;
            return;
        }

        oneNewText.textContent = translation;
    });

    const currentTitleDisplay = document.querySelector(".current-nav-title");
    const activeMenuLink = document.querySelector(".menu__item--active .menu__link");
    if (currentTitleDisplay && activeMenuLink && !currentTitleDisplay.hidden) {
        currentTitleDisplay.textContent = activeMenuLink.textContent.trim();
    }

    document.dispatchEvent(new CustomEvent("site:translationschanged", { detail: doc }));
}

function loadLanguage(selectedLanguage) {
    fetch("assets/lang/" + selectedLanguage + ".json")
        .then(function(response) {
            if (!response.ok) {
                throw new Error("Chargement de la langue impossible (" + response.status + ").");
            }
            return response.json();
        })
        .then(function(doc) {
            console.log(doc);
            applyTranslations(doc);
        })
        .catch(function(error) {
            console.error("Impossible d’appliquer la traduction sélectionnée.", error);
        });
}

optionsLanguage.addEventListener("change", function(event) {
    console.log(event.target.value);

    loadLanguage(event.target.value);
});

loadLanguage(optionsLanguage.value);