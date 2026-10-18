const warningPopup = document.querySelector(".warning-popup");
const warningConfirm = document.querySelector(".warning-popup__confirm");
const languageSelect = document.querySelector(".language-picker--header .language-select");

if (warningPopup instanceof HTMLDialogElement && warningConfirm) {
    warningPopup.show();
    document.body.classList.add("warning-open");
    warningConfirm.focus();

    warningConfirm.addEventListener("click", function() {
        warningPopup.close();
    });

    warningPopup.addEventListener("close", function() {
        document.body.classList.remove("warning-open");
    });

    warningPopup.addEventListener("cancel", function(event) {
        event.preventDefault();
    });

    document.addEventListener("keydown", function(event) {
        if (!warningPopup.open || event.key !== "Tab" || !languageSelect) {
            return;
        }

        const focusableElements = [warningConfirm, languageSelect];
        const currentIndex = focusableElements.indexOf(document.activeElement);

        if (currentIndex === -1) {
            event.preventDefault();
            warningConfirm.focus();
            return;
        }

        const nextIndex = (currentIndex + (event.shiftKey ? -1 : 1) + focusableElements.length) % focusableElements.length;
        event.preventDefault();
        focusableElements[nextIndex].focus();
    });
}
