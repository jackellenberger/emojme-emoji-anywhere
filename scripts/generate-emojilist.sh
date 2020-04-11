#!/bin/bash
. ~/.nvm/nvm.sh

if [ "$#" -eq 2 ]; then
  nvm use 10 || nvm install 10
  npm list emojme || npm install emojme
  npx emojme download --subdomain $1 --token $2

  until [ -f "build/$1.adminList.json" ]; do
    sleep 1
  done

  cat build/$1.adminList.json \
    | jq -r '. | map({(.name): .url}) | add' \
    > emojilist.json.new

  if [ -f "emojilist.json" ]; then
    echo "Merging emojilist.json.new and emojilist.json.old\n"
    mv emojilist.json emojilist.json.old
    jq -Mn --argfile old emojilist.json.old --argfile new emojilist.json.new '$old + $new' > emojilist.json
  else
    mv emojilist.json.new emojilist.json
  fi

  echo "emojilist.json generated"
else
  echo 'Usage: generate-emojilist.sh USER SUBDOMAIN TOKEN'
fi
