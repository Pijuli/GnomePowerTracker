#!/bin/bash

# Script to update main.pot and *.po files
#
# This Script is released under GPL v3 license
# Copyright (C) 2020-2024 Javad Rahmatzadeh
# Modified by Marc Salat

set -e

cd src

xgettext \
    --from-code=UTF-8 \
    --output="../po/main.pot" \
    *.js

for file in ../po/*.po
do
    echo -n "Updating $(basename "$file" .po)"
    msgmerge -U "$file" ../po/main.pot

    if grep --silent "#, fuzzy" "$file"; then
        fuzzy+=("$(basename "$file" .po)")
    fi
done

if [[ -v fuzzy ]]; then
    echo "WARNING: Translations have unclear strings and need an update: ${fuzzy[*]}"
fi

