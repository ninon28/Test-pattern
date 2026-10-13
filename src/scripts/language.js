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

            oneNewText.textContent = doc[key]; 
            
        }); 

    });

});

