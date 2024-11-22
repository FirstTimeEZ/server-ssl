/**
 * Creates a new tag element and appends it to the specified tags section.
 * 
 * @param {string} name - The name or text content of the tag to be created.
 * @param {HTMLElement} tagsSection - The HTML element to which the new tag will be appended.
 * 
 * @returns {void} - This function does not return a value.
 */
export function createTag(name, tagsSection, callbackFunc) {
    const newTag = document.createElement('div');
    newTag.classList.add('tag');

    const label = document.createElement('label');
    label.textContent = name;

    const removeButton = document.createElement('span');
    removeButton.classList.add('tag-remove');
    removeButton.textContent = '×';

    removeButton.addEventListener('click', (event) => removeTagOnClick(event, callbackFunc));

    newTag.appendChild(label);
    newTag.appendChild(removeButton);
    tagsSection.appendChild(newTag);
}

/**
 * Removes the tag element that was clicked and sends a message to the window.
 * 
 * @param {Function} callbackFunc - A callback function that takes one argument, which is the 
 *                          text of the tag that was removed, this can be undefined.
 * 
 * @this {HTMLElement} - The HTML element that triggered the event (the tag being removed).
 */
export function removeTagOnClick(event, callbackFunc) {
    event.target.parentElement.remove();
    const message = { message: "tag-remove", tag: event.target.previousElementSibling.innerText };
    window.postMessage(message);

    typeof callbackFunc === 'function' && callbackFunc(event.target.previousElementSibling.innerText);
}