// content.js
var emojiList, emojiRegex;
var emojiFound = 0;

// Drivers //
scanPage();

// Listeners //
chrome.storage.onChanged.addListener((changes, storageType) => {
  // If the emojiList changes on disk, rescan the page
  if (changes.emojiList && (emojiList = changes.emojiList.newValue) && storageType == 'local')
    scanPage();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'getPageInfo')
		sendPageInfoToPopup(sendResponse);
  else if (request.message === 'rescanPage') {
    scanPage((results) => {
      sendPageInfoToPopup(sendResponse, results.replacedEmoji.length);
    });
  }
});

// Helpers //
function scanPage(callback) {
  getStoredOrGlobal('emojiList', (result) => {
    if (!result || !(emojiList = result.emojiList)) {
      return;
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
    imageNode.style.height = '1.5em'
    imageNode.style['margin-bottom'] = '-0.3em'
    imageNode.setAttribute('aria-label', qualifiedEmojiName)

    textNode.parentElement.insertBefore(imageNode, remainingTextNode)
    textNode = remainingTextNode;

    emojiFound += 1; //TODO replace
    console.debug("Found and replaced " + qualifiedEmojiName);

    return {emojiName, emojiUrl};
  });
}

function sendPageInfoToPopup(callback, emojiFoundOverride) {
  getStoredOrGlobal(['emojiList', 'slackDomain'], (result) => {
    var domInfo = {
      emojiFound: emojiFoundOverride || emojiFound || 0,
      emojiCount: Object.keys(result.emojiList).length || 0,
      slackDomain: result.slackDomain || "N/A"
    };

    console.log(`responding to page with ${JSON.stringify(domInfo)}`)
    chrome.runtime.sendMessage({
      message: 'setPageInfo',
      info: domInfo
    });
    return callback(domInfo);
  });
}

function getStoredOrGlobal(variables, callback) {
  var globalResults = {};

  getFromStorage = [variables].flat().reduce((acc, v) => {
    if (val = this[v])
      globalResults[v] = val;
    else
      acc.push(v)
    return acc;
  }, [])

  if (getFromStorage.length > 0) {
    chrome.storage.local.get(getFromStorage, (storedResults) => {
      callback(Object.assign({}, globalResults, storedResults));
    });
  } else {
    callback(globalResults);
  }
}
