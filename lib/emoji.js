function getMatchingEmoji(emojiList, text) {
  return Object.keys(emojiList)
    .reduce((results, emojiName) => {
      if ((index = emojiName.indexOf(text)) > -1) {
        emojiUrl = emojiList[emojiName]
        results.push({
          index,
          emojiName,
          emojiUrl,
        });
      }
      return results;
    }, []).sort((a, b) => {
      return a.index - b.index;
    }).map((result) => {
      delete result.index;
      return result;
    });
}

function getEmojiMatchResults(emojiList, text) {
  return getMatchingEmoji(emojiList, text)
    .map((result) => {
      return {
        content: result.emojiName,
        description: `<match>${result.emojiName}</match> - <dim>${result.emojiUrl}</dim>`
      };
    });
}

function templateHtmlEmoji(emojiUrl, emojiName, small = true) {
  return `<img src="${emojiUrl}" alt="${emojiName}" title="${emojiName}" aria-label=":${emojiName}:" ${small ? 'height="21" align="top"' : ''}>`
}

function withInsertableEmoji(emojiList, emojiName, callback) {
  var emojiUrl = emojiList[emojiName]
  chrome.storage.local.get('insertMode', (result) => {
    switch (result.insertMode) {
      case "insertMdImage":
        payload = `![${emojiName}](${emojiUrl})`
        break;
      case "insertMdLink":
        payload = `[${emojiName}](${emojiUrl})`
        break;
      case "insertHtmlImageSmall":
        payload = templateHtmlEmoji(emojiUrl, emojiName)
        break;
      case "insertHtmlImageFull":
        payload = templateHtmlEmoji(emojiUrl, emojiName, false)
        break;
      default: //insertUrl || undefined
        payload = `${emojiUrl}`
        break;
    }

    if (callback)
      return callback(payload);
    else
      return payload;
  });
}
