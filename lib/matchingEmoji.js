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

