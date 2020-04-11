// background.js

// Listeners //

chrome.browserAction.onClicked.addListener(function(tab) {
  // TODO: add a menu instead?
  openTab("https://my.slack.com/customize/emoji");
});

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.message === "open_new_tab") {
      openTab(request.url);
    }

    if (request.message === "refresh_emoji") {
      loadEmojiListFromDisk();
    }
  }
);

// Actions
function openTab(url) {
  chrome.tabs.create({"url": url});
}

function loadEmojiListFromDisk() {
  let url = chrome.runtime.getURL('emojilist.json');
  fetch(url).then((result) => result.json()).then((emojilist) => {
    emojiList = emojilist;
    emojiCount = Object.keys(emojilist).length;

    chrome.storage.local.set(
      {'emojiList': emojiList},
      () => console.log("emojme list updated; found " + emojiCount)
    );
  });
}

// Helpers //
function clearEmojiList() {
  chrome.storage.local.remove('emojiList', () => console.log('cleared emojilist'));
}
