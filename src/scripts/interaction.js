"use strict";

// Cette mémoire vit pendant toute la session et n'est pas effacée au reset.
let generalBinaryCode = '';

// Temps de défilement en millisecondes pour chaque barre binaire; augmentez cette valeur pour ralentir.
const barcodeBitDurationMs = 50;

// On attend que le HTML soit chargé avant de rechercher le formulaire et les éléments associés.
const binaryForm = document.querySelector('.binary-form');

// Le script est aussi chargé sur les pages qui pourraient ne pas contenir cette interaction.
// Dans ce cas, il n'y a rien à initialiser et on évite toute erreur liée à un élément absent.
if (binaryForm) {
  const fadeFallbackMs = 400;
  const interaction = binaryForm.closest('.binary-interaction');
  const wordInput = binaryForm.querySelector('.binary-form__input');
  const submitButton = binaryForm.querySelector('.binary-form__submit');
  const message = interaction.querySelector('.binary-form__message');
  const barcodeViewport = interaction.querySelector('.binary-barcode:not(.binary-barcode--general)');
  const generalBarcodeViewport = interaction.querySelector('.binary-barcode--general');
  const addButton = interaction.querySelector('.binary-add-button');

  // Le verrou empêche une nouvelle soumission tant que la séquence n'est pas terminée.
  let hasStarted = false;
  // Le code individuel est conservé jusqu'à son ajout au code général.
  let completedBinaryCode = '';

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
   * Crée la piste animée et une barre par bit, sans injecter de contenu HTML.
   *
   * @param {string} binaryCode Chaîne binaire à afficher.
   * @returns {HTMLDivElement} Piste contenant une barre par bit.
   */
  function createBarcodeTrack(binaryCode) {
    const track = document.createElement('div');
    const bars = document.createDocumentFragment();

    track.classList.add('binary-barcode__track');

    // La piste parcourt sa propre largeur; une durée proportionnelle au nombre de barres
    // lui donne donc la même vitesse, qu'il s'agisse du code individuel ou du code général.
    const bitDurationMs = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 1
      : barcodeBitDurationMs;
    const durationSeconds = (binaryCode.length * bitDurationMs) / 700;

    // La durée est définie avant l'insertion dans le DOM, donc avant le début de l'animation CSS.
    track.style.animationDuration = `${durationSeconds}s`;

    for (const bit of binaryCode) {
      const bar = document.createElement('span');

      bar.classList.add(
        'binary-barcode__bit',
        bit === '0' ? 'binary-barcode__bit--zero' : 'binary-barcode__bit--one',
      );

      bars.appendChild(bar);
    }

    track.appendChild(bars);

    return track;
  }

  /**
   * Affiche un élément en retirant hidden avant de lancer son fondu entrant.
   *
   * Le reflow sépare l'état transparent de l'état visible pour que le navigateur
   * applique bien la transition, même lorsqu'un élément vient d'être réaffiché.
   *
   * @param {HTMLElement} element Élément à afficher.
   */
  function showElement(element) {
    element.hidden = false;
    element.classList.remove('is-visible');
    element.classList.add('is-hidden');
    void element.offsetWidth;

    requestAnimationFrame(() => {
      element.classList.remove('is-hidden');
      element.classList.add('is-visible');
    });
  }

  /**
   * Termine le fondu sortant avant de retirer l'élément du flux avec hidden.
   *
   * transitionend est la source principale de synchronisation. Le délai de secours
   * couvre les navigateurs ou contextes qui n'émettent pas cet événement.
   *
   * @param {HTMLElement} element Élément à masquer.
   * @returns {Promise<void>} Promesse résolue après la transition et le masquage.
   */
  function hideElement(element) {
    if (element.hidden) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let timeoutId;

      const finishFade = () => {
        element.removeEventListener('transitionend', handleTransitionEnd);
        window.clearTimeout(timeoutId);
        element.hidden = true;
        resolve();
      };

      const handleTransitionEnd = (event) => {
        if (event.target === element && event.propertyName === 'opacity') {
          finishFade();
        }
      };

      element.addEventListener('transitionend', handleTransitionEnd);
      element.classList.remove('is-visible');
      element.classList.add('is-hidden');

      // Ce filet de sécurité évite de bloquer l'interaction si aucun événement n'arrive.
      timeoutId = window.setTimeout(finishFade, fadeFallbackMs);
    });
  }

  /**
   * Attend la fin du code général, vide les codes et rétablit l'état de départ.
   */
  async function resetInteraction() {
    // Les deux codes s'effacent avant que le formulaire reprenne leur place dans le flux.
    await Promise.all([
      hideElement(barcodeViewport),
      hideElement(generalBarcodeViewport),
    ]);

    barcodeViewport.replaceChildren();
    generalBarcodeViewport.replaceChildren();
    addButton.hidden = true;
    wordInput.value = '';
    wordInput.disabled = false;
    submitButton.disabled = false;
    wordInput.setCustomValidity('');
    message.textContent = '';
    completedBinaryCode = '';
    hasStarted = false;
    showElement(binaryForm);
    wordInput.focus();
  }

  /**
   * Affiche le bouton d'ajout uniquement après la fin du premier défilement.
   *
   * L'écouteur vérifie la cible et le nom de l'animation pour ignorer les événements
   * provenant d'un autre élément ou d'une éventuelle animation future.
   *
   * @param {HTMLDivElement} track Piste individuelle qui va défiler.
   * @param {string} binaryCode Code à conserver pour l'étape d'ajout.
   */
  function revealAddButtonAfterScroll(track, binaryCode) {
    track.addEventListener('animationend', (event) => {
      if (event.target !== track || event.animationName !== 'binary-barcode-scroll') {
        return;
      }

      showElement(addButton);
      completedBinaryCode = binaryCode;
    }, { once: true });
  }

  // Le clic ajoute la nouvelle partie à la mémoire puis affiche tout le code général.
  addButton.addEventListener('click', () => {
    if (!completedBinaryCode) {
      return;
    }

    generalBinaryCode += completedBinaryCode;
    completedBinaryCode = '';

    // Le code général démarre tout de suite; le bouton fond en parallèle.
    void hideElement(addButton);
    showElement(generalBarcodeViewport);

    // La piste est reconstruite depuis la mémoire pour inclure toutes les participations.
    const track = createBarcodeTrack(generalBinaryCode);

    // L'écouteur est prêt avant l'insertion de la piste et le démarrage de l'animation.
    track.addEventListener('animationend', (event) => {
      if (event.target !== track || event.animationName !== 'binary-barcode-scroll') {
        return;
      }

      void resetInteraction();
    }, { once: true });

    generalBarcodeViewport.replaceChildren(track);
  });

  // Efface l'erreur de validation dès que la personne corrige sa saisie.
  wordInput.addEventListener('input', () => {
    wordInput.setCustomValidity('');
    message.textContent = '';
  });

  // La soumission native du formulaire fonctionne par Entrée ou via son bouton.
  binaryForm.addEventListener('submit', (event) => {
    event.preventDefault();

    // Une soumission ne peut pas relancer la séquence avant que le reset soit terminé.
    if (hasStarted) {
      return;
    }

    const word = wordInput.value.trim();

    // L'attribut HTML « required » bloque une chaîne vide, mais pas une saisie composée d'espaces.
    if (!word) {
      wordInput.setCustomValidity('Veuillez saisir un mot.');
      wordInput.reportValidity();
      message.textContent = 'Veuillez saisir un mot.';
      return;
    }

    hasStarted = true;
    message.textContent = '';

    const binaryCode = wordToBinary(word);
    const track = createBarcodeTrack(binaryCode);

    // L'écouteur est installé avant l'insertion pour capter la fin de l'animation CSS.
    revealAddButtonAfterScroll(track, binaryCode);

    // Le code individuel démarre au clic; le formulaire fond en parallèle.
    showElement(barcodeViewport);
    barcodeViewport.replaceChildren(track);
    void hideElement(binaryForm);
  });
}
