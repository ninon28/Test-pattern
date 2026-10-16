// On attend que le HTML soit chargé avant de rechercher le formulaire et les éléments associés.
const binaryForm = document.querySelector('.binary-form');

// Le script est aussi chargé sur les pages qui pourraient ne pas contenir cette interaction.
// Dans ce cas, il n'y a rien à initialiser et on évite toute erreur liée à un élément absent.
if (binaryForm) {
  const wordInput = binaryForm.querySelector('.binary-form__input');
  const submitButton = binaryForm.querySelector('.binary-form__submit');
  const message = document.querySelector('.binary-form__message');
  const barcodeViewport = document.querySelector('.binary-barcode');
  const collectionViewport = document.querySelector('.binary-barcode__collection');
  const collectionTrack = document.querySelector('.binary-barcode__collection-track');
  const addButton = document.querySelector('.binary-add-button');

  // Ce verrou empêche un nouvel envoi uniquement pendant le défilement en cours.
  let hasStarted = false;
  // Le code reste disponible après l'animation individuelle, jusqu'au clic d'ajout.
  let completedBinaryCode = '';
  // La position finale est mémorisée pour que chaque nouveau défilement continue le précédent.
  let collectionOffset = 0;
  let nextCollectionOffset = 0;

  /**
   * Convertit le texte soumis en une chaîne de bits.
   *
   * TextEncoder transforme d'abord chaque caractère en ses octets UTF-8.
   * Chaque octet est ensuite écrit sur exactement huit bits, y compris ses zéros de tête.
   * Cela fonctionne aussi pour les caractères accentués et les autres caractères Unicode.
   *
   * @param {string} word Texte saisi par la personne.
   * @returns {string} Représentation binaire UTF-8 composée uniquement de « 0 » et « 1 ».
   */
  function wordToBinary(word) {
    const bytes = new TextEncoder().encode(word);

    return Array.from(bytes, (byte) => byte.toString(2).padStart(8, '0')).join('');
  }

  /**
   * Crée une barre par bit et associe la couleur blanche à 0, noire à 1.
   *
   * Chaque barre reçoit une classe dédiée afin que la correspondance bit/couleur
   * reste explicite dans le SCSS et que le contenu de l'entrée ne soit jamais injecté en HTML.
   *
   * @param {string} binaryCode Chaîne binaire à afficher.
   * @param {string} segmentClass Classe qui détermine le rôle du groupe de barres.
   * @returns {HTMLDivElement} Piste contenant une barre par bit.
   */
  function createBarcodeSegment(binaryCode, segmentClass) {
    const segment = document.createElement('div');
    const bars = document.createDocumentFragment();

    segment.classList.add(segmentClass);

    for (const bit of binaryCode) {
      const bar = document.createElement('span');

      bar.classList.add(
        'binary-barcode__bit',
        bit === '0' ? 'binary-barcode__bit--zero' : 'binary-barcode__bit--one',
      );

      bars.appendChild(bar);
    }

    segment.appendChild(bars);

    return segment;
  }

  /**
   * Calcule la nouvelle position de la bande commune et l'anime jusqu'à la partie ajoutée.
   *
   * La piste complète reste dans le DOM : seule sa position change. Le calcul
   * limite le déplacement afin que son extrémité droite reste visible dans la fenêtre.
   */
  function scrollCollectionToEnd() {
    nextCollectionOffset = Math.min(
      0,
      collectionViewport.clientWidth - collectionTrack.scrollWidth,
    );

    collectionTrack.style.setProperty('--collection-scroll-from', `${collectionOffset}px`);
    collectionTrack.style.setProperty('--collection-scroll-to', `${nextCollectionOffset}px`);

    // Retirer puis réappliquer la classe redémarre l'animation vers la nouvelle position.
    collectionTrack.classList.remove('is-scrolling');
    void collectionTrack.offsetWidth;
    collectionTrack.classList.add('is-scrolling');
  }

  /**
   * Affiche le bouton final uniquement lorsque la piste a fini son déplacement.
   *
   * L'écouteur filtre le nom de l'animation et sa cible pour ne pas réagir à un
   * éventuel événement d'animation provenant d'un enfant ou d'un autre élément.
   *
   * @param {HTMLDivElement} track Piste qui va défiler.
   */
  function revealButtonAfterScroll(track, binaryCode) {
    track.addEventListener('animationend', (event) => {
      if (event.target !== track || event.animationName !== 'binary-barcode-scroll') {
        return;
      }

      addButton.hidden = false;
      wordInput.disabled = false;
      submitButton.disabled = false;
      hasStarted = false;
      completedBinaryCode = binaryCode;
      message.textContent = 'Votre code-barres est prêt.';
    }, { once: true });
  }

  // Après chaque défilement collectif, on conserve sa position comme point de départ du suivant.
  collectionTrack.addEventListener('animationend', (event) => {
    if (event.target !== collectionTrack || event.animationName !== 'binary-collection-scroll') {
      return;
    }

    collectionOffset = nextCollectionOffset;
    collectionTrack.style.transform = `translateX(${collectionOffset}px)`;
    collectionTrack.classList.remove('is-scrolling');

    // Ne remplace pas l'état affiché si la personne a déjà lancé la conversion suivante.
    if (!hasStarted) {
      message.textContent = 'Votre partie a été ajoutée. Vous pouvez saisir un nouveau mot.';
    }
  });

  // Le bouton ajoute le code-barres individuel terminé, puis réinitialise la saisie.
  addButton.addEventListener('click', () => {
    if (!completedBinaryCode) {
      return;
    }

    const segment = createBarcodeSegment(completedBinaryCode, 'binary-barcode__segment');

    collectionTrack.appendChild(segment);
    completedBinaryCode = '';
    addButton.hidden = true;
    wordInput.value = '';
    wordInput.disabled = false;
    submitButton.disabled = false;
    wordInput.focus();

    // La bande défile vers la nouvelle partie en gardant les précédentes dans leur ordre.
    scrollCollectionToEnd();
    message.textContent = 'Votre partie a été ajoutée à la bande commune.';
  });

  // Efface l'erreur de champ dès que la personne corrige sa saisie.
  wordInput.addEventListener('input', () => {
    wordInput.setCustomValidity('');
    message.textContent = '';
  });

  // La soumission native du formulaire se déclenche par Entrée ou via son bouton.
  binaryForm.addEventListener('submit', (event) => {
    event.preventDefault();

    // Le formulaire ne doit pas lancer une deuxième animation avant que le
    // défilement en cours soit terminé.
    if (hasStarted) {
      return;
    }

    const word = wordInput.value.trim();

    // L'attribut HTML « required » bloque une chaîne vide, mais pas une saisie
    // composée uniquement d'espaces ; ce contrôle couvre également ce dernier cas.
    if (!word) {
      wordInput.setCustomValidity('Veuillez saisir un mot.');
      wordInput.reportValidity();
      message.textContent = 'Veuillez saisir un mot.';
      return;
    }

    hasStarted = true;
    wordInput.disabled = true;
    submitButton.disabled = true;
    addButton.hidden = true;

    const binaryCode = wordToBinary(word);
    const track = createBarcodeSegment(binaryCode, 'binary-barcode__track');

    // L'écouteur est installé avant l'insertion de la piste pour être prêt dès
    // le démarrage de l'animation CSS.
    revealButtonAfterScroll(track, binaryCode);
    barcodeViewport.replaceChildren(track);
    message.textContent = 'Conversion en cours.';
  });
}