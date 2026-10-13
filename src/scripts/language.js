const optionsLanguage = document.getElementById("language_select"); 

optionsLanguage.addEventListener('change',function(event){
    console.log(event.target.value);
    
    const selectedLanguage = event.target.value ; 

    fetch('assets/lang/'+ selectedLanguage + '.json')
    .then(function (response) {
    return response.json();
    }).then(function (doc){
        console.log(doc)
    })


});

