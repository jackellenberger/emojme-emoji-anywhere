// content.js
var emojiList, emojiRegex;
emojiFound = 0;

// Drivers //
scanPage();

// Listeners //
chrome.storage.onChanged.addListener((changes, storageType) => {
  // If the emojiList changes on disk, rescan the page
  if (changes.emojiList && (emojiList = changes.emojiList.newValue) && storageType == 'local') {
    scanPage();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if ((request.from === 'popup') && (request.message === 'requestingPageInfo')) {
		sendPageInfoToPopup(sendResponse);
  }

  if ((request.from === 'popup') && (request.message === 'requestingRescan')) {
    scanPage((results) => {
      sendPageInfoToPopup(sendResponse, results.replacedEmoji.length, Object.keys(emojiList).length);
    });
  }
});

// Helpers //
function scanPage(callback) {
  chrome.storage.local.get('emojiList', (result) => {
    if (!result || !(emojiList = result.emojiList)) {
      // loadEmojiFile forces a write to chrome.store which is caught by a listener which calls scanPage()
      return loadEmojiFile();
    }

    emojiRegexString = Object.keys(emojiList)
      .map((x) => (":"+x+":").replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join("|");

    emojiRegex = new RegExp(emojiRegexString, 'ig');
    replacedEmoji = traverseDom(document.body, emojiRegex);
    scanResults = {replacedEmoji, emojiList, emojiRegex};

    if (callback)
      return callback(scanResults);
    else
      return scanResults;
  });
}

function traverseDom(node, emojiRegex) {
  console.time('traverseDom');
  var walkerNode;
  var acceptedNodes = [];

  var treeWalker = document.createTreeWalker(
    node,
    NodeFilter.SHOW_TEXT,
    { acceptNode: (node) => {
      if (node.parentNode.tagName === 'TEXTAREA')
        return NodeFilter.FILTER_REJECT;
      if (emojiRegex.test(node.data))
        return NodeFilter.FILTER_ACCEPT;
    }},
    false
  );

  // TODO: save for an "undo" option
  while(walkerNode = treeWalker.nextNode()) {
    acceptedNodes.push(walkerNode);
  }

  console.time('traverseDom.applyEmojiRegex');
  replacedEmoji = acceptedNodes.map((textNode) => applyEmojiRegex(textNode));
  console.timeEnd('traverseDom.applyEmojiRegex');

  console.debug('Replaced emoji: ' + replacedEmoji.length);
  console.timeEnd('traverseDom');

  return replacedEmoji;
}

// Given a text node, find all emoji we know about and replace the text with the image, a la slack
function applyEmojiRegex(textNode) {
  var offset = 0;
  var fulltext = textNode.nodeValue;
  var matches = Array.from(fulltext.matchAll(emojiRegex));

  return matches.map((match) => {
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
    imageNode.height = "20"; //TODO use em units
    imageNode.setAttribute('aria-label', qualifiedEmojiName)

    textNode.parentElement.insertBefore(imageNode, remainingTextNode)
    textNode = remainingTextNode;

    emojiFound += 1; //TODO replace
    console.debug("Found and replaced " + qualifiedEmojiName);

    return {emojiName, emojiUrl};
  });
}

function loadEmojiFile() {
  chrome.runtime.sendMessage({from: 'content', message: "requestEmojiFileLoad"});
}

function sendPageInfoToPopup(callback, emojiFoundOverride, emojiCountOverride) {
  // Directly after a scan, we can specify the emojiFound and emojiList explicitly
  // When not directly after a scan, we'll rely on chrome caching the variable in the window.
	var domInfo = {
    emojiFound: emojiFoundOverride || emojiFound || 0,
    emojiCount: emojiCountOverride || Object.keys(emojiList || []).length
  };

	return callback(domInfo);
}
