// content.js
var emojiList, emojiRegex;

// Listeners //
chrome.storage.onChanged.addListener((changes, storageType) => {
  if (changes.emojiList && (emojiList = changes.emojiList.newValue) && storageType == 'local') {
    run();
  }
});

// Drivers //
run();

// Helpers //
function run() {
  chrome.storage.local.get('emojiList', (result) => {
    if (!result || !(emojiList = result.emojiList)) {
      // loadEmojiFile forces a write to chrome.store which is caught by a listener which calls run()
      return loadEmojiFile(); // TODO: prompt for refresh on badge icon?
    }

    emojiRegexString = Object.keys(emojiList)
      .map((x) => (":"+x+":").replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join("|");

    emojiRegex = new RegExp(emojiRegexString, 'ig');
    traverseDom(document.body);
  });
}


// Taken from cloud-to-butt,
// https://github.com/panicsteve/cloud-to-butt/blob/f8c21047c89ed5182cbcec423d25aa0e27cff8d2/Source/content_script.js
// which is in part taken from http://is.gd/mwZp7E
function traverseDom(node) {
  var child, next;

  var tagName = node.tagName ? node.tagName.toLowerCase() : "";
  if (tagName == 'input' || tagName == 'textarea') {
    return;
  }
  if (node.classList && node.classList.contains('ace_editor')) {
    return;
  }

  switch ( node.nodeType ) {
    case 1:  // Element
    case 9:  // Document
    case 11: // Document fragment
      child = node.firstChild;
      while ( child ) {
        next = child.nextSibling;
        traverseDom(child);
        child = next;
      }
      break;
    case 3: // Text node
      applyEmojiRegex(node);
      break;
  }
}

// Given a text node, find all emoji we know about and replace the text with the image, a la slack
function applyEmojiRegex(textNode) {
  var offset = 0;
  var fulltext = textNode.nodeValue;
  var matches = fulltext.matchAll(emojiRegex);

  for (const match of matches) {
    qualifiedEmojiName = match[0] // :emoji-name:
    emojiName = qualifiedEmojiName.replace(/:/g, ''); // emoji-name
    emojiUrl = emojiList[emojiName];

    // Offset = the index of the first character of the emoji
    //  + the length of the emoji name
    //  - how many characters we have already hacked off this text node
    offset = match.index + qualifiedEmojiName.length - offset;

    remainingTextNode = textNode.splitText(offset);
    textNode.nodeValue = textNode.nodeValue.replace(qualifiedEmojiName, '')

    imageNode = document.createElement('img');
    imageNode.src = emojiUrl;
    imageNode.alt = emojiName; imageNode.title = emojiName;
    imageNode.height = "20"; //TODO use em
    imageNode.setAttribute('aria-label', qualifiedEmojiName)

    textNode.parentElement.insertBefore(imageNode, remainingTextNode)
    textNode = remainingTextNode;

    console.log("Found and replaced " + match[1]);
  }
}

function loadEmojiFile() {
  chrome.runtime.sendMessage({"message": "refresh_emoji"});
}
