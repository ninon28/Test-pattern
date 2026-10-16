"use strict";

const optionsLanguage = document.getElementById("language_select"); 
const allNewText = document.querySelectorAll('[data-i18n]'); 

optionsLanguage.addEventListener('change',function(event){
    console.log(event.target.value);
    
    const selectedLanguage = event.target.value ; 

    fetch('assets/lang/'+ selectedLanguage + '.json')
    .then(function (response) {
    return response.json();
    }).then(function (doc){
        console.log(doc); 

        allNewText.forEach(function(oneNewText){
            const key = oneNewText.getAttribute('data-i18n'); 
            const translation = doc[key];

            if (translation === undefined) {
                return;
            }

            const menuNumber = oneNewText.querySelector('.menu__number');
            const menuTitle = oneNewText.querySelector('.menu__title');

            if (menuNumber && menuTitle) {
                const numberEnd = translation.indexOf(']');
                menuNumber.textContent = translation.slice(0, numberEnd + 1);
                menuTitle.textContent = translation.slice(numberEnd + 1).trim();
                return;
            }

            oneNewText.textContent = translation;
            
        }); 

    });

});

