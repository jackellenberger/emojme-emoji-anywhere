// Listeners //
chrome.browserAction.onClicked.addListener(() => {
  updatePageInfo();
});

document.addEventListener('DOMContentLoaded', () => {
  updatePageInfo();

  document.getElementById("requestRescan").addEventListener('click', () => {
    requestRescan();
  });

  document.getElementById("openCustomizePage").addEventListener('click', () => {
    chrome.tabs.create({"url": "https://my.slack.com/customize/emoji"});
  });

  document.getElementById("getSlackToken").addEventListener('click', () => {
    getSlackToken();
  });

  document.getElementById("getSlackEmoji").addEventListener('click', () => {
    getSlackEmoji();
  });
});

// Helpers //
function getCurrentTab(callback) {
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, (tabs) => {
    return callback(tabs[0]);
  });
}

function messageCurrentTab(message, callback) {
  getCurrentTab((tab) => {
    chrome.tabs.sendMessage(
      tab.id,
      Object.assign({}, {from: 'popup'}, message),
      callback
    )
  });
}

function updatePageInfo() {
  messageCurrentTab(
    {message: 'requestingPageInfo'},
    (info) => {
      document.getElementById("emojiFound").innerHTML = info.emojiFound;
      document.getElementById("emojiCount").innerHTML = info.emojiCount;
    }
  );
}

function requestRescan() {
  messageCurrentTab(
    {message: 'requestingRescan'},
    (info) => {
      document.getElementById("emojiFound").innerHTML = info.emojiFound;
      document.getElementById("emojiCount").innerHTML = info.emojiCount;
    }
  );
}

function requestAlert(alertText) {
  messageCurrentTab(
    {message: 'requestingAlert', text: alertText},
    () => {}
  );
}

function getSlackToken() {
  chrome.runtime.sendMessage({message: 'getSlackToken', callback: 'alert'});
}

function getSlackEmoji() {
  chrome.runtime.sendMessage({message: 'getSlackToken', callback: 'getSlackEmoji'});
}
