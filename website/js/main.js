import { createTag, removeTagOnClick } from './exports/tags.js';

/**
 * Handles incoming messages from various elements, currently this is just tags
 * 
 * This function is triggered whenever a message is posted to the window using
 * the `window.postMessage` method.
 * 
 * @function
 * @param {MessageEvent} event - The message event object containing the data sent.
 * @example
 * eg: { message: "tag-remove", tag: "exampleTag" }
 */
window.onmessage = function (event) {
    console.log("Message received: ", event.data);
};

////////////////////////////////////////////////////
/// Add Test Data
////////////////////////////////////////////////////

// Setup Tags
document.querySelectorAll('.tag-remove').forEach(removeButton => removeButton.addEventListener('click', removeTagOnClick));

// Create new Tags
const tagsSection = document.querySelector('.tags');
createTag("Testing", tagsSection, (e) => { console.log("Callback Test: ", e) });
createTag("Another Tag", tagsSection);

// Create 10 new Tags slowly 
let tagCount = 0;
setInterval(() => tagCount < 10 ? (createTag(`Tag ${tagCount + 1}`, tagsSection), tagCount++) : clearInterval(5000), 5000);