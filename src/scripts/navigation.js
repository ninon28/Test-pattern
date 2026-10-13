"use strict";

const body = document.querySelector("body");
const menuToggle = document.querySelector(".menu__toggle");
const menu = document.querySelector(".menu");
const menuLinks = document.querySelectorAll(".title__nav a");

if(menuToggle){
    menuToggle.addEventListener("click", menuOpen); 

    for(let menuLink of menuLinks){ 
        menuLink.addEventListener("click", menuOpen);
    }
}

function menuOpen(){ 
    menu.classList.toggle("menu--open");
    body.classList.toggle("no-scroll");
    console.log(body);
}



// sections 
const sections = document.querySelectorAll(".section");

const prevButtons = document.querySelectorAll(".button_previous"); 
const nextButtons = document.querySelectorAll(".button_next");

let currentIndex = 0;

function showSection(index) {

    sections.forEach(function(section, i) {
        if (i === index) {
            section.classList.add("section-active");
        } else {
            section.classList.remove("section-active");
        }
    });
}

// on affiche la première section (cad 0 ) au chargement de la page 
showSection(currentIndex);

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