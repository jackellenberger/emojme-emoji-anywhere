// content.js
var emojiList, emojiRegex;
// A global emojiFound count ensures that multiple rescans compound the number of found emoji
var emojiFound = 0;

// Drivers //
scanPage();

// Listeners //
chrome.storage.onChanged.addListener((changes, storageType) => {
  // If the emojiList changes on disk, rescan the page
  if (changes.emojiList && (emojiList = changes.emojiList.newValue) && storageType == 'local')
    scanPage((results) => {
      sendPageInfoToPopup(results.replacedEmoji.length);
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'getPageInfo')
		sendPageInfoToPopup();
  else if (request.message === 'rescanPage') {
    scanPage((results) => {
      sendPageInfoToPopup();
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
  replacedEmoji = acceptedNodes.map((textNode) => replaceEmojiTextNode(textNode));
  console.timeEnd('traverseDom.applyEmojiRegex');

  console.debug('Replaced emoji: ' + replacedEmoji.length);
  console.timeEnd('traverseDom');

  return replacedEmoji;
}

// Given a text node, find all emoji we know about and replace the text with the image, a la slack
function replaceEmojiTextNode(textNode) {
  var fulltext = textNode.nodeValue;
  var matches = Array.from(fulltext.matchAll(emojiRegex));

  // Reverse matches to replace the last instance first and not worry about offsets
  return matches.reverse().map((match) => {
    qualifiedEmojiName = match[0] // :emoji-name:
    emojiName = qualifiedEmojiName.replace(/:/g, ''); // emoji-name
    emojiUrl = emojiList[emojiName];

    // e.g. for text node "lorem :buttbrow: ipsum"
    // match.index = 6
    // textNode.nodeValue[match.index] === ":"
    // remainingTextNode.nodeValue === ":buttbrow: ipsum"
    remainingTextNode = textNode.splitText(match.index); //:buttbrow: ipsum
    remainingTextNode.nodeValue = remainingTextNode.nodeValue.replace(qualifiedEmojiName, '')

    imageNode = document.createElement('img');
    imageNode.src = emojiUrl;
    imageNode.alt = emojiName; imageNode.title = emojiName;
    imageNode.style.height = '1.5em'
    imageNode.style['margin-bottom'] = '-0.3em'
    imageNode.setAttribute('aria-label', qualifiedEmojiName)

    textNode.parentElement.insertBefore(imageNode, remainingTextNode)

    emojiFound += 1; //TODO replace
    console.debug("Found and replaced " + qualifiedEmojiName);

    return {emojiName, emojiUrl};
  });
}

function sendPageInfoToPopup() {
  getStoredOrGlobal(['emojiList', 'slackDomain'], (result) => {
    var domInfo = {
      emojiFound: emojiFound,
      emojiCount: Object.keys(result.emojiList).length || 0,
      slackDomain: result.slackDomain || "N/A"
    };

    console.log(`responding to page with ${JSON.stringify(domInfo)}`)
    chrome.runtime.sendMessage({
      message: 'setPageInfo',
      info: domInfo
    });
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
